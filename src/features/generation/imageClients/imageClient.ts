import type {
  GenerationParams,
  GenerationRecipe,
  PromptRequestSettings,
} from "../../../types/studio";

export type ImageEditSource = {
  blob: Blob;
  name: string;
};

export type GenerateImageInput = {
  prompt: string;
  params: GenerationParams;
  promptRequestSettings: PromptRequestSettings;
  onNetworkRetry?: (retryAttempt: number) => void;
  onPartialImage?: (event: PartialImageEvent) => void;
  onStatusText?: (text: string) => void;
  recipe?: GenerationRecipe;
  signal?: AbortSignal;
};

export type GenerateImageBatchInput = GenerateImageInput & {
  count: number;
};

export type EditImageInput = GenerateImageInput & {
  images: ImageEditSource[];
  mask?: ImageEditSource;
};

export type ImageClientResult = {
  b64Json: string;
  requestPrompt?: string;
  revisedPrompt?: string;
  mimeType?: string;
};

export type PartialImageEvent = {
  b64Json: string;
  partialImageIndex?: number;
};

export type ImageClient = {
  generate(input: GenerateImageInput): Promise<ImageClientResult>;
  generateBatch?(input: GenerateImageBatchInput): Promise<ImageClientResult[]>;
  canGenerateBatch?(input?: GenerateImageInput): boolean;
  edit(input: EditImageInput): Promise<ImageClientResult>;
};
