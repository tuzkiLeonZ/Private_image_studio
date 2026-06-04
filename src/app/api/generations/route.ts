import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fileToCompressedDataUri, saveRemoteGeneratedImage } from "@/lib/image-storage";
import { generateWithVisionary } from "@/lib/visionary-client";
import { ASPECT_RATIOS, isModelId, parseReferenceIds, sanitizePrompt } from "@/lib/validation";

export const runtime = "nodejs";

const generationInclude = {
  images: true,
  references: true,
} as const;

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function GET() {
  const generations = await prisma.generation.findMany({
    include: generationInclude,
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return NextResponse.json({ generations });
}

export async function POST(request: Request) {
  let generationId: string | undefined;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const model = body.model;
    const prompt = sanitizePrompt(body.prompt);
    const referenceImageIds = parseReferenceIds(body.referenceImageIds);
    const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio : "1:1";
    const quality = typeof body.quality === "string" ? body.quality : "auto";
    const imageSize = body.imageSize === "4K" ? "4K" : "2K";
    const optimizeChineseText = Boolean(body.optimizeChineseText);

    if (!isModelId(model)) {
      return NextResponse.json({ error: "Unsupported model." }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }
    if (!ASPECT_RATIOS[model].includes(aspectRatio)) {
      return NextResponse.json({ error: "Unsupported aspect ratio for this model." }, { status: 400 });
    }

    const references = referenceImageIds.length
      ? await prisma.referenceImage.findMany({ where: { id: { in: referenceImageIds } } })
      : [];

    if (references.length !== referenceImageIds.length) {
      return NextResponse.json({ error: "One or more reference images were not found." }, { status: 400 });
    }

    const referenceDataUris = await Promise.all(
      references.map((image) => fileToCompressedDataUri(image.localPath)),
    );

    const requestJson = {
      model,
      prompt,
      images: referenceDataUris.map((_, index) => `reference:${references[index].id}`),
      aspectRatio,
      quality: model === "gpt-image-2" ? quality : undefined,
      imageSize: model === "nano-banana-pro" ? imageSize : undefined,
      optimizeChineseText: model === "nano-banana-pro" ? optimizeChineseText : undefined,
      replyType: "json",
    };

    const generation = await prisma.generation.create({
      data: {
        model,
        prompt,
        aspectRatio,
        imageSize: model === "nano-banana-pro" ? imageSize : null,
        quality: model === "gpt-image-2" ? quality : null,
        optimizeChineseText: model === "nano-banana-pro" ? optimizeChineseText : false,
        status: "running",
        requestJson: toPrismaJson(requestJson),
        references: {
          connect: references.map((image) => ({ id: image.id })),
        },
      },
    });
    generationId = generation.id;

    const result = await generateWithVisionary({
      model,
      prompt,
      images: referenceDataUris,
      aspectRatio,
      quality: quality as "auto" | "low" | "medium" | "high",
      imageSize,
      optimizeChineseText,
    });

    const urls = result.results?.map((item) => item.url).filter((url): url is string => Boolean(url)) ?? [];
    if (urls.length === 0) {
      throw new Error("Generation succeeded but no image URL was returned.");
    }

    for (const url of urls) {
      const imageId = crypto.randomUUID();
      const saved = await saveRemoteGeneratedImage(url, imageId);
      await prisma.generatedImage.create({
        data: {
          id: imageId,
          generationId: generation.id,
          filename: saved.filename,
          localPath: saved.localPath,
          publicUrl: saved.publicUrl,
          sourceUrl: url,
          mimeType: saved.mimeType,
        },
      });
    }

    const completed = await prisma.generation.update({
      where: { id: generation.id },
      data: {
        providerGenerationId: result.id ?? null,
        status: result.status ?? "succeeded",
        responseJson: toPrismaJson(result),
      },
      include: generationInclude,
    });

    return NextResponse.json({ generation: completed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    if (generationId) {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: "failed", error: message },
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (status !== "failed") {
    return NextResponse.json({ error: "Only failed generations can be cleared in bulk." }, { status: 400 });
  }

  const result = await prisma.generation.deleteMany({
    where: { status: "failed" },
  });

  return NextResponse.json({ ok: true, count: result.count });
}
