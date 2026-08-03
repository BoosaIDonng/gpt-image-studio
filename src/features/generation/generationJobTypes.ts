import type { GenerationParams, GenerationRecipe, PromptRequestSettings } from "../../types/studio";

export type GenerationJobStatus = "pending" | "success" | "error" | "cancelled";

export type GenerationJob = {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  prompt: string;
  referencedImageIds: string[];
  editSourceImageId?: string;
  editMaskImageId?: string;
  generationParams: GenerationParams;
  generationRecipe: GenerationRecipe;
  promptRequestSettings: PromptRequestSettings;
  batchImageCount?: number;
  status: GenerationJobStatus;
  startedAtMs: number;
  finishedAtMs?: number;
  errorMessage?: string;
};
