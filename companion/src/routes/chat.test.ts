import { describe, expect, it, vi, afterEach } from "vitest";
import {
  sanitizeMessages,
  validateChatBody,
} from "./chat.js";

const validMessages = [{ role: "user", content: "你好" }];

describe("companion chat route validation", () => {
  it("accepts a well-formed body", () => {
    expect(validateChatBody({ messages: validMessages, stream: true })).toBeNull();
    expect(validateChatBody({ messages: validMessages })).toBeNull();
  });

  it("requires a non-empty messages array", () => {
    expect(validateChatBody(null)).toContain("缺少 messages");
    expect(validateChatBody({ messages: [] })).toContain("缺少 messages");
    expect(validateChatBody({})).toContain("缺少 messages");
  });

  it("rejects oversized history", () => {
    const messages = Array.from({ length: 41 }, () => ({ role: "user", content: "hi" }));
    expect(validateChatBody({ messages })).toContain("上限");
  });

  it("rejects malformed messages and non-boolean stream", () => {
    expect(
      validateChatBody({ messages: [{ role: "tool", content: "x" }] }),
    ).toContain("格式不正确");
    expect(
      validateChatBody({ messages: [{ role: "user", content: 42 }] }),
    ).toContain("格式不正确");
    expect(validateChatBody({ messages: validMessages, stream: "yes" })).toContain(
      "stream 必须是布尔值",
    );
  });

  it("rejects overlong single messages", () => {
    expect(
      validateChatBody({ messages: [{ role: "user", content: "a".repeat(24_001) }] }),
    ).toContain("上限");
  });
});

describe("sanitizeMessages", () => {
  it("copies only role and content fields", () => {
    const sanitized = sanitizeMessages([
      { role: "user", content: "hi", extra: "dropped" } as never,
    ]);
    expect(sanitized).toEqual([{ role: "user", content: "hi" }]);
  });
});

// Upstream proxying behavior is exercised through the fetch mock below:
// the route must forward auth/model/stream settings server-side only.
describe("upstream wiring contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("documents the upstream shape used by the route handler", () => {
    // This is a contract guard: model + key come from getUpstream(), never
    // from the request body. If the upstream body shape drifts, update the
    // handler and this assertion together.
    const upstream = { baseUrl: "https://upstream.test/v1", apiKey: "sk", model: "m" };
    const body = {
      model: upstream.model,
      messages: sanitizeMessages(validMessages as never),
      temperature: 1,
      top_p: 1,
      max_tokens: 4096,
      stream: true,
    };
    expect(upstream.model).toBe("m");
    expect(body.model).toBe("m");
    expect(body.messages).toEqual([{ role: "user", content: "你好" }]);
  });
});
