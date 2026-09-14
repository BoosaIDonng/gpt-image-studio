import type { FastifyInstance, FastifyReply } from "fastify";

type ChatRoutesOptions = {
  /** Resolves the upstream chat credential; null when the env var is absent. */
  getUpstream: () => { baseUrl: string; apiKey: string; model: string } | null;
};

const DEFAULT_UPSTREAM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_UPSTREAM_MODEL = "openai/gpt-oss-20b";
/** Hard cap so a runaway history cannot request unbounded upstream tokens. */
const MAX_REQUEST_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 24_000;

type IncomingChatMessage = {
  role?: unknown;
  content?: unknown;
};

export async function chatRoutes(app: FastifyInstance, opts: ChatRoutesOptions) {
  app.post("/chat/completions", async (req, reply) => {
    const upstream = opts.getUpstream();
    if (!upstream) {
      return reply.status(503).send({
        error: "内置聊天服务未配置：请在 Companion 环境中设置 NVIDIA_API_KEY 后重启 Companion。",
      });
    }

    const body = req.body as { messages?: IncomingChatMessage[]; stream?: unknown } | null;
    const validationError = validateChatBody(body);
    if (validationError) {
      return reply.status(400).send({ error: validationError });
    }

    const stream = body?.stream === true;
    const upstreamBody = {
      model: upstream.model,
      messages: sanitizeMessages(body?.messages ?? []),
      temperature: 1,
      top_p: 1,
      max_tokens: 4096,
      stream,
    };

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(`${upstream.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstream.apiKey}`,
          "Content-Type": "application/json",
          Accept: stream ? "text/event-stream" : "application/json",
        },
        body: JSON.stringify(upstreamBody),
      });
    } catch {
      return reply.status(502).send({ error: "聊天服务暂时不可用，请稍后重试。" });
    }

    if (!stream) {
      const payload = await upstreamResponse.text();
      return reply
        .status(upstreamResponse.status)
        .header("content-type", "application/json")
        .send(payload);
    }

    // SSE passthrough: forward bytes as they arrive so the client streams.
    reply.status(upstreamResponse.status).header("content-type", "text/event-stream");
    return reply.send(upstreamResponse.body);
  });
}

export function validateChatBody(body: { messages?: IncomingChatMessage[]; stream?: unknown } | null) {
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
    if (
      (message.role !== "user" && message.role !== "assistant" && message.role !== "system") ||
      typeof message.content !== "string"
    ) {
      return "消息格式不正确";
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      return `单条消息超过 ${MAX_MESSAGE_CHARS} 字符上限`;
    }
  }
  return null;
}

export function sanitizeMessages(messages: IncomingChatMessage[]) {
  return messages.map((message) => ({
    role: message.role as "user" | "assistant" | "system",
    content: message.content as string,
  }));
}
