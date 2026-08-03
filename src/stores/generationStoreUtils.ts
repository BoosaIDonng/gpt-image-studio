import { clonePromptWordbanks } from "../services/promptWordbanks";
import type { GenerationParams, ImageAsset, Message } from "../types/studio";

export function handleBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}

export function titleFromPrompt(prompt: string) {
  return prompt.length > 16 ? `${prompt.slice(0, 16)}...` : prompt;
}

export function filenameFromAsset(asset: ImageAsset) {
  const extension =
    asset.mimeType === "image/jpeg" ? "jpeg" : asset.mimeType === "image/webp" ? "webp" : "png";

  return `${asset.name || asset.id}.${extension}`;
}

export function outputFormatToMimeType(outputFormat: GenerationParams["outputFormat"]) {
  return outputFormat === "jpeg" ? "image/jpeg" : `image/${outputFormat}`;
}

export function resultCountLabel(prefix: string, count: number) {
  return count > 1 ? `${prefix} ${count} 张图片。` : `${prefix}一张图片。`;
}

export function pendingGenerationLabel(isEdit: boolean, count: number) {
  if (isEdit) {
    return count > 1
      ? `正在基于引用图片生成 ${count} 张编辑结果。`
      : "正在基于引用图片生成编辑结果。";
  }

  return count > 1 ? `正在生成 ${count} 张图片。` : "正在生成图片。";
}

export function continuedGenerationLabel(isEdit: boolean, isReplacing: boolean, count: number) {
  if (isEdit) {
    if (isReplacing) return "正在重新生成编辑结果。";
    return count > 1 ? `正在继续生成 ${count} 张编辑结果。` : "正在继续生成编辑结果。";
  }

  if (isReplacing) return "正在重新生成图片。";
  return count > 1 ? `正在继续生成 ${count} 张图片。` : "正在继续生成图片。";
}

export function pendingResultLabel(isEdit: boolean, generatedCount: number, pendingCount: number) {
  const generatedPart = generatedCount > 0 ? `已生成 ${generatedCount} 张，` : "";
  const noun = isEdit ? "编辑结果" : "图片";
  return `${generatedPart}还有 ${pendingCount} 张${noun}正在生成。`;
}

export function toPlainMessage(message: Message): Message {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    referencedImageIds: [...message.referencedImageIds],
    resultImageIds: [...message.resultImageIds],
    status: message.status,
    createdAt: message.createdAt,
    generationStartedAt: message.generationStartedAt,
    generationParams: message.generationParams ? { ...message.generationParams } : undefined,
    generationRecipe: message.generationRecipe
      ? { ...message.generationRecipe, params: { ...message.generationRecipe.params } }
      : undefined,
    promptRequestSettings: message.promptRequestSettings
      ? {
          promptMode: message.promptRequestSettings.promptMode,
          promptWordbanks: clonePromptWordbanks(message.promptRequestSettings.promptWordbanks),
          promptRewriteGuardEnabled: message.promptRequestSettings.promptRewriteGuardEnabled,
          promptRewriteGuardText: message.promptRequestSettings.promptRewriteGuardText,
          ragContext: message.promptRequestSettings.ragContext,
        }
      : undefined,
    networkRetryAttempt: message.networkRetryAttempt,
    errorMessage: message.errorMessage,
    editSourceImageId: message.editSourceImageId,
    editMaskImageId: message.editMaskImageId,
  };
}

export function toPlainImageAsset(imageAsset: ImageAsset): ImageAsset {
  return {
    id: imageAsset.id,
    blobKey: imageAsset.blobKey,
    name: imageAsset.name,
    source: imageAsset.source,
    tagColor: imageAsset.tagColor,
    mimeType: imageAsset.mimeType,
    width: imageAsset.width,
    height: imageAsset.height,
    sizeBytes: imageAsset.sizeBytes,
    conversationId: imageAsset.conversationId,
    messageId: imageAsset.messageId,
    prompt: imageAsset.prompt,
    requestPrompt: imageAsset.requestPrompt,
    revisedPrompt: imageAsset.revisedPrompt,
    referencedImageIds: imageAsset.referencedImageIds
      ? [...imageAsset.referencedImageIds]
      : undefined,
    editSourceImageId: imageAsset.editSourceImageId,
    generationDurationMs: imageAsset.generationDurationMs,
    generationRecipe: imageAsset.generationRecipe
      ? { ...imageAsset.generationRecipe, params: { ...imageAsset.generationRecipe.params } }
      : undefined,
    isEditMask: imageAsset.isEditMask,
    createdAt: imageAsset.createdAt,
    updatedAt: imageAsset.updatedAt,
  };
}
