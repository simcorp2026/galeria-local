import { z } from 'astro/zod';
import { IMAGE_MIME_TYPES, UUID_PATTERN, isImageMimeType, type ImageMimeType } from './storage';

export const THUMB_MAX_WIDTH = 400;
export const THUMB_MAX_BYTES = 1024 * 1024;
export const MAX_DIMENSION = 20000;
export const DEFAULT_MAX_UPLOAD_MB = 10;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

const EXTENSIONS_BY_TYPE: Record<ImageMimeType, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
};

// MAX_UPLOAD_MB llega como texto desde .dev.vars
export function getMaxUploadBytes(value: string | undefined): number {
  const mb = Number(value);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
}

export function hasAllowedExtension(name: string, type: string): boolean {
  if (!isImageMimeType(type)) return false;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSIONS_BY_TYPE[type].includes(ext);
}

function matches(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

function isWebp(bytes: Uint8Array): boolean {
  return matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8);
}

// Tipo real según los primeros bytes; no se confía en el tipo que declara el navegador
export function detectImageType(bytes: Uint8Array): ImageMimeType | null {
  if (matches(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (matches(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (isWebp(bytes)) return 'image/webp';
  return null;
}

// Ancho de un WebP leído de la cabecera (formatos VP8, VP8L y VP8X)
export function readWebpWidth(bytes: Uint8Array): number | null {
  if (bytes.length < 30 || !isWebp(bytes)) return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === 'VP8 ') return (bytes[26] | (bytes[27] << 8)) & 0x3fff;
  if (chunk === 'VP8L') return (bytes[21] | ((bytes[22] & 0x3f) << 8)) + 1;
  if (chunk === 'VP8X') return (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
  return null;
}

async function readHeader(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 32).arrayBuffer());
}

const dimension = z.coerce.number().int().positive().max(MAX_DIMENSION);

export function createUploadSchema(maxBytes: number) {
  return z.object({
    file: z
      .file({ error: 'Falta el archivo' })
      .max(maxBytes, `El archivo supera ${maxBytes / 1024 / 1024} MB`)
      .mime(IMAGE_MIME_TYPES, 'Tipo de archivo no permitido')
      .refine((f) => f.name.length <= 255, 'Nombre de archivo demasiado largo')
      .refine((f) => hasAllowedExtension(f.name, f.type), 'La extensión no coincide con el tipo')
      .refine(
        async (f) => detectImageType(await readHeader(f)) === f.type,
        'El contenido no coincide con el tipo',
      ),
    thumb: z
      .file({ error: 'Falta la miniatura' })
      .max(THUMB_MAX_BYTES, 'Miniatura demasiado grande')
      .mime('image/webp', 'La miniatura debe ser WebP')
      .refine(async (f) => {
        const width = readWebpWidth(await readHeader(f));
        return width !== null && width <= THUMB_MAX_WIDTH;
      }, `La miniatura debe ser un WebP de máximo ${THUMB_MAX_WIDTH} px de ancho`),
    width: dimension,
    height: dimension,
  });
}

// Cursor: "{created_at en ms}_{id}" del último elemento de la página anterior
const CURSOR = new RegExp(`^\\d{1,15}_${UUID_PATTERN}$`);

export function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.getTime()}_${id}`;
}

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z
    .string()
    .regex(CURSOR, 'Cursor inválido')
    .transform((value) => {
      const [ms, id] = value.split('_');
      return { createdAt: new Date(Number(ms)), id };
    })
    .optional(),
});
