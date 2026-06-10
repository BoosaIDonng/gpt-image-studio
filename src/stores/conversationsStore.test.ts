import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFeedbackStore } from "./feedbackStore";
import { useConversationsStore } from "./conversationsStore";
import type { Message } from "../types/studio";

const mocks = vi.hoisted(() => ({
  deleteConversation: vi.fn(),
  deleteMessage: vi.fn(),
  saveConversation: vi.fn(),
}));

vi.mock("../services/conversations", () => ({
  deleteConversation: mocks.deleteConversation,
  saveConversation: mocks.saveConversation,
}));

vi.mock("../services/messages", () => ({
  deleteMessage: mocks.deleteMessage,
}));

describe("conversations store single-message management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it("deletes only the selected message and keeps the rest of the thread", async () => {
    const store = useConversationsStore();
    const refreshStorageUsage = vi.fn();
    store.configureConversationsStore({
      clearDraft: vi.fn(),
      onStorageError: vi.fn(),
      refreshStorageUsage,
    });
    store.messages = [
      message({ id: "m1", content: "first prompt" }),
      message({ id: "m2", content: "second prompt" }),
      message({ id: "m3", content: "assistant result", role: "assistant" }),
    ];

    const feedback = useFeedbackStore();
    vi.spyOn(feedback, "requestConfirmation").mockResolvedValue(true);
    const notifySuccess = vi
      .spyOn(feedback, "notifySuccess")
      .mockImplementation(() => undefined);

    await store.deleteSingleMessage("m2");

    expect(store.messages.map((item) => item.id)).toEqual(["m1", "m3"]);
    expect(mocks.deleteMessage).toHaveBeenCalledWith("m2");
    expect(refreshStorageUsage).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalledWith("消息已删除。");
  });

  it("does not delete a message when the confirmation is cancelled", async () => {
    const store = useConversationsStore();
    store.configureConversationsStore({
      clearDraft: vi.fn(),
      onStorageError: vi.fn(),
      refreshStorageUsage: vi.fn(),
    });
    store.messages = [
      message({ id: "m1", content: "first prompt" }),
      message({ id: "m2", content: "second prompt" }),
    ];

    const feedback = useFeedbackStore();
    vi.spyOn(feedback, "requestConfirmation").mockResolvedValue(false);

    await store.deleteSingleMessage("m1");

    expect(store.messages.map((item) => item.id)).toEqual(["m1", "m2"]);
    expect(mocks.deleteMessage).not.toHaveBeenCalled();
  });
});

function message(input: {
  id: string;
  content: string;
  role?: Message["role"];
}): Message {
  return {
    id: input.id,
    conversationId: "c1",
    role: input.role ?? "user",
    content: input.content,
    referencedImageIds: [],
    resultImageIds: [],
    status: "success",
    createdAt: "2026-06-08T00:00:00.000Z",
  };
}
