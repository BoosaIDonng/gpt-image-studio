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
  expandPrompt: vi.fn(),
  saveMessage: vi.fn(),
}));

vi.mock("../services/promptExpander", () => ({
  expandPrompt: mocks.expandPrompt,
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
        ragContext: prompt ? `RAG 参考内容：\n1. ${prompt} 的历史参考` : undefined,
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
      promptExpandEnabled: ref(false),
      chatApiKey: ref(""),
      chatApiBaseUrl: ref(""),
      chatModel: ref(""),
      chatSystemPrompt: ref(""),
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
          Promise.reject(new Error("HTTP 400：Generated image rejected by content moderation.")),
        ),
        edit: vi.fn(),
      },
      promptExpandEnabled: ref(false),
      chatApiKey: ref(""),
      chatApiBaseUrl: ref(""),
      chatModel: ref(""),
      chatSystemPrompt: ref(""),
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
    expect(messages.value[1]?.errorMessage).toContain("nsfw -> tasteful editorial style");
    expect(messages.value[1]?.errorMessage).toContain("fully clothed");
    const saferPromptText = messages.value[1]?.errorMessage?.split("\n").at(-1) ?? "";
    expect(saferPromptText).not.toMatch(/nsfw|nude|nipples/i);
  });

  it("retries a failed message with a safer prompt override", async () => {
    const store = useGenerationStore();
    const conversation: Conversation = {
      id: "c1",
      title: "Retry conversation",
      summary: "Image generation",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const userMessage: Message = {
      id: "m-user",
      conversationId: conversation.id,
      role: "user",
      content: "nsfw, completely nude, rain street portrait",
      referencedImageIds: [],
      resultImageIds: [],
      status: "success",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const assistantMessage: Message = {
      id: "m-assistant",
      conversationId: conversation.id,
      role: "assistant",
      content: "生成失败",
      referencedImageIds: [],
      resultImageIds: [],
      status: "error",
      createdAt: "2026-01-01T00:00:01.000Z",
      generationParams,
      errorMessage: "HTTP 400: Generated image rejected by content moderation.",
    };
    const messages = ref<Message[]>([userMessage, assistantMessage]);
    mocks.saveMessage.mockResolvedValue(undefined);
    const imageClient = {
      generate: vi.fn(() => Promise.reject(new Error("retry stop"))),
      edit: vi.fn(),
    };
    const currentPromptRequestSettings = vi.fn(
      (prompt?: string): PromptRequestSettings => ({
        promptMode: "default",
        promptWordbanks: defaultPromptWordbanks,
        promptRewriteGuardEnabled: false,
        promptRewriteGuardText: PROMPT_REWRITE_GUARD_PREFIX,
        ragContext: prompt ? `retry context: ${prompt}` : undefined,
      }),
    );

    store.configureGenerationStore({
      activeConversationId: ref(conversation.id),
      activeConversation: computed(() => conversation),
      attachedImages: ref([]),
      activeEditMaskImageId: ref(""),
      activeEditSourceImageId: ref(""),
      composerText: ref(""),
      createConversationRecord: vi.fn(),
      currentGenerationParams: () => generationParams,
      currentPromptRequestSettings,
      customSizeError: computed(() => ""),
      imageAssets: ref([]),
      imageById: () => undefined,
      imageClient,
      promptExpandEnabled: ref(false),
      chatApiKey: ref(""),
      chatApiBaseUrl: ref(""),
      chatModel: ref(""),
      chatSystemPrompt: ref(""),
      messages,
      onStorageError: vi.fn(),
      conversationExists: () => true,
      persistConversation: vi.fn(),
      refreshStorageUsage: vi.fn(),
      updateConversationSummary: vi.fn(() => conversation),
    });

    await store.retryMessage(assistantMessage, "fully clothed, rain street portrait");

    expect(imageClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "fully clothed, rain street portrait",
      }),
    );
    expect(currentPromptRequestSettings).toHaveBeenCalledWith(
      "fully clothed, rain street portrait",
    );
  });

  it("ignores a second submit while prompt expansion is still running", async () => {
    const store = useGenerationStore();
    const conversation: Conversation = {
      id: "c1",
      title: "会话",
      summary: "文字生成图片",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const messages = ref<Message[]>([]);
    const composerText = ref("画一张雨夜街景");
    const imageClient = {
      generate: vi.fn(() => new Promise<never>(() => undefined)),
      edit: vi.fn(),
    };
    const expandDeferred = createDeferred<string>();
    mocks.expandPrompt.mockReturnValue(expandDeferred.promise);

    store.configureGenerationStore({
      activeConversationId: ref(conversation.id),
      activeConversation: computed(() => conversation),
      attachedImages: ref([]),
      activeEditMaskImageId: ref(""),
      activeEditSourceImageId: ref(""),
      composerText,
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
      imageClient,
      promptExpandEnabled: ref(true),
      chatApiKey: ref("sk-chat"),
      chatApiBaseUrl: ref("https://chat.example.test"),
      chatModel: ref("chat-model"),
      chatSystemPrompt: ref(""),
      messages,
      onStorageError: vi.fn(),
      conversationExists: () => true,
      persistConversation: vi.fn(),
      refreshStorageUsage: vi.fn(),
      updateConversationSummary: vi.fn(() => conversation),
    });

    const firstSubmit = store.submitMessage();
    const secondSubmit = store.submitMessage();

    try {
      expect(mocks.expandPrompt).toHaveBeenCalledTimes(1);
    } finally {
      expandDeferred.resolve("画一张雨夜街景");
      await Promise.all([firstSubmit, secondSubmit]);
    }
    expect(imageClient.generate).toHaveBeenCalledTimes(1);
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}
