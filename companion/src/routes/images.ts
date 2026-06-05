import type { FastifyInstance } from "fastify";
import { loadCredentials } from "../credentials.js";
import type { CompanionSecurityConfig } from "../securityConfig.js";

type ImagesRoutesOptions = {
  security: CompanionSecurityConfig;
};

export async function imagesRoutes(app: FastifyInstance, opts: ImagesRoutesOptions) {
  app.post("/images/generations", async (req, reply) => {
    const creds = loadCredentials();
    if (!creds) {
      return reply.status(503).send({ error: "Companion 未配置凭据，请先运行 login" });
    }

    if (!isJsonRequest(req.headers["content-type"])) {
      return reply.status(415).send({ error: "请求 Content-Type 必须是 application/json" });
    }

    const body = req.body as Record<string, unknown>;
    const validationError = validateGenerationBody(body);
    if (validationError) {
      return reply.status(400).send({ error: validationError });
    }

    const provider = creds.provider ?? "openai";
    if (provider === "gemini") {
      const geminiRequest = buildGeminiGenerateContentRequest(body);
      const response = await fetchGeminiGenerateContent(
        creds.apiBaseUrl,
        creds.apiKey,
        geminiRequest.model,
        geminiRequest.body,
      );
      const payload = await response.json();
      return reply.status(response.status).send(
        response.ok ? normalizeGeminiGenerateContentResponse(payload) : payload,
      );
    }

    const apiUrl = `${normalizeImagesBaseUrl(creds.apiBaseUrl, provider)}/generations`;

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${creds.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      return reply.status(502).send({
        error: "服务器主动断开了连接，未返回任何响应。通常是提示词中存在不合规内容，触发了平台的内容审核策略，请调整提示词后重试。",
      });
    }

    const payload = await response.text();
    return reply.status(response.status).header("content-type", "application/json").send(payload);
  });

  app.addContentTypeParser("multipart/form-data", function (_req, payload, done) {
    const chunks: Buffer[] = [];
    payload.on("data", (chunk: Buffer) => chunks.push(chunk));
    payload.on("end", () => done(null, Buffer.concat(chunks)));
    payload.on("error", done);
  });

  app.post("/images/edits", { bodyLimit: opts.security.maxEditBodyBytes }, async (req, reply) => {
    const creds = loadCredentials();
    if (!creds) {
      return reply.status(503).send({ error: "Companion 未配置凭据，请先运行 login" });
    }

    if ((creds.provider ?? "openai") === "gemini") {
      if (!isJsonRequest(req.headers["content-type"])) {
        return reply.status(415).send({ error: "Gemini 编辑请求 Content-Type 必须是 application/json" });
      }
      const body = req.body as Record<string, unknown>;
      const validationError = validateGeminiEditBody(body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const geminiRequest = buildGeminiGenerateContentRequest(body);
      const response = await fetchGeminiGenerateContent(
        creds.apiBaseUrl,
        creds.apiKey,
        geminiRequest.model,
        geminiRequest.body,
      );
      const payload = await response.json();
      return reply.status(response.status).send(
        response.ok ? normalizeGeminiGenerateContentResponse(payload) : payload,
      );
    }

    if ((creds.provider ?? "openai") === "grok") {
      if (!isJsonRequest(req.headers["content-type"])) {
        return reply.status(415).send({ error: "Grok 编辑请求 Content-Type 必须是 application/json" });
      }
      const body = req.body as Record<string, unknown>;
      const validationError = validateGrokEditBody(body);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      const apiUrl = `${normalizeImagesBaseUrl(creds.apiBaseUrl, "grok")}/edits`;
      let response: Response;
      try {
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${creds.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
      } catch {
        return reply.status(502).send({
          error: "服务器主动断开了连接，未返回任何响应。通常是提示词中存在不合规内容，触发了平台的内容审核策略，请调整提示词后重试。",
        });
      }

      const payload = await response.text();
      return reply.status(response.status).header("content-type", "application/json").send(payload);
    }

    if (!isMultipartRequest(req.headers["content-type"])) {
      return reply.status(415).send({ error: "请求 Content-Type 必须是 multipart/form-data" });
    }

    const apiUrl = `${normalizeImagesBaseUrl(creds.apiBaseUrl, "openai")}/edits`;
    const contentType = req.headers["content-type"]!;
    const rawBody = req.body as Buffer;
    const validationError = validateEditMultipart(rawBody, opts.security);
    if (validationError) {
      return reply.status(400).send({ error: validationError });
    }

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${creds.apiKey}`,
          "Content-Type": contentType,
        },
        body: new Uint8Array(rawBody),
      });
    } catch {
      return reply.status(502).send({
        error: "服务器主动断开了连接，未返回任何响应。通常是提示词中存在不合规内容，触发了平台的内容审核策略，请调整提示词后重试。",
      });
    }

    const payload = await response.text();
    return reply.status(response.status).header("content-type", "application/json").send(payload);
  });
}

function normalizeImagesBaseUrl(apiBaseUrl: string, provider: "openai" | "grok"): string {
  const trimmed = apiBaseUrl.replace(/\/+$/, "");
  if (provider === "grok" && /\/v1$/i.test(trimmed)) {
    return `${trimmed}/images`;
  }
  return trimmed;
}

async function fetchGeminiGenerateContent(
  apiBaseUrl: string,
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
) {
  return fetch(`${normalizeGeminiBaseUrl(apiBaseUrl)}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function normalizeGeminiBaseUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.replace(/\/+$/, "");
  if (/\/v1$/i.test(trimmed) || /\/v1beta$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

export function buildGeminiGenerateContentRequest(body: Record<string, unknown>) {
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  parts.push(...readGeminiImageParts(body));

  return {
    model,
    body: {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        responseFormat: {
          image: readGeminiImageOptions(body),
        },
      },
    },
  };
}

function readGeminiImageOptions(body: Record<string, unknown>) {
  const gemini = isRecord(body.gemini) ? body.gemini : {};
  const image: Record<string, string> = {};
  if (typeof gemini.aspectRatio === "string" && gemini.aspectRatio.trim()) {
    image.aspectRatio = gemini.aspectRatio.trim();
  }
  if (typeof gemini.imageSize === "string" && gemini.imageSize.trim()) {
    image.imageSize = gemini.imageSize.trim();
  }
  return image;
}

function readGeminiImageParts(body: Record<string, unknown>) {
  const images = Array.isArray(body.images)
    ? body.images
    : body.image !== undefined
      ? [body.image]
      : [];
  return images.filter(isGeminiImagePart);
}

export function normalizeGeminiGenerateContentResponse(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const data = candidates
    .flatMap((candidate) => isRecord(candidate) && isRecord(candidate.content) && Array.isArray(candidate.content.parts)
      ? candidate.content.parts
      : [])
    .map<{ b64_json: string; mime_type?: string } | null>((part) => {
      if (!isRecord(part)) return null;
      const inlineData = isRecord(part.inlineData)
        ? part.inlineData
        : isRecord(part.inline_data)
          ? part.inline_data
          : null;
      if (!inlineData || typeof inlineData.data !== "string" || !inlineData.data) return null;
      const mimeType = typeof inlineData.mimeType === "string"
        ? inlineData.mimeType
        : typeof inlineData.mime_type === "string"
          ? inlineData.mime_type
          : undefined;
      return {
        b64_json: inlineData.data,
        mime_type: mimeType,
      };
    })
    .filter((item): item is { b64_json: string; mime_type?: string } => item !== null);

  return { data };
}

function isJsonRequest(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().split(";")[0]?.trim() === "application/json";
}

function isMultipartRequest(contentType: string | undefined): boolean {
  return contentType?.toLowerCase().startsWith("multipart/form-data") ?? false;
}

function validateGenerationBody(body: Record<string, unknown>): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "请求体必须是 JSON object";
  }
  if (typeof body.model !== "string" || !body.model.trim()) {
    return "缺少 model";
  }
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return "缺少 prompt";
  }
  if ("b64_json" in body || "image" in body || "images" in body || "image[]" in body) {
    return "文生图请求不能包含图片内容";
  }
  return null;
}

export function validateEditMultipart(body: Buffer, security: CompanionSecurityConfig): string | null {
  const text = body.toString("latin1");
  const imagePartNames = [...text.matchAll(/name="image(?:\[\])?"/g)];
  if (imagePartNames.length === 0) {
    return "编辑请求至少需要一张引用图片";
  }
  if (imagePartNames.length > security.maxEditImages) {
    return `编辑请求最多支持 ${security.maxEditImages} 张引用图片`;
  }

  const partHeaders = text.match(/Content-Disposition:[\s\S]*?(?=\r\n\r\n)/g) ?? [];
  for (const header of partHeaders) {
    if (!/name="(?:image(?:\[\])?|mask)"/.test(header)) continue;
    const mime = /Content-Type:\s*([^\r\n]+)/i.exec(header)?.[1]?.trim().toLowerCase();
    if (!mime) {
      return "图片 part 缺少 Content-Type";
    }
    if (/name="mask"/.test(header) && mime !== "image/png") {
      return "mask 必须是 image/png";
    }
    if (/name="image(?:\[\])?"/.test(header) && !security.allowedEditImageMimeTypes.includes(mime)) {
      return `不支持的图片类型：${mime}`;
    }
  }

  return null;
}

export function validateGrokEditBody(body: Record<string, unknown>): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "请求体必须是 JSON object";
  }
  if (typeof body.model !== "string" || !body.model.trim()) {
    return "缺少 model";
  }
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return "缺少 prompt";
  }
  const image = body.image;
  const images = body.images;
  if (image === undefined && images === undefined) {
    return "Grok 编辑请求至少需要一张引用图片";
  }
  if (image !== undefined && !isGrokImageReference(image)) {
    return "Grok 编辑请求的图片必须是 image_url data URL";
  }
  if (images !== undefined && (!Array.isArray(images) || images.length === 0)) {
    return "Grok 编辑请求至少需要一张引用图片";
  }
  if (Array.isArray(images) && !images.every(isGrokImageReference)) {
    return "Grok 编辑请求的图片必须是 image_url data URL";
  }
  return null;
}

