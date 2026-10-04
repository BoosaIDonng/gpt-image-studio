import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChatReply, isBuiltinChatAvailable } from "./floatingChatService";
import { IMAGE_ASSISTANT_SYSTEM_PROMPT } from "./imageAssistantPrompt";

function streamResponse(text = "ok") {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe("floating chat service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the builtin relay by default so static-site visitors need no setup", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());

    await streamChatReply([{ role: "user", content: "帮我改 prompt" }], vi.fn());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://chat-relay.354561650.workers.dev/chat/completions");
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    const body = JSON.parse(String(init?.body));
    // Model and API key never leave the relay: the client sends messages only.
    expect(body.model).toBeUndefined();
    expect(body.api_key).toBeUndefined();
    expect(body.messages).toEqual([
      { role: "system", content: IMAGE_ASSISTANT_SYSTEM_PROMPT },
      { role: "user", content: "帮我改 prompt" },
    ]);
    expect(body.stream).toBe(true);
  });

  it("omits the system message when an empty system prompt is passed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());

    await streamChatReply([{ role: "user", content: "rewrite this" }], vi.fn(), "");

    const body = JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body));
    expect(body.messages).toEqual([{ role: "user", content: "rewrite this" }]);
  });

  it("reports availability through the builtin relay", () => {
    expect(isBuiltinChatAvailable()).toBe(true);
  });

  it("accepts an abort signal", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(streamResponse());
    const controller = new AbortController();

    await streamChatReply(
      [{ role: "user", content: "hi" }],
      vi.fn(),
      IMAGE_ASSISTANT_SYSTEM_PROMPT,
      controller.signal,
    );

    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});
