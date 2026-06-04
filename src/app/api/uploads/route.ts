import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_REFERENCE_IMAGES, saveReferenceFile } from "@/lib/image-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("images")
      .filter((file): file is File => file instanceof File)
      .slice(0, MAX_REFERENCE_IMAGES);

    if (files.length === 0) {
      return NextResponse.json({ error: "Upload at least one reference image." }, { status: 400 });
    }

    const images = [];
    for (const file of files) {
      const id = crypto.randomUUID();
      const saved = await saveReferenceFile(file, id);
      const record = await prisma.referenceImage.create({
        data: {
          id,
          filename: saved.filename,
          localPath: saved.localPath,
          publicUrl: saved.publicUrl,
          mimeType: saved.mimeType,
        },
      });
      images.push(record);
    }

    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
