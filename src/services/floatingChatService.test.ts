import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChatReply, type ChatMessage } from "./floatingChatService";

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

  it("prepends hidden project context before visible messages", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamResponse());
    const context: ChatMessage = {
      role: "user",
      content: "项目上下文",
    };

    await streamChatReply(
      [{ role: "user", content: "帮我改 prompt" }],
      vi.fn(),
      context,
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages).toEqual([
      context,
      { role: "user", content: "帮我改 prompt" },
    ]);
    expect(body.use_builtin_persona).toBe(true);
  });

  it("keeps the current payload shape when no project context is provided", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamResponse());

    await streamChatReply([{ role: "user", content: "你好" }], vi.fn());

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.messages).toEqual([{ role: "user", content: "你好" }]);
  });
});
