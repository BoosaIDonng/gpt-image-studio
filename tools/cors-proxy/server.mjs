#!/usr/bin/env node
/**
 * GPT Image Studio 本地 CORS 代理。
 *
 * 存在的意义：浏览器有两条硬性安全规则，导致线上站点（HTTPS）无法直连
 * `http://host:8080` 这类接口：
 *   1. 混合内容拦截：HTTPS 页面里的 fetch 打到 http:// 地址会被浏览器直接拒绝
 *      （唯一豁免是 127.0.0.1 / localhost 这类回环地址）；
 *   2. CORS：中转站若不返回 Access-Control-Allow-Origin，跨域 fetch 同样失败，
 *      带 Authorization 头的请求还会先走 OPTIONS 预检，很多中转站直接返回 403。
 *
 * 本服务只监听回环地址，把请求原样转发给上游并补上 CORS 响应头，
 * 于是「HTTPS 页面 → 回环代理 → http://任意地址:任意端口」这条链路就通了。
 *
 * 用法：
 *   node tools/cors-proxy/server.mjs
 *   node tools/cors-proxy/server.mjs --port 8787 --allow-origin https://example.com
 *
 * 然后在站点「设置 → 接口」中把 API 地址填为
 * `http://127.0.0.1:8787/?url=<编码后的上游根地址>`。
 */

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;
const DEFAULT_MAX_BODY_BYTES = 256 * 1024 * 1024;

/** 默认放行的页面来源。用 --allow-origin 追加，或 --allow-origin "*" 放行全部。 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://image.idurspace.cn",
  "http://127.0.0.1:8888",
  "http://localhost:8888",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
];

/** 逐跳头部，不能转发给上游。 */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const options = parseCliOptions(process.argv.slice(2));

if (options.help) {
  printUsage();
  process.exit(0);
}

const server = createServer(handleRequest);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `[proxy] 端口 ${options.port} 已被占用，请换一个端口：` +
        `node tools/cors-proxy/server.mjs --port 8788`,
    );
    process.exit(1);
  }
  console.error("[proxy] 服务异常：", error);
  process.exit(1);
});

