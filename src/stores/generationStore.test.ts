import { computed, ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROMPT_REWRITE_GUARD_PREFIX } from "../services/imagesApi";
import { defaultPromptWordbanks } from "../services/promptWordbanks";
import type {
  Conversation,
  GenerationParams,
  Message,
  PromptRequestSettings,
} from "../types/studio";
import { useGenerationStore } from "./generationStore";

const mocks = vi.hoisted(() => ({
  saveMessage: vi.fn(),
}));

vi.mock("../services/messages", () => ({
  saveMessage: mocks.saveMessage,
}));

const generationParams: GenerationParams = {
  size: "1:1",
  resolution: "1k",
  width: 1024,
  height: 1024,
  imageCount: 1,
  quality: "auto",
  background: "auto",
  outputFormat: "png",
};

describe("generation store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it("builds prompt request settings from the submitted prompt", async () => {
    const store = useGenerationStore();
    const conversation: Conversation = {
      id: "c1",
      title: "会话",
      summary: "文字生成图片",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const messages = ref<Message[]>([]);
    const currentPromptRequestSettings = vi.fn(
      (prompt?: string): PromptRequestSettings => ({
        promptMode: "default",
        promptWordbanks: defaultPromptWordbanks,
        promptRewriteGuardEnabled: false,
        promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
        ragContext: prompt
          ? `RAG 参考内容：\n1. ${prompt} 的历史参考`
          : undefined,
      }),
    );

    store.configureGenerationStore({
      activeConversationId: ref(conversation.id),
      activeConversation: computed(() => conversation),
      attachedImages: ref([]),
      activeEditMaskImageId: ref(""),
      activeEditSourceImageId: ref(""),
      composerText: ref("画一张雨夜街景"),
      createConversationRecord: vi.fn(),
      currentGenerationParams: () => generationParams,
      currentPromptRequestSettings,
      customSizeError: computed(() => ""),
      imageAssets: ref([]),
      imageById: () => undefined,
      imageClient: {
        generate: vi.fn(() => new Promise<never>(() => undefined)),
        edit: vi.fn(),
      },
      messages,
      onStorageError: vi.fn(),
      conversationExists: () => true,
      persistConversation: vi.fn(),
      refreshStorageUsage: vi.fn(),
      updateConversationSummary: vi.fn(() => conversation),
    });

    await store.submitMessage();

    expect(currentPromptRequestSettings).toHaveBeenCalledWith("画一张雨夜街景");
    expect(messages.value[0]?.promptRequestSettings?.ragContext).toContain(
      "画一张雨夜街景 的历史参考",
    );
    expect(messages.value[1]?.promptRequestSettings?.ragContext).toBe(
      messages.value[0]?.promptRequestSettings?.ragContext,
    );
    expect(mocks.saveMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        promptRequestSettings: expect.objectContaining({
          ragContext: expect.stringContaining("画一张雨夜街景 的历史参考"),
        }),
      }),
    );
  });

  it("adds moderation analysis and safer prompt advice to rejected generation errors", async () => {
    const store = useGenerationStore();
    const conversation: Conversation = {
      id: "c1",
      title: "会话",
      summary: "文字生成图片",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const messages = ref<Message[]>([]);

    store.configureGenerationStore({
      activeConversationId: ref(conversation.id),
      activeConversation: computed(() => conversation),
      attachedImages: ref([]),
      activeEditMaskImageId: ref(""),
      activeEditSourceImageId: ref(""),
      composerText: ref(
        "nsfw, completely nude, girl sitting on chair, cinematic rain street, detailed nipples",
      ),
      createConversationRecord: vi.fn(),
      currentGenerationParams: () => generationParams,
      currentPromptRequestSettings: (): PromptRequestSettings => ({
        promptMode: "default",
        promptWordbanks: defaultPromptWordbanks,
        promptRewriteGuardEnabled: false,
        promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
      }),
      customSizeError: computed(() => ""),
      imageAssets: ref([]),
      imageById: () => undefined,
      imageClient: {
        generate: vi.fn(() =>
          Promise.reject(
            new Error("HTTP 400：Generated image rejected by content moderation."),
          ),
        ),
        edit: vi.fn(),
      },
      messages,
      onStorageError: vi.fn(),
      conversationExists: () => true,
      persistConversation: vi.fn(),
      refreshStorageUsage: vi.fn(),
      updateConversationSummary: vi.fn(() => conversation),
    });

    await store.submitMessage();

    await vi.waitFor(() => {
      expect(messages.value[1]?.status).toBe("error");
    });
    expect(messages.value[1]?.errorMessage).toContain("可能触发内容审核的原因");
    expect(messages.value[1]?.errorMessage).toContain("建议改写");
    expect(messages.value[1]?.errorMessage).toContain("fully clothed");
    expect(messages.value[1]?.errorMessage).not.toMatch(/nsfw|nude|nipples/i);
  });
});