export function validateGeminiEditBody(body: Record<string, unknown>): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "请求体必须是 JSON object";
  }
  if (typeof body.model !== "string" || !body.model.trim()) {
    return "缺少 model";
  }
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return "缺少 prompt";
  }
  const image = body.image;
  const images = body.images;
  if (image === undefined && images === undefined) {
    return "Gemini 编辑请求至少需要一张引用图片";
  }
  if (image !== undefined && !isGeminiImagePart(image)) {
    return "Gemini 编辑请求的图片必须是 inline_data base64";
  }
  if (images !== undefined && (!Array.isArray(images) || images.length === 0)) {
    return "Gemini 编辑请求至少需要一张引用图片";
  }
  if (Array.isArray(images) && !images.every(isGeminiImagePart)) {
    return "Gemini 编辑请求的图片必须是 inline_data base64";
  }
  return null;
}

function isGrokImageReference(value: unknown): value is { type: "image_url"; url: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.type === "image_url"
    && typeof item.url === "string"
    && item.url.startsWith("data:image/");
}

function isGeminiImagePart(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const inlineData = isRecord(value.inline_data)
    ? value.inline_data
    : isRecord(value.inlineData)
      ? value.inlineData
      : null;
  if (!inlineData) return false;
  const mimeType = typeof inlineData.mime_type === "string"
    ? inlineData.mime_type
    : typeof inlineData.mimeType === "string"
      ? inlineData.mimeType
      : "";
  return mimeType.startsWith("image/")
    && typeof inlineData.data === "string"
    && inlineData.data.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
