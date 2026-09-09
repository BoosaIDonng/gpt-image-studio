import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import vueDevTools from "vite-plugin-vue-devtools";
import { defineConfig, type Plugin } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 8888,
  },
  plugins: [
    developmentApiProxy(),
    vue(),
    mode === "development" && vueDevTools(),
    tailwindcss(),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Vue / Pinia 等框架代码单独成 chunk，长期不变可强缓存
        manualChunks(id: string) {
          if (id.includes("node_modules/vue") || id.includes("node_modules/pinia")) {
            return "vendor-vue";
          }
        },
      },
    },
  },
}));

function developmentApiProxy(): Plugin {
  return {
    name: "development-api-proxy",
    configureServer(server) {
      server.middlewares.use("/__api-proxy", (req, res) => {
        void forwardApiRequest(req, res);
      });
    },
  };
}

async function forwardApiRequest(req: IncomingMessage, res: ServerResponse) {
  const requestUrl = new URL(req.url ?? "", "http://127.0.0.1");
  const target = requestUrl.searchParams.get("url");
  if (!target) {
    res.writeHead(400, { "Content-Type": "application/json" }).end('{"error":"Missing url"}');
    return;
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(target);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" }).end('{"error":"Invalid url"}');
    return;
  }
  if (upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") {
    res
      .writeHead(400, { "Content-Type": "application/json" })
      .end('{"error":"Unsupported protocol"}');
    return;
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (!value || ["host", "origin", "content-length"].includes(name.toLowerCase())) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }

  try {
    // Node's stream types differ from the DOM stream types used by fetch.
    const requestBody =
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : (Readable.toWeb(req) as unknown as BodyInit);
    const requestInit: RequestInit & { duplex: "half" } = {
      method: req.method,
      headers,
      body: requestBody,
      duplex: "half",
    };
    const upstream = await fetch(upstreamUrl, requestInit);
    const responseHeaders = Object.fromEntries(
      [...upstream.headers].filter(([name]) => !["connection", "transfer-encoding"].includes(name)),
    );
    res.writeHead(upstream.status, responseHeaders);
    if (!upstream.body || req.method === "HEAD") {
      res.end();
      return;
    }
    await pipeline(
      Readable.fromWeb(upstream.body as unknown as import("node:stream/web").ReadableStream),
      res,
    );
  } catch {
    res
      .writeHead(502, { "Content-Type": "application/json" })
      .end('{"error":"Upstream unavailable"}');
  }
}
