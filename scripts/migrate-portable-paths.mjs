import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  }),
});

const projectRoot = process.cwd();

function toRelativePath(value) {
  return path.isAbsolute(value) ? path.relative(projectRoot, value) : value;
}

async function migrate() {
  let generatedCount = 0;
  let referenceCount = 0;

  const generatedImages = await prisma.generatedImage.findMany();
  for (const image of generatedImages) {
    const localPath = toRelativePath(image.localPath);
    if (localPath !== image.localPath) {
      await prisma.generatedImage.update({
        where: { id: image.id },
        data: { localPath },
      });
      generatedCount += 1;
    }
  }

  const referenceImages = await prisma.referenceImage.findMany();
  for (const image of referenceImages) {
    const localPath = toRelativePath(image.localPath);
    if (localPath !== image.localPath) {
      await prisma.referenceImage.update({
        where: { id: image.id },
        data: { localPath },
      });
      referenceCount += 1;
    }
  }

  console.log(`Migrated ${generatedCount} generated image paths and ${referenceCount} reference image paths.`);
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
