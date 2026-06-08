import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFloatingChatStore } from "./floatingChatStore";
import type { ChatMessage } from "../services/floatingChatService";

const mocks = vi.hoisted(() => ({
  streamChatReply: vi.fn(),
}));

vi.mock("../services/floatingChatService", () => ({
  streamChatReply: mocks.streamChatReply,
}));

describe("floating chat store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it("forwards hidden project context without storing it in visible messages", async () => {
    const store = useFloatingChatStore();
    const projectContext: ChatMessage = {
      role: "system",
      content: "项目上下文",
    };
    mocks.streamChatReply.mockImplementation(
      async (_messages: ChatMessage[], onDelta: (delta: string) => void) => {
        onDelta("收到");
        return "收到";
      },
    );

    store.input = "帮我改 prompt";
    await store.send(projectContext);

    expect(mocks.streamChatReply).toHaveBeenCalledWith(
      [{ role: "user", content: "帮我改 prompt" }],
      expect.any(Function),
      projectContext,
    );
    expect(store.messages).toEqual([
      { role: "user", content: "帮我改 prompt" },
      { role: "assistant", content: "收到" },
    ]);
  });
});
