/**
 * GPT Image Studio built-in chat relay.
 *
 * Static site (GitHub Pages) visitors can use the builtin assistant with zero
 * configuration: the browser calls this Worker, which holds the NVIDIA API
 * key server-side and forwards to integrate.api.nvidia.com. The key never
 * reaches the frontend bundle.
 *
 * Endpoints:
 *   POST /chat/completions  { messages: [{role, content}...], stream?: boolean }
 *   GET  /health            -> { ok: true }
 *
 * Deploy (from this directory):
 *   npx wrangler deploy            (secret: npx wrangler secret put NVIDIA_API_KEY)
 */

const UPSTREAM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

/** Only these page origins may call the relay. */
const ALLOWED_ORIGINS = new Set([
  "https://image.idurspace.cn",
  "http://127.0.0.1:8888",
  "http://localhost:8888",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

/** Same message limits as the local companion chat route. */
const MAX_REQUEST_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 24_000;

/** Lightweight per-IP rate limit (Workers isolate-local; good enough to stop abuse bursts). */
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateBuckets = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (request.method !== "POST" || new URL(request.url).pathname !== "/chat/completions") {
      return jsonResponse({ error: "Not found" }, 404, corsHeaders);
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ error: "Origin not allowed" }, 403, corsHeaders);
    }

    const apiKey = env.NVIDIA_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        { error: "Relay is not configured: missing NVIDIA_API_KEY secret." },
        503,
        corsHeaders,
      );
    }

    const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (isRateLimited(clientIp)) {
      return jsonResponse({ error: "请求过于频繁，请稍后再试。" }, 429, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "请求体不是有效的 JSON" }, 400, corsHeaders);
    }

    const validationError = validateChatBody(body);
    if (validationError) {
      return jsonResponse({ error: validationError }, 400, corsHeaders);
    }

    const upstreamBody = {
      model: DEFAULT_MODEL,
      messages: body.messages,
      temperature: 1,
      top_p: 1,
      max_tokens: 4096,
      stream: body.stream === true,
    };

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(`${UPSTREAM_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: upstreamBody.stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(upstreamBody),
      });
    } catch {
      return jsonResponse({ error: "聊天服务暂时不可用，请稍后重试。" }, 502, corsHeaders);
    }

    if (!upstreamBody.stream) {
      const payload = await upstreamResponse.text();
      return new Response(payload, {
        status: upstreamResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { readable, writable } = new TransformStream();
    upstreamResponse.body.pipeTo(writable).catch(() => {});
    return new Response(readable, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": upstreamResponse.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": "no-store",
        ...corsHeaders,
      },
    });
  },
};

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateBuckets.size > 10_000) rateBuckets.clear();
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function validateChatBody(body) {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return "请求缺少 messages";
  }
  if (body.messages.length > MAX_REQUEST_MESSAGES) {
    return `消息数量超过上限 ${MAX_REQUEST_MESSAGES}`;
  }
  if (body.stream !== undefined && typeof body.stream !== "boolean") {
    return "stream 必须是布尔值";
  }
  for (const message of body.messages) {
    const role = message?.role;
    if ((role !== "user" && role !== "assistant" && role !== "system") || typeof message?.content !== "string") {
      return "消息格式不正确";
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      return `单条消息超过 ${MAX_MESSAGE_CHARS} 字符上限`;
    }
  }
  return null;
}
