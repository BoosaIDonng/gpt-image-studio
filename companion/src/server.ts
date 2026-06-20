import Fastify from "fastify";
import cors from "@fastify/cors";
import type { CompanionHealthResponse } from "./types.js";
import { loadSession, isPaired } from "./pairingState.js";
import { pairRoutes } from "./routes/pair.js";
import { authRoutes } from "./routes/auth.js";
import { imagesRoutes } from "./routes/images.js";
import { authMiddleware } from "./middleware/auth.js";
import type { CompanionSecurityConfig } from "./securityConfig.js";
import { isOriginAllowed } from "./securityConfig.js";
import { VERSION } from "./version.js";

export type CompanionRunMode = "serve" | "managed";

export async function startServer(opts: {
  port: number;
  security: CompanionSecurityConfig;
  runMode?: CompanionRunMode;
}) {
  loadSession();
  const runMode = opts.runMode ?? "serve";

  const app = Fastify({
    bodyLimit: opts.security.maxJsonBodyBytes,
    logger: {
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.authorization",
        "headers.authorization",
        "apiKey",
        "api_key",
        "b64_json",
      ],
    },
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      cb(null, isOriginAllowed(origin, opts.security.allowedOrigins));
    },
    credentials: true,
  });

  // Host 头校验：只允许 127.0.0.1 / localhost，防止 DNS rebinding 攻击
  // 把外网域名解析到 127.0.0.1 后，浏览器会携带外网 Host 头访问本地服务
  app.addHook("onRequest", async (req, reply) => {
    const host = req.headers.host;
    if (host && !isLocalHost(host)) {
      return reply.status(403).send({ error: "拒绝访问：Host 不是本地地址" });
    }
  });

  await authMiddleware(app);
  await app.register(pairRoutes, {
    sessionTtlMs: opts.security.sessionTtlMs,
    allowDirectPairing: runMode === "serve",
  });
  await app.register(authRoutes);
  await app.register(imagesRoutes, { security: opts.security });

  app.get("/health", async (): Promise<CompanionHealthResponse> => {
    return {
      app: "gpt-image-studio-companion",
      version: VERSION,
      paired: isPaired(),
      runMode,
    };
  });

  // 全局兜底：任何路由内未被 try/catch 的异常都会走到这里。
  // 统一返回 JSON 结构 { error }，避免泄露堆栈/内部细节，前端也能按既有约定解析。
  app.setErrorHandler((error, _req, reply) => {
    app.log.error(error);
    reply.status(500).send({ error: "Companion 内部错误，请稍后重试。" });
  });

  await app.listen({ host: "127.0.0.1", port: opts.port });
  console.log(`Companion 服务已启动: http://127.0.0.1:${opts.port}`);
  console.log(`安全渠道: ${opts.security.channel}`);
  console.log("允许的 Origin:");
  opts.security.allowedOrigins.forEach((origin) => console.log(`  - ${origin}`));

  if (!isPaired()) {
    if (runMode === "serve") {
      console.log("前台服务已就绪，可在网页端点击「开始配对」。");
    } else {
      console.log("需要配对时请运行：gpt-image-studio pair");
    }
  }
}

/** 判断 Host 头是否指向本地地址（127.0.0.1 / localhost / ::1）。 */
function isLocalHost(host: string): boolean {
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}
