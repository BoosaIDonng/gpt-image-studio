import { defineStore } from "pinia";
import type { ComputedRef, Ref } from "vue";
import { computed, ref, shallowRef, watch } from "vue";
import type { GenerationJob } from "../features/generation/generationJobTypes";
import type { ImageClient } from "../features/generation/imageClients/imageClient";
import { normalizeImageCount } from "../services/generationParams";
import { runWithConcurrency } from "../shared/concurrency";
import { isNetworkError, isSafeToAutoRetry } from "../services/networkRetry";
import { matchPromptWordbankTerms } from "../services/promptWordbankMatcher";
import { recordWordbankTermHits } from "../services/wordbankWeights";
import {
  deleteImageAsset,
  deleteImageBlob,
  loadImageBlob,
  saveImageAsset,
  saveImageBlob,
} from "../services/imageAssets";
import { decodeBase64Image } from "../services/imageDecode";
import { readImageDimensions } from "../services/imageMetadata";
import { expandPrompt } from "../services/promptExpander";
import { saveMessage } from "../services/messages";
import { isoTimestamp, timestampFromCreatedAt } from "../shared/dateTime";
import { formatError, isApiConfigurationError } from "../shared/errors";
import { createId } from "../shared/id";
import { createObjectUrl, revokeObjectUrl } from "../shared/objectUrls";
import { analyzeModerationRejection, formatModerationAdvice } from "../services/moderationAdvice";
import {
  continuedGenerationLabel,
  filenameFromAsset,
  handleBeforeUnload,
  outputFormatToMimeType,
  pendingGenerationLabel,
  pendingResultLabel,
  resultCountLabel,
  titleFromPrompt,
  toPlainImageAsset,
  toPlainMessage,
} from "./generationStoreUtils";
import type {
  Conversation,
  GenerationParams,
  GenerationRecipe,
  ImageAsset,
  Message,
  PromptRequestSettings,
} from "../types/studio";

type CreateConversationRecordInput = {
  title: string;
  summary: string;
  updatedAt: string;
};

type GenerationStoreContext = {
  activeConversationId: Ref<string>;
  activeConversation: ComputedRef<Conversation | undefined>;
  attachedImages: Ref<string[]>;
  activeEditMaskImageId: Ref<string>;
  activeEditSourceImageId: Ref<string>;
  composerText: Ref<string>;
  createConversationRecord: (input: CreateConversationRecordInput) => Promise<Conversation>;
  currentGenerationParams: () => GenerationParams;
  currentGenerationRecipe?: () => GenerationRecipe;
  currentPromptRequestSettings: (prompt?: string) => PromptRequestSettings;
  customSizeError: ComputedRef<string>;
  imageAssets: Ref<ImageAsset[]>;
  imageById: (id: string) => ImageAsset | undefined;
  imageClient: ImageClient;
  promptExpandEnabled: Ref<boolean>;
  chatApiKey: Ref<string>;
  chatApiBaseUrl: Ref<string>;
  chatModel: Ref<string>;
  chatSystemPrompt: Ref<string>;
  messages: Ref<Message[]>;
  onApiConfigurationError?: (error: unknown) => void;
  onStorageError: (error: unknown) => void;
  conversationExists: (id: string) => boolean;
  persistConversation: (conversation: Conversation) => Promise<void>;
  refreshStorageUsage: () => Promise<void>;
  updateConversationSummary: (
    conversationId: string,
    text: string,
    summary: string,
    updatedAt?: string,
  ) => Conversation | null;
};