server.listen(options.port, options.host, () => {
  const endpoint = `http://${options.host}:${options.port}`;
  console.log(`[proxy] 本地 CORS 代理已启动：${endpoint}`);
  console.log(`[proxy] 在站点「设置 → 接口」中填写：${endpoint}/?url=<编码后的上游根地址>`);
  console.log(
    `[proxy] 允许的页面来源：${
      options.allowAllOrigins ? "*（全部放行）" : options.allowedOrigins.join(", ")
    }`,
  );
  console.log("[proxy] Ctrl+C 停止");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

async function handleRequest(req, res) {
  const startedAt = Date.now();
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  applyCorsHeaders(req, res, origin);

  if (origin && !isOriginAllowed(origin)) {
    sendJson(res, 403, {
      error: `页面来源 ${origin} 不在白名单内，请用 --allow-origin ${origin} 启动代理。`,
    });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? options.host}`);

  if (requestUrl.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "gpt-image-studio-cors-proxy",
      host: options.host,
      port: options.port,
    });
    return;
  }

  const target = resolveTargetUrl(req, requestUrl);
  const targetError = validateTargetUrl(target);
  if (targetError) {
    sendJson(res, 400, { error: targetError });
    return;
  }

  const declaredLength = Number(req.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > options.maxBodyBytes) {
    sendJson(res, 413, {
      error:
        `请求体超过上限（${Math.round(options.maxBodyBytes / 1024 / 1024)} MB），` +
        `可用 --max-body-mb 调高。`,
    });
    return;
  }

  const controller = new AbortController();
  const abortUpstream = () => controller.abort();
  req.on("aborted", abortUpstream);
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });

  try {
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req);
    const upstream = await fetch(target, {
      method: req.method,
      headers: buildUpstreamHeaders(req),
      body,
      redirect: "follow",
      signal: controller.signal,
      duplex: "half",
    });

    res.writeHead(upstream.status, upstream.statusText, buildDownstreamHeaders(upstream.headers));

    if (!upstream.body || req.method === "HEAD") {
      res.end();
    } else {
      await pipeline(Readable.fromWeb(upstream.body), res);
    }

    logRequest(req.method, target, upstream.status, Date.now() - startedAt);
  } catch (error) {
    if (res.headersSent) {
      res.destroy();
    } else {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 502, {
        error: `代理转发失败：${message}`,
        target,
      });
    }
    logRequest(req.method, target, "ERR", Date.now() - startedAt);
  } finally {
    req.off("aborted", abortUpstream);
  }
}

/**
 * 取出要转发的目标地址，支持两种写法：
 *   1. 查询参数：/?url=http%3A%2F%2Fhost%3A8080%2Fv1%2Fmodels
 *   2. 直接路径：/http://host:8080/v1/models（方便浏览器地址栏里手工调试）
 */
function resolveTargetUrl(req, requestUrl) {
  const fromQuery = requestUrl.searchParams.get("url");
  if (fromQuery) return fromQuery;

  const raw = req.url ?? "/";
  const queryIndex = raw.indexOf("?");
  const rawPath = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const rawQuery = queryIndex >= 0 ? raw.slice(queryIndex + 1) : "";
  const target = decodeURIComponent(rawPath.replace(/^\/+/, ""));

  return rawQuery ? `${target}${target.includes("?") ? "&" : "?"}${rawQuery}` : target;
}

function validateTargetUrl(target) {
  if (!target) {
    return "缺少目标地址，请用 ?url=<完整地址> 或 /<完整地址> 的形式请求。";
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return `目标地址不是合法 URL：${target}`;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `只支持转发 http/https 地址，收到：${parsed.protocol}`;
  }

  return null;
}

function buildUpstreamHeaders(req) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    if (name.toLowerCase() === "host") continue;
    // 内容长度由 undici 依据实际 body 重新计算，转发旧值会导致请求挂起。
    if (name.toLowerCase() === "content-length") continue;

    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
    } else {
      headers.set(name, value);
    }
  }

  return headers;
}

function buildDownstreamHeaders(upstreamHeaders) {
  const headers = {};
  upstreamHeaders.forEach((value, name) => {
    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName)) return;
    headers[name] = value;
  });
  return headers;
}

function applyCorsHeaders(req, res, origin) {
  if (!origin) return;

  res.setHeader("Vary", "Origin");
  if (!isOriginAllowed(origin)) return;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", corsAllowHeaders(req));
  res.setHeader("Access-Control-Expose-Headers", "*");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function corsAllowHeaders(req) {
  const requested = req.headers["access-control-request-headers"];
  if (typeof requested === "string" && requested.trim()) return requested.trim();
  return "authorization,content-type,x-goog-api-key,x-api-key,accept";
}

function isOriginAllowed(origin) {
  if (options.allowAllOrigins) return true;
  return options.allowedOrigins.includes(origin);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function logRequest(method, target, status, durationMs) {
  console.log(`[proxy] ${method} ${target} -> ${status} (${durationMs}ms)`);
}

function parseCliOptions(argv) {
  const result = {
    host: DEFAULT_HOST,
    port: Number(process.env.PROXY_PORT ?? DEFAULT_PORT),
    allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS],
    allowAllOrigins: false,
    maxBodyBytes: DEFAULT_MAX_BODY_BYTES,
    help: false,
  };

  const envOrigins = (process.env.PROXY_ALLOW_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  result.allowedOrigins.push(...envOrigins);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
      return result;
    }
    if (arg === "--port" || arg === "-p") {
      result.port = Number(next());
      index += 1;
      continue;
    }
    if (arg === "--host") {
      result.host = String(next());
      index += 1;
      continue;
    }
    if (arg === "--allow-origin") {
      const value = String(next() ?? "");
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .forEach((origin) => {
          if (origin === "*") result.allowAllOrigins = true;
          else result.allowedOrigins.push(origin);
        });
      index += 1;
      continue;
    }
    if (arg === "--max-body-mb") {
      result.maxBodyBytes = Number(next()) * 1024 * 1024;
      index += 1;
      continue;
    }

    console.warn(`[proxy] 忽略无法识别的参数：${arg}`);
  }

  if (!Number.isInteger(result.port) || result.port <= 0 || result.port > 65535) {
    console.error(`[proxy] 端口不合法：${result.port}`);
    process.exit(1);
  }

  if (result.host !== "127.0.0.1" && result.host !== "localhost" && result.host !== "::1") {
    console.warn(
      `[proxy] 警告：监听地址是 ${result.host}，同一网络的其他设备也能访问该代理，请确认风险。`,
    );
  }

  return result;
}

function printUsage() {
  console.log(`GPT Image Studio 本地 CORS 代理

用法：
  node tools/cors-proxy/server.mjs [选项]

选项：
  -p, --port <port>         监听端口，默认 ${DEFAULT_PORT}
      --host <host>         监听地址，默认 ${DEFAULT_HOST}
      --allow-origin <o>    追加允许的页面来源，可重复或用逗号分隔；传 "*" 放行全部
      --max-body-mb <mb>    请求体大小上限，默认 ${DEFAULT_MAX_BODY_BYTES / 1024 / 1024} MB
  -h, --help                显示帮助

环境变量：
  PROXY_PORT            同 --port
  PROXY_ALLOW_ORIGIN    同 --allow-origin（逗号分隔）

示例：
  node tools/cors-proxy/server.mjs
  curl "http://127.0.0.1:8787/health"
  curl "http://127.0.0.1:8787/?url=http%3A%2F%2Fgateway.example.com%3A8080%2Fv1%2Fmodels"
`);
}
