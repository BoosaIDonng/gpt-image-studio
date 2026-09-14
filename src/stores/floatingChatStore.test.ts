import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFloatingChatStore } from "./floatingChatStore";
import { useSettingsStore } from "./settingsStore";
import type { ChatMessage } from "../services/floatingChatService";

const mocks = vi.hoisted(() => ({
  streamChatReply: vi.fn(),
}));

vi.mock("../services/floatingChatService", () => ({
  streamChatReply: mocks.streamChatReply,
  IMAGE_ASSISTANT_SYSTEM_PROMPT: "persona",
  isBuiltinChatAvailable: vi.fn(() => true),
  FLOATING_CHAT_UNCONFIGURED_MESSAGE:
    "内置 AI 助手需要先启动并配对本地 Companion：打开设置 → API 设置，启动 Companion 并完成配对后即可使用。",
}));

function configureCompanion() {
  const settings = useSettingsStore();
  settings.companionUrl = "http://127.0.0.1:19750";
  settings.companionSessionToken = "session-token";
}

describe("floating chat store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    configureCompanion();
  });

  it("sends the message through the builtin chat channel", async () => {
    const store = useFloatingChatStore();
    mocks.streamChatReply.mockImplementation(
      async (_messages: ChatMessage[], onDelta: (delta: string) => void) => {
        onDelta("收到");
        return "收到";
      },
    );

    store.input = "帮我改 prompt";
    await store.send();

    expect(mocks.streamChatReply).toHaveBeenCalledWith(
      [{ role: "user", content: "帮我改 prompt" }],
      expect.any(Function),
      "persona",
      expect.any(AbortSignal),
    );
    expect(store.messages).toEqual([
      { role: "user", content: "帮我改 prompt" },
      { role: "assistant", content: "收到" },
    ]);
  });

  it("keeps partial content when the request is aborted", async () => {
    const store = useFloatingChatStore();
    mocks.streamChatReply.mockImplementation(
      async (
        _messages: ChatMessage[],
        onDelta: (delta: string) => void,
        _persona: string,
        signal: AbortSignal,
      ) => {
        onDelta("部分");
        // Emulate the real abort path: the controller fires before rejecting.
        Object.defineProperty(signal, "aborted", { value: true });
        throw new Error("aborted");
      },
    );

    store.input = "帮我改 prompt";
    await store.send();

    expect(store.error).toBe("");
    expect(store.messages[1].content).toBe("部分");
  });

  it("caps the history sent upstream to the most recent turns", async () => {
    const store = useFloatingChatStore();
    mocks.streamChatReply.mockResolvedValue("好");

    for (let turn = 0; turn < 12; turn += 1) {
      store.input = `问题 ${turn}`;
      await store.send();
    }

    const sentMessages = mocks.streamChatReply.mock.lastCall?.[0] as ChatMessage[];
    expect(sentMessages.length).toBeLessThanOrEqual(16);
    expect(sentMessages.at(-1)?.content).toBe("问题 11");
  });
});
