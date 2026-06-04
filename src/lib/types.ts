export type ModelId = "gpt-image-2" | "nano-banana-pro";

export type GenerateInput = {
  model: ModelId;
  prompt: string;
  images: string[];
  aspectRatio: string;
  quality?: "auto" | "low" | "medium" | "high";
  imageSize?: "2K" | "4K";
  optimizeChineseText?: boolean;
};

export type VisionaryResult = {
  id?: string;
  status?: string;
  results?: Array<{ url?: string }>;
  error?: string | { message?: string; type?: string; code?: string | null };
};
