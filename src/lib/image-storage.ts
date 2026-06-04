import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const IMAGE_MIME_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd();
const PUBLIC_ROOT = path.join(PROJECT_ROOT, "public");

export const MAX_REFERENCE_IMAGES = 9;
export const MAX_REFERENCE_SIZE = 10 * 1024 * 1024;

function todayParts() {
  const now = new Date();
  return [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ];
}

function publicRoot() {
  return PUBLIC_ROOT;
}

async function ensureDatedDir(bucket: "generated" | "references") {
  const parts = todayParts();
  const dir = path.join(publicRoot(), bucket, ...parts);
  await mkdir(dir, { recursive: true });
  return { dir, publicBase: `/${bucket}/${parts.join("/")}` };
}

function toPortablePath(absolutePath: string) {
  return path.relative(PROJECT_ROOT, absolutePath);
}

function resolveLocalPath(localPath: string) {
  if (path.isAbsolute(localPath)) return localPath;

  const normalized = localPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const publicRelativePath = normalized.startsWith("public/")
    ? normalized.slice("public/".length)
    : normalized;

  return path.join(PUBLIC_ROOT, publicRelativePath);
}

export function extensionForMime(mimeType: string) {
  return IMAGE_MIME_TYPES.get(mimeType);
}

export function assertSupportedImage(file: File) {
  const extension = extensionForMime(file.type);
  if (!extension) {
    throw new Error("Only PNG, JPEG, and WebP reference images are supported.");
  }
  if (file.size > MAX_REFERENCE_SIZE) {
    throw new Error("Each reference image must be 10MB or smaller.");
  }
  return extension;
}

export async function saveReferenceFile(file: File, id: string) {
  const extension = assertSupportedImage(file);
  const { dir, publicBase } = await ensureDatedDir("references");
  const filename = `${id}.${extension}`;
  const localPath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(localPath, buffer);

  return {
    filename,
    localPath: toPortablePath(localPath),
    publicUrl: `${publicBase}/${filename}`,
    mimeType: file.type,
  };
}

export async function fileToDataUri(localPath: string, mimeType: string) {
  const buffer = await readFile(resolveLocalPath(localPath));
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function fileToCompressedDataUri(localPath: string) {
  const buffer = await readFile(resolveLocalPath(localPath));
  const compressed = await sharp(buffer)
    .rotate()
    .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  return `data:image/jpeg;base64,${compressed.toString("base64")}`;
}

function extensionFromContentType(contentType: string | null) {
  if (!contentType) return "png";
  return extensionForMime(contentType.split(";")[0].trim()) ?? "png";
}

export async function saveRemoteGeneratedImage(url: string, id: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  const extension = extensionFromContentType(contentType);
  const { dir, publicBase } = await ensureDatedDir("generated");
  const filename = `${id}.${extension}`;
  const localPath = path.join(dir, filename);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(localPath, buffer);

  return {
    filename,
    localPath: toPortablePath(localPath),
    publicUrl: `${publicBase}/${filename}`,
    mimeType: contentType?.split(";")[0] ?? `image/${extension}`,
  };
}

export async function deleteLocalFile(localPath?: string | null) {
  if (!localPath) return;
  await unlink(resolveLocalPath(localPath)).catch(() => undefined);
}
