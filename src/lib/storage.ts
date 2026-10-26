// Operaciones con R2 y claves de objetos.
// Uso: putObject(env.BUCKET, ...), con `import { env } from 'cloudflare:workers'`
import type { Image } from './db/schema';

export const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

export type ImageMimeType = keyof typeof IMAGE_EXTENSIONS;

export const IMAGE_MIME_TYPES = Object.keys(IMAGE_EXTENSIONS) as [
  ImageMimeType,
  ...ImageMimeType[],
];

type ObjectBody = Parameters<R2Bucket['put']>[1];

// Claves: originals/{uuid}.{ext} y thumbs/{uuid}.webp
export function buildKeys(id: string, mimeType: ImageMimeType) {
  return {
    originalKey: `originals/${id}.${IMAGE_EXTENSIONS[mimeType]}`,
    thumbKey: `thumbs/${id}.webp`,
  };
}

export const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SERVABLE_KEY = new RegExp(
  `^(originals/${UUID_PATTERN}\\.(jpg|png|webp|gif)|thumbs/${UUID_PATTERN}\\.webp)$`,
);

// Solo se sirven claves generadas por buildKeys
export function isServableKey(key: string): boolean {
  return SERVABLE_KEY.test(key);
}

const IMAGE_ID = new RegExp(`^${UUID_PATTERN}$`);

export function isImageId(id: string | undefined): id is string {
  return id !== undefined && IMAGE_ID.test(id);
}

export function isImageMimeType(type: string): type is ImageMimeType {
  return type in IMAGE_EXTENSIONS;
}

// Ruta relativa con la que el navegador pide el objeto
export function fileUrl(key: string): string {
  return `/files/${key}`;
}

// Respuesta pública de una imagen; el cliente la importa solo como tipo
export function toImageResponse(image: Image) {
  return {
    id: image.id,
    originalName: image.originalName,
    mimeType: image.mimeType,
    size: image.size,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt.toISOString(),
    originalUrl: fileUrl(image.originalKey),
    thumbUrl: fileUrl(image.thumbKey),
    detailUrl: `/images/${image.id}`,
  };
}

export type ImageResponse = ReturnType<typeof toImageResponse>;

export function putObject(bucket: R2Bucket, key: string, body: ObjectBody, contentType: string) {
  return bucket.put(key, body, { httpMetadata: { contentType } });
}

export function getObject(bucket: R2Bucket, key: string) {
  return bucket.get(key);
}

export function deleteObjects(bucket: R2Bucket, keys: string[]) {
  return bucket.delete(keys);
}
