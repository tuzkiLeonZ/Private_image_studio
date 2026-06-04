import type { GenerateInput, VisionaryResult } from "./types";

function getVisionaryConfig() {
  const apiKey = process.env.VISIONARY_API_KEY;
  const baseUrl = (process.env.VISIONARY_API_BASE_URL ?? "https://visionary.beer").replace(/\/+$/, "");

  if (!apiKey) {
    throw new Error("Missing VISIONARY_API_KEY. Create .env.local from .env.local.example and add your key.");
  }

  return { apiKey, baseUrl };
}

async function callVisionary(path: string, body: Record<string, unknown>): Promise<VisionaryResult> {
  const { apiKey, baseUrl } = getVisionaryConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  const result = responseText ? (tryParseJson(responseText) as VisionaryResult) : {};
  if (!response.ok) {
    throw new Error(`Visionary ${response.status}: ${extractErrorMessage(result, responseText, response.statusText)}`);
  }

  return result;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function extractErrorMessage(result: VisionaryResult, responseText: string, statusText: string) {
  if (typeof result.error === "string") return result.error;
  if (result.error?.message) return result.error.message;
  if (responseText && responseText.length < 500) return responseText;
  return statusText || "Image generation failed upstream.";
}

export async function generateWithVisionary(input: GenerateInput) {
  if (input.model === "gpt-image-2") {
    return callVisionary("/v1/api/generate", {
      model: "gpt-image-2",
      prompt: input.prompt,
      images: input.images,
      aspectRatio: input.aspectRatio,
      quality: input.quality ?? "auto",
      replyType: "json",
    });
  }

  return callVisionary("/v1/api/nano-banana", {
    model: "nano-banana-pro",
    prompt: input.prompt,
    images: input.images,
    aspectRatio: input.aspectRatio,
    imageSize: input.imageSize ?? "2K",
    optimizeChineseText: input.optimizeChineseText ?? false,
    replyType: "json",
  });
}
