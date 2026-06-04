import type { ModelId } from "./types";

export const MODELS: ModelId[] = ["gpt-image-2", "nano-banana-pro"];

export const ASPECT_RATIOS: Record<ModelId, string[]> = {
  "gpt-image-2": ["1:1", "16:9", "9:16", "1024x1024", "2048x2048", "3840x2160"],
  "nano-banana-pro": ["1:1", "16:9", "9:16", "21:9", "4:3", "3:4", "3:2", "2:3"],
};

export function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && MODELS.includes(value as ModelId);
}

export function sanitizePrompt(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 4000);
}

export function parseReferenceIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 9);
}
