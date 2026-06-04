import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteLocalFile } from "@/lib/image-storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const generation = await prisma.generation.findUnique({
    where: { id },
    include: { images: true, references: true },
  });

  if (!generation) {
    return NextResponse.json({ error: "Generation not found." }, { status: 404 });
  }

  return NextResponse.json({ generation });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const generation = await prisma.generation.findUnique({
    where: { id },
    include: { images: true, references: true },
  });

  if (!generation) {
    return NextResponse.json({ error: "Generation not found." }, { status: 404 });
  }

  await Promise.all(generation.images.map((image) => deleteLocalFile(image.localPath)));
  await prisma.generation.delete({ where: { id } });

  for (const reference of generation.references) {
    const usageCount = await prisma.generation.count({
      where: { references: { some: { id: reference.id } } },
    });

    if (usageCount === 0) {
      await deleteLocalFile(reference.localPath);
      await prisma.referenceImage.delete({ where: { id: reference.id } }).catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}