export const useGenerationStore = defineStore("generation", () => {
  /** Concurrent requests per message batch; higher values trigger upstream 429s whose backoff makes total time worse. */
  const GENERATION_CONCURRENCY = 3;
  const jobs = shallowRef<GenerationJob[]>([]);
  const partialPreviewUrls = ref<Record<string, string>>({});
  /** Coalescing state for streamed partial previews: only the newest frame decodes. */
  const partialPreviewDecodes = new Map<string, { busy: boolean; latest?: string }>();
  let context: GenerationStoreContext | null = null;
  const messageSaveQueues = new Map<string, Promise<unknown>>();
  const requestControllers = new Map<string, AbortController>();

  type ExpandPreview = {
    originalPrompt: string;
    expandedPrompt: string;
    onConfirm: (action: "custom" | "original" | "cancel", text?: string) => void;
  };
  const expandPreview = ref<ExpandPreview | null>(null);
  const isExpanding = ref(false);

  const input = computed(() => getContext());
  const pendingJobCount = computed(
    () => jobs.value.filter((job) => job.status === "pending").length,
  );
  const isGenerating = computed(() => pendingJobCount.value > 0);
  const activeConversationPendingJobs = computed(() =>
    jobs.value.filter(
      (job) =>
        job.status === "pending" && job.conversationId === input.value.activeConversationId.value,
    ),
  );
  const pendingJobCountByConversation = computed(() => {
    const counts: Record<string, number> = {};
    jobs.value.forEach((job) => {
      if (job.status !== "pending") return;
      counts[job.conversationId] = (counts[job.conversationId] ?? 0) + 1;
    });
    return counts;
  });
  const imageModeLabel = computed(() =>
    input.value.activeEditMaskImageId.value && input.value.activeEditSourceImageId.value
      ? "局部编辑"
      : input.value.attachedImages.value.length
        ? "引用图片编辑"
        : "文字生成图片",
  );
  const canSend = computed(
    () =>
      !input.value.customSizeError.value &&
      Boolean(input.value.composerText.value.trim() || input.value.attachedImages.value.length),
  );
  let hasBeforeUnloadListener = false;

  watch(
    pendingJobCount,
    (count) => {
      if (typeof window === "undefined") return;

      if (count > 0 && !hasBeforeUnloadListener) {
        window.addEventListener("beforeunload", handleBeforeUnload);
        hasBeforeUnloadListener = true;
      } else if (count === 0 && hasBeforeUnloadListener) {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        hasBeforeUnloadListener = false;
      }
    },
    { immediate: true },
  );

  async function submitMessage() {
    if (!canSend.value || isExpanding.value) return;

    const ctx = input.value;
    const rawText = ctx.composerText.value.trim() || "基于引用图片继续编辑。";
    const prompt = await promptAfterExpansionPreview(rawText, ctx);
    if (!prompt) return;

    doSubmit(prompt);
  }

  async function promptAfterExpansionPreview(rawText: string, ctx: GenerationStoreContext) {
    if (!canExpandPrompt(ctx)) return rawText;

    const expanded = await expandPromptOrOriginal(rawText, ctx);
    if (expanded === rawText) return rawText;

    return waitForExpandPreviewChoice(rawText, expanded);
  }

  function canExpandPrompt(ctx: GenerationStoreContext) {
    return Boolean(
      ctx.promptExpandEnabled.value &&
      ctx.chatApiKey.value &&
      ctx.chatApiBaseUrl.value &&
      ctx.chatModel.value,
    );
  }

  async function expandPromptOrOriginal(rawText: string, ctx: GenerationStoreContext) {
    isExpanding.value = true;
    try {
      return await expandPrompt(rawText, {
        chatApiKey: ctx.chatApiKey.value,
        chatApiBaseUrl: ctx.chatApiBaseUrl.value,
        chatModel: ctx.chatModel.value,
        chatSystemPrompt: ctx.chatSystemPrompt.value,
      });
    } catch (error) {
      console.error("[expand] failed:", error);
      return rawText;
    } finally {
      isExpanding.value = false;
    }
  }

  function waitForExpandPreviewChoice(rawText: string, expanded: string) {
    return new Promise<string | null>((resolve) => {
      expandPreview.value = {
        originalPrompt: rawText,
        expandedPrompt: expanded,
        onConfirm: (action, customText) => {
          expandPreview.value = null;
          if (action === "custom" && customText) resolve(customText);
          else if (action === "original") resolve(rawText);
          else resolve(null);
        },
      };
    });
  }

  async function doSubmit(text: string) {
    const now = Date.now();
    const createdAt = isoTimestamp(now);
    const conversation =
      input.value.activeConversation.value ??
      (await input.value.createConversationRecord({
        title: titleFromPrompt(text),
        summary: imageModeLabel.value,
        updatedAt: createdAt,
      }));
    const conversationId = conversation.id;
    const editMaskImageId = input.value.activeEditMaskImageId.value || undefined;
    const references = input.value.attachedImages.value.filter((id) => id !== editMaskImageId);
    const editSourceImageId = input.value.activeEditSourceImageId.value || undefined;
    const generationParams = input.value.currentGenerationParams();
    const generationRecipe = currentGenerationRecipe();
    const imageCount = normalizeImageCount(generationParams.imageCount);
    const promptRequestSettings = input.value.currentPromptRequestSettings(text);
    const userMessage: Message = {
      id: createId("m"),
      conversationId,
      role: "user",
      content: text,
      referencedImageIds: references,
      resultImageIds: [],
      status: "success",
      createdAt,
      generationParams,
      generationRecipe,
      promptRequestSettings,
    };
    const assistantMessage: Message = {
      id: createId("m"),
      conversationId,
      role: "assistant",
      content: pendingGenerationLabel(references.length > 0, imageCount),
      referencedImageIds: references,
      resultImageIds: [],
      status: "pending",
      createdAt: isoTimestamp(now + 1),
      generationStartedAt: createdAt,
      generationParams,
      generationRecipe,
      promptRequestSettings,
      editSourceImageId,
      editMaskImageId,
    };

    clearPartialPreview(assistantMessage.id);
    input.value.messages.value = [...input.value.messages.value, userMessage, assistantMessage];
    const updatedConversation = input.value.updateConversationSummary(
      conversationId,
      text,
      imageModeLabel.value,
      createdAt,
    );
    input.value.composerText.value = "";
    input.value.attachedImages.value = [];
    input.value.activeEditSourceImageId.value = "";
    input.value.activeEditMaskImageId.value = "";

    await Promise.all([
      saveMessage(toPlainMessage(userMessage)),
      saveMessage(toPlainMessage(assistantMessage)),
      updatedConversation
        ? input.value.persistConversation(updatedConversation)
        : Promise.resolve(),
    ]).catch(input.value.onStorageError);
    const createdJobs = createJobs(
      {
        assistantMessageId: assistantMessage.id,
        conversationId,
        generationParams:
          assistantMessage.generationParams ?? input.value.currentGenerationParams(),
        generationRecipe: assistantMessage.generationRecipe ?? currentGenerationRecipe(),
        promptRequestSettings:
          assistantMessage.promptRequestSettings ?? input.value.currentPromptRequestSettings(text),
        prompt: text,
        referencedImageIds: references,
        editSourceImageId,
        editMaskImageId,
        userMessageId: userMessage.id,
      },
      imageCount,
    );
    runImageRequests(createdJobs);
  }

  async function retryMessage(message: Message, promptOverride?: string) {
    const generationParams = message.generationParams ?? input.value.currentGenerationParams();
    const generationRecipe = message.generationRecipe ?? currentGenerationRecipe();
    const imageCount = normalizeImageCount(generationParams.imageCount);
    message.status = "pending";
    message.generationStartedAt = isoTimestamp();
    message.content = pendingGenerationLabel(message.referencedImageIds.length > 0, imageCount);
    message.errorMessage = undefined;
    clearPartialPreview(message.id);
    await saveMessage(toPlainMessage(message)).catch(input.value.onStorageError);

    const userMessage = findSourceUserMessage(message);

    if (userMessage) {
      const prompt = promptOverride?.trim() || userMessage.content;
      const promptRequestSettings = promptOverride?.trim()
        ? input.value.currentPromptRequestSettings(prompt)
        : (message.promptRequestSettings ??
          input.value.currentPromptRequestSettings(userMessage.content));

      await runImageRequests(
        createJobs(
          {
            assistantMessageId: message.id,
            conversationId: message.conversationId,
            generationParams,
            generationRecipe,
            promptRequestSettings,
            prompt,
            referencedImageIds: message.referencedImageIds,
            editSourceImageId: message.editSourceImageId,
            editMaskImageId: message.editMaskImageId,
            userMessageId: userMessage.id,
          },
          imageCount,
        ),
      );
    }
  }

  async function generateAnother(message: Message) {
    await rerunMessageGeneration(message, {
      imageCount: 1,
      replaceImageId: undefined,
    });
  }

  async function refreshGeneratedImage(message: Message, imageId: string) {
    if (!message.resultImageIds.includes(imageId)) return;

    const image = input.value.imageById(imageId);
    input.value.imageAssets.value = input.value.imageAssets.value.filter(
      (item) => item.id !== imageId,
    );
    message.resultImageIds = message.resultImageIds.filter((item) => item !== imageId);
    await Promise.all([
      image ? deleteImageAsset(image.id) : Promise.resolve(),
      image?.blobKey ? deleteImageBlob(image.blobKey) : Promise.resolve(),
      enqueueMessageSave(message),
    ]).catch(input.value.onStorageError);
    await input.value.refreshStorageUsage();

    await rerunMessageGeneration(message, { replaceImageId: imageId });
  }

  async function rerunMessageGeneration(
    message: Message,
    options: { imageCount?: number; replaceImageId?: string | undefined },
  ) {
    const userMessage = findSourceUserMessage(message);
    if (!userMessage) return;

    const generationParams = message.generationParams ?? input.value.currentGenerationParams();
    const generationRecipe = message.generationRecipe ?? currentGenerationRecipe();
    const imageCount = options.replaceImageId
      ? 1
      : normalizeImageCount(options.imageCount ?? generationParams.imageCount);

    message.status = "pending";
    message.generationStartedAt = isoTimestamp();
    message.content = continuedGenerationLabel(
      message.referencedImageIds.length > 0,
      Boolean(options.replaceImageId),
      imageCount,
    );
    message.errorMessage = undefined;
    clearPartialPreview(message.id);
    replaceMessage(message);
    await enqueueMessageSave(message).catch(input.value.onStorageError);

    await runImageRequests(
      createJobs(
        {
          assistantMessageId: message.id,
          conversationId: message.conversationId,
          generationParams,
          generationRecipe,
          promptRequestSettings:
            message.promptRequestSettings ??
            input.value.currentPromptRequestSettings(userMessage.content),
          prompt: userMessage.content,
          referencedImageIds: message.referencedImageIds,
          editSourceImageId: message.editSourceImageId,
          editMaskImageId: message.editMaskImageId,
          userMessageId: userMessage.id,
        },
        imageCount,
      ),
    );
  }

  async function runImageRequest(job: GenerationJob, signal: AbortSignal) {
    try {
      const params = job.generationParams;
      const onPartialImage = (event: { b64Json: string }) => {
        const assistantMessage = findMessage(job.assistantMessageId);
        if (!assistantMessage || assistantMessage.status !== "pending") return;

        // Streaming sends many intermediate frames; coalesce decodes so only
        // the newest frame is processed and the main thread stays free.
        schedulePartialPreview(
          job.assistantMessageId,
          event.b64Json,
          outputFormatToMimeType(params.outputFormat),
        );
      };
      const imageResults = job.referencedImageIds.length
        ? await requestImageEdit(
            job.prompt,
            job.referencedImageIds,
            params,
            job.promptRequestSettings,
            job.editSourceImageId,
            job.editMaskImageId,
            (retryAttempt) => updateMessageNetworkRetry(job.assistantMessageId, retryAttempt),
            onPartialImage,
            job.generationRecipe,
            signal,
          )
        : await requestImageGeneration(job, params, onPartialImage, signal);
      if (signal.aborted) return;
      const resultList = Array.isArray(imageResults) ? imageResults : [imageResults];
      recordWordbankHitsForJob(job, resultList);
      const now = Date.now();
      const generationDurationMs = Math.max(0, now - job.startedAtMs);
      const savedImages = await Promise.all(
        resultList.map((imageResult) =>
          buildGeneratedImageAsset(job, imageResult, params, generationDurationMs),
        ),
      );

      input.value.imageAssets.value = [
        ...savedImages.map(({ imageAsset }) => imageAsset),
        ...input.value.imageAssets.value,
      ];
      markJobSuccess(job.id);
      let assistantMessage: Message | undefined;
      savedImages.forEach(({ imageAsset }) => {
        assistantMessage = applyJobAggregateToMessage(job, {
          imageId: imageAsset.id,
        });
      });

      const saveTasks: Promise<unknown>[] = [
        ...savedImages.flatMap(({ blob, imageAsset }) => [
          saveImageBlob(imageAsset.blobKey, blob),
          saveImageAsset(toPlainImageAsset(imageAsset)),
        ]),
      ];
      if (assistantMessage) {
        saveTasks.push(enqueueMessageSave(assistantMessage));
      }
      await Promise.all(saveTasks);
    } catch (error) {
      if (signal.aborted) return;
      const rawMessage = formatError(error);
      // Distinguish "the upstream rejected the request" (auto-retried) from
      // "the connection dropped mid-flight" (outcome unknown, may have been
      // billed) — the latter is surfaced to the user instead of retried.
      const unconfirmedOutcome = isNetworkError(error) && !isSafeToAutoRetry(error);
      const baseMessage = unconfirmedOutcome
        ? `${rawMessage}\n\n连接中断，结果未知：请求可能已到达上游并开始计费，可稍后手动重试。`
        : rawMessage;
      const moderationAdvice = formatModerationAdvice(
        analyzeModerationRejection(rawMessage, job.prompt),
      );
      const message = moderationAdvice ? `${baseMessage}\n\n${moderationAdvice}` : baseMessage;
      if (isApiConfigurationError(error)) {
        input.value.onApiConfigurationError?.(error);
      }
      markJobError(job.id, message);
      const assistantMessage = applyJobAggregateToMessage(job, {
        errorMessage: message,
      });
      if (assistantMessage) {
        await enqueueMessageSave(assistantMessage).catch((saveError: unknown) => {
          console.error("[generation] 保存失败消息到 IndexedDB 失败", saveError);
          input.value.onStorageError(saveError);
        });
      }
    }
  }

  function requestImageGeneration(
    job: GenerationJob,
    params: GenerationParams,
    onPartialImage: (event: { b64Json: string }) => void,
    signal: AbortSignal,
  ) {
    const commonInput = {
      prompt: job.prompt,
      params,
      promptRequestSettings: job.promptRequestSettings,
      recipe: job.generationRecipe,
      signal,
      onNetworkRetry: (retryAttempt: number) =>
        updateMessageNetworkRetry(job.assistantMessageId, retryAttempt),
      onPartialImage,
    };

    if (
      job.batchImageCount &&
      job.batchImageCount > 1 &&
      input.value.imageClient.canGenerateBatch?.(commonInput) &&
      input.value.imageClient.generateBatch
    ) {
      return input.value.imageClient.generateBatch({
        ...commonInput,
        count: job.batchImageCount,
      });
    }

    return input.value.imageClient.generate(commonInput);
  }

  async function buildGeneratedImageAsset(
    job: GenerationJob,
    imageResult: {
      b64Json: string;
      requestPrompt?: string;
      revisedPrompt?: string;
      mimeType?: string;
    },
    params: GenerationParams,
    generationDurationMs: number,
  ): Promise<{ blob: Blob; imageAsset: ImageAsset & { blobKey: string } }> {
    const createdAt = isoTimestamp();
    const mimeType = imageResult.mimeType ?? outputFormatToMimeType(params.outputFormat);
    // Worker-offloaded decode: base64 → Blob + pixel dimensions in one round trip.
    const { blob, dimensions } = await decodeBase64Image(imageResult.b64Json, mimeType);
    const blobKey = createId("blob");
    const imageAsset: ImageAsset & { blobKey: string } = {
      id: createId("img"),
      blobKey,
      name: titleFromPrompt(job.prompt),
      source: "generated",
      mimeType,
      width: dimensions?.width,
      height: dimensions?.height,
      sizeBytes: blob.size,
      conversationId: input.value.conversationExists(job.conversationId)
        ? job.conversationId
        : undefined,
      messageId: hasMessage(job.assistantMessageId) ? job.assistantMessageId : undefined,
      prompt: job.prompt,
      requestPrompt: imageResult.requestPrompt,
      revisedPrompt: imageResult.revisedPrompt,
      referencedImageIds: job.referencedImageIds,
      editSourceImageId: job.editSourceImageId,
      generationDurationMs,
      generationRecipe: { ...job.generationRecipe, params: { ...job.generationRecipe.params } },
      createdAt,
      updatedAt: createdAt,
      previewUrl: createObjectUrl(blob),
    };

    return { blob, imageAsset };
  }

  async function requestImageEdit(
    prompt: string,
    references: string[],
    params: GenerationParams,
    promptRequestSettings: PromptRequestSettings,
    editSourceImageId?: string,
    editMaskImageId?: string,
    onNetworkRetry?: (retryAttempt: number) => void,
    onPartialImage?: (event: { b64Json: string }) => void,
    recipe?: GenerationRecipe,
    signal?: AbortSignal,
  ) {
    const imageSources = await Promise.all(
      references.map(async (id) => {
        const reference = input.value.imageById(id);
        if (!reference) {
          throw new Error("引用图片不存在，请重新添加引用。");
        }
        const blob = await resolveImageBlob(reference);
        if (!blob) {
          throw new Error("无法读取引用图片文件，请重新生成或导入图片。");
        }

        return {
          id,
          blob,
          name: filenameFromAsset(reference),
        };
      }),
    );

    const totalBytes = imageSources.reduce((sum, img) => sum + img.blob.size, 0);
    const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024;
    if (totalBytes > MAX_PAYLOAD_BYTES) {
      const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
      throw new Error(
        `引用图片总大小为 ${totalMB}MB，超过 20MB 上限。请减少图片数量或压缩图片后重试。`,
      );
    }

    const sourceImage = editSourceImageId ? input.value.imageById(editSourceImageId) : undefined;
    const maskImage = editMaskImageId ? input.value.imageById(editMaskImageId) : undefined;
    let maskBlob: Blob | undefined;
    if (maskImage) {
      maskBlob = await resolveImageBlob(maskImage);
      if (!maskBlob) {
        throw new Error("无法读取编辑遮罩文件，请重新选择编辑区域。");
      }
      if (maskBlob.type !== "image/png") {
        throw new Error("编辑遮罩必须是 PNG 文件，请重新选择编辑区域。");
      }
    }

    const editImages = editSourceImageId
      ? imageSources.filter((image) => image.id === editSourceImageId)
      : imageSources;
    if (editSourceImageId && !editImages.length) {
      throw new Error("编辑源图不在当前引用列表中，请重新选择继续编辑。");
    }
    if (editMaskImageId && !maskImage) {
      throw new Error("编辑遮罩不存在，请重新选择编辑区域。");
    }
    if (editMaskImageId && !editSourceImageId) {
      throw new Error("缺少编辑源图，无法使用局部编辑。");
    }
    if (maskBlob && sourceImage) {
      const sourceBlob = await resolveImageBlob(sourceImage);
      if (!sourceBlob) {
        throw new Error("无法读取编辑源图，请重新引用图片。");
      }
      const [sourceSize, maskSize] = await Promise.all([
        readImageDimensions(sourceBlob),
        readImageDimensions(maskBlob),
      ]);
      if (
        sourceSize &&
        maskSize &&
        (sourceSize.width !== maskSize.width || sourceSize.height !== maskSize.height)
      ) {
        throw new Error("编辑遮罩尺寸与源图不一致，请重新选择编辑区域。");
      }
    }

    if (maskBlob) {
      console.info(
        "[generation] edit with mask",
        JSON.stringify({
          prompt: prompt.slice(0, 80),
          sourceImageId: editSourceImageId,
          maskImageId: editMaskImageId,
          referenceCount: references.length,
          sentImageCount: (editImages.length ? editImages : imageSources).length,
        }),
      );
    }

    return input.value.imageClient.edit({
      prompt,
      params,
      promptRequestSettings,
      images: (editImages.length ? editImages : imageSources).map((item) => ({
        blob: item.blob,
        name: item.name,
      })),
      mask: maskBlob
        ? {
            blob: maskBlob,
            name: "mask.png",
          }
        : undefined,
      onNetworkRetry,
      onPartialImage,
      recipe,
      signal,
    });
  }

  function updateMessageNetworkRetry(messageId: string, retryAttempt: number) {
    const assistantMessage = findMessage(messageId);
    if (!assistantMessage || assistantMessage.status !== "pending") return;

    assistantMessage.networkRetryAttempt = retryAttempt;
    replaceMessage(assistantMessage);
  }

  function replaceMessage(message: Message) {
    input.value.messages.value = input.value.messages.value.map((item) =>
      item.id === message.id ? { ...message } : item,
    );
  }

  function findMessage(messageId: string) {
    return input.value.messages.value.find((item) => item.id === messageId);
  }

  function findSourceUserMessage(message: Message) {
    return [...input.value.messages.value]
      .reverse()
      .find(
        (item) =>
          item.conversationId === message.conversationId &&
          item.role === "user" &&
          timestampFromCreatedAt(item) <= timestampFromCreatedAt(message),
      );
  }

  function hasMessage(messageId: string) {
    return Boolean(findMessage(messageId));
  }

  async function resolveImageBlob(image?: ImageAsset) {
    if (!image) return undefined;
    if (image.transientBlob) return image.transientBlob;
    if (!image.blobKey) return undefined;
    return loadImageBlob(image.blobKey);
  }

  function configureGenerationStore(nextContext: GenerationStoreContext) {
    context = nextContext;
  }

  function updatePartialPreview(messageId: string, blob: Blob) {
    const nextUrl = createObjectUrl(blob);
    const previousUrl = partialPreviewUrls.value[messageId];
    if (previousUrl) {
      revokeObjectUrl(previousUrl);
    }
    partialPreviewUrls.value = {
      ...partialPreviewUrls.value,
      [messageId]: nextUrl,
    };
  }

  function schedulePartialPreview(messageId: string, b64Json: string, mimeType: string) {
    let state = partialPreviewDecodes.get(messageId);
    if (!state) {
      state = { busy: false };
      partialPreviewDecodes.set(messageId, state);
    }
    if (state.busy) {
      state.latest = b64Json;
      return;
    }

    state.busy = true;
    void decodeBase64Image(b64Json, mimeType)
      .then(({ blob }) => {
        const message = findMessage(messageId);
        if (message?.status === "pending") updatePartialPreview(messageId, blob);
      })
      .catch(() => undefined)
      .finally(() => {
        state.busy = false;
        if (state.latest) {
          const next = state.latest;
          state.latest = undefined;
          schedulePartialPreview(messageId, next, mimeType);
        }
      });
  }

  function clearPartialPreview(messageId: string) {
    partialPreviewDecodes.delete(messageId);
    const previousUrl = partialPreviewUrls.value[messageId];
    if (!previousUrl) return;

    revokeObjectUrl(previousUrl);
    const { [messageId]: _removed, ...rest } = partialPreviewUrls.value;
    partialPreviewUrls.value = rest;
  }

  function getPartialPreviewUrl(messageId: string) {
    return partialPreviewUrls.value[messageId];
  }

  function createJob(
    jobInput: Omit<GenerationJob, "id" | "status" | "startedAtMs">,
  ): GenerationJob {
    const job: GenerationJob = {
      id: createId("job"),
      status: "pending",
      startedAtMs: Date.now(),
      ...jobInput,
    };
    jobs.value = [...jobs.value, job];
    return job;
  }

  function createJobs(
    jobInput: Omit<GenerationJob, "id" | "status" | "startedAtMs">,
    count: number,
  ) {
    const imageCount = normalizeImageCount(count);
    if (canBatchGenerate(jobInput, imageCount)) {
      return [
        createJob({
          ...jobInput,
          batchImageCount: imageCount,
        }),
      ];
    }

    return Array.from({ length: imageCount }, () => createJob(jobInput));
  }

  function canBatchGenerate(
    jobInput: Omit<GenerationJob, "id" | "status" | "startedAtMs">,
    count: number,
  ) {
    return (
      count > 1 &&
      jobInput.referencedImageIds.length === 0 &&
      !jobInput.editSourceImageId &&
      !jobInput.editMaskImageId &&
      Boolean(
        input.value.imageClient.canGenerateBatch?.({
          prompt: jobInput.prompt,
          params: jobInput.generationParams,
          promptRequestSettings: jobInput.promptRequestSettings,
          recipe: jobInput.generationRecipe,
        }),
      )
    );
  }

  async function runImageRequests(createdJobs: GenerationJob[]) {
    const messageId = createdJobs[0]?.assistantMessageId;
    if (!messageId) return;
    requestControllers.get(messageId)?.abort();
    const controller = new AbortController();
    requestControllers.set(messageId, controller);
    // Bounded concurrency instead of firing every request at once: unlimited
    // parallelism triggered 429s whose exponential backoff made total wall
    // time worse than a small gate. Queue progress is visible via the
    // message's pending label, which updates as each job settles.
    await runWithConcurrency(createdJobs, GENERATION_CONCURRENCY, (job) =>
      runImageRequest(job, controller.signal),
    );
    // Refresh storage usage once per batch instead of once per job.
    await input.value.refreshStorageUsage();
    if (requestControllers.get(messageId) === controller) requestControllers.delete(messageId);
  }

  /**
   * Persist which wordbank terms contributed to a successful generation
   * ("个人词库"): retrieval later boosts terms with a hit history.
   */
  function recordWordbankHitsForJob(
    job: GenerationJob,
    results: Array<{ requestPrompt?: string; revisedPrompt?: string }>,
  ) {
    const wordbanks = job.promptRequestSettings.promptWordbanks;
    if (!wordbanks) return;

    const terms: string[] = [];
    const prompts = [
      job.prompt,
      ...results.map((result) => result.requestPrompt ?? ""),
      ...results.map((result) => result.revisedPrompt ?? ""),
    ].filter(Boolean);

    for (const prompt of prompts) {
      try {
        matchPromptWordbankTerms({
          prompt,
          mode: "adult",
          wordbanks,
          seed: prompt,
        }).matchedTerms.forEach((term) => {
          if (!terms.includes(term)) terms.push(term);
        });
      } catch {
        // Best-effort: matching must never break a successful generation.
      }
    }

    if (terms.length) {
      void recordWordbankTermHits(terms).catch(() => undefined);
    }
  }

  function cancelMessageGeneration(messageId: string) {
    const controller = requestControllers.get(messageId);
    if (!controller) return;
    controller.abort();
    requestControllers.delete(messageId);
    jobs.value = jobs.value.map((job) =>
      job.assistantMessageId === messageId && job.status === "pending"
        ? { ...job, status: "cancelled", finishedAtMs: Date.now(), errorMessage: "已停止生成。" }
        : job,
    );
    const message = findMessage(messageId);
    if (!message) return;
    message.status = "error";
    message.content = "已停止生成。";
    message.errorMessage = "已停止生成，可重新尝试。";
    message.networkRetryAttempt = undefined;
    clearPartialPreview(messageId);
    replaceMessage(message);
    void enqueueMessageSave(message).catch(input.value.onStorageError);
  }

  function markJobSuccess(jobId: string) {
    const job = jobs.value.find((item) => item.id === jobId);
    if (!job) return;
    job.status = "success";
    job.finishedAtMs = Date.now();
    job.errorMessage = undefined;
    jobs.value = [...jobs.value];
  }

  function markJobError(jobId: string, errorMessage: string) {
    const job = jobs.value.find((item) => item.id === jobId);
    if (!job) return;
    job.status = "error";
    job.finishedAtMs = Date.now();
    job.errorMessage = errorMessage;
    jobs.value = [...jobs.value];
  }

  function applyJobAggregateToMessage(
    job: GenerationJob,
    update: { imageId?: string; errorMessage?: string },
  ) {
    const assistantMessage = findMessage(job.assistantMessageId);
    if (!assistantMessage) return undefined;

    if (update.imageId && !assistantMessage.resultImageIds.includes(update.imageId)) {
      assistantMessage.resultImageIds = [...assistantMessage.resultImageIds, update.imageId];
    }

    const siblingJobs = jobs.value.filter(
      (item) => item.assistantMessageId === job.assistantMessageId,
    );
    const pendingCount = siblingJobs.filter((item) => item.status === "pending").length;
    const hasGeneratedImages = assistantMessage.resultImageIds.length > 0;
    const failedCount = siblingJobs.filter((item) => item.status === "error").length;

    assistantMessage.networkRetryAttempt = undefined;
    if (pendingCount > 0) {
      assistantMessage.status = "pending";
      assistantMessage.content = pendingResultLabel(
        job.referencedImageIds.length > 0,
        assistantMessage.resultImageIds.length,
        pendingCount,
      );
      assistantMessage.errorMessage =
        failedCount > 0 ? `${failedCount} 张生成失败，其余仍在继续。` : undefined;
    } else if (hasGeneratedImages) {
      assistantMessage.status = "success";
      assistantMessage.content = job.referencedImageIds.length
        ? resultCountLabel("已基于引用图生成", assistantMessage.resultImageIds.length)
        : resultCountLabel("已生成", assistantMessage.resultImageIds.length);
      assistantMessage.errorMessage =
        failedCount > 0 ? `${failedCount} 张生成失败，已保留成功结果。` : undefined;
    } else {
      assistantMessage.status = "error";
      assistantMessage.content = "生成中断，请重试。";
      assistantMessage.errorMessage = update.errorMessage ?? "生成失败，请重试。";
    }

    if (pendingCount === 0) {
      clearPartialPreview(job.assistantMessageId);
    }

    replaceMessage(assistantMessage);
    return assistantMessage;
  }

  function enqueueMessageSave(message: Message) {
    const previousSave =
      messageSaveQueues.get(message.id)?.catch(() => undefined) ?? Promise.resolve();
    const saveTask = previousSave.then(() => {
      const latestMessage = findMessage(message.id) ?? message;
      return saveMessage(toPlainMessage(latestMessage));
    });
    messageSaveQueues.set(message.id, saveTask);
    void saveTask
      .finally(() => {
        if (messageSaveQueues.get(message.id) === saveTask) {
          messageSaveQueues.delete(message.id);
        }
      })
      .catch(() => undefined);

    return saveTask;
  }

  function getContext() {
    if (!context) {
      throw new Error("Generation store is not configured.");
    }

    return context;
  }

  function currentGenerationRecipe(): GenerationRecipe {
    const ctx = input.value;
    return (
      ctx.currentGenerationRecipe?.() ?? {
        connectionMode: "direct",
        apiProvider: "openai",
        apiBaseUrl: "",
        apiBaseUrlMode: "origin",
        apiMode: "images",
        model: "",
        params: ctx.currentGenerationParams(),
      }
    );
  }

  return {
    activeConversationPendingJobs,
    canSend,
    cancelMessageGeneration,
    configureGenerationStore,
    expandPreview,
    isExpanding,
    imageModeLabel,
    isGenerating,
    pendingJobCountByConversation,
    pendingJobCount,
    generateAnother,
    getPartialPreviewUrl,
    refreshGeneratedImage,
    retryMessage,
    submitMessage,
  };
});
