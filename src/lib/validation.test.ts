import { describe, expect, it } from 'vitest';
import {
  createUploadSchema,
  detectImageType,
  encodeCursor,
  getMaxUploadBytes,
  hasAllowedExtension,
  listQuerySchema,
  readWebpWidth,
} from './validation';

const MB = 1024 * 1024;
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

// Cabecera WebP mínima: RIFF + tamaño + WEBP + chunk + datos del chunk
function webp(chunk: 'VP8 ' | 'VP8L' | 'VP8X', width: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii(chunk)]);
  if (chunk === 'VP8 ') {
    bytes.set([0x9d, 0x01, 0x2a, width & 0xff, (width >> 8) & 0x3f], 23);
  } else if (chunk === 'VP8L') {
    const w = width - 1;
    bytes.set([0x2f, w & 0xff, (w >> 8) & 0x3f], 20);
  } else {
    const w = width - 1;
    bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  }
  return bytes;
}

function file(bytes: ArrayLike<number>, name: string, type: string, padding = 0): File {
  return new File([new Uint8Array(bytes), new Uint8Array(padding)], name, { type });
}

function upload(overrides: Record<string, unknown> = {}) {
  return {
    file: file(JPEG, 'foto.jpg', 'image/jpeg'),
    thumb: file(webp('VP8X', 400), 'thumb.webp', 'image/webp'),
    width: '1200',
    height: '800',
    ...overrides,
  };
}

describe('getMaxUploadBytes', () => {
  it('convierte MB a bytes', () => {
    expect(getMaxUploadBytes('5')).toBe(5 * MB);
  });

  it('usa 10 MB si el valor falta o no es válido', () => {
    expect(getMaxUploadBytes(undefined)).toBe(10 * MB);
    expect(getMaxUploadBytes('abc')).toBe(10 * MB);
    expect(getMaxUploadBytes('-1')).toBe(10 * MB);
  });
});

describe('hasAllowedExtension', () => {
  it('acepta extensiones del tipo, sin distinguir mayúsculas', () => {
    expect(hasAllowedExtension('foto.JPEG', 'image/jpeg')).toBe(true);
    expect(hasAllowedExtension('foto.jpg', 'image/jpeg')).toBe(true);
  });

  it('rechaza extensiones o tipos que no coinciden', () => {
    expect(hasAllowedExtension('foto.png', 'image/jpeg')).toBe(false);
    expect(hasAllowedExtension('foto', 'image/png')).toBe(false);
    expect(hasAllowedExtension('dibujo.svg', 'image/svg+xml')).toBe(false);
  });
});

describe('detectImageType', () => {
  it('detecta por los primeros bytes', () => {
    expect(detectImageType(new Uint8Array(JPEG))).toBe('image/jpeg');
    expect(detectImageType(new Uint8Array(PNG))).toBe('image/png');
    expect(detectImageType(new Uint8Array(GIF))).toBe('image/gif');
    expect(detectImageType(webp('VP8X', 100))).toBe('image/webp');
  });

  it('devuelve null si no es una imagen permitida', () => {
    expect(detectImageType(new Uint8Array(ascii('<svg xmlns=')))).toBeNull();
  });
});

describe('readWebpWidth', () => {
  it.each(['VP8 ', 'VP8L', 'VP8X'] as const)('lee el ancho de %s', (chunk) => {
    expect(readWebpWidth(webp(chunk, 400))).toBe(400);
  });

  it('devuelve null si no es WebP', () => {
    expect(readWebpWidth(new Uint8Array(32).fill(1))).toBeNull();
  });
});

describe('createUploadSchema', () => {
  const schema = createUploadSchema(MB);

  it('acepta una subida válida y convierte las dimensiones a número', async () => {
    const result = await schema.safeParseAsync(upload());
    expect(result.success).toBe(true);
    expect(result.data?.width).toBe(1200);
  });

  it.each([
    ['tipo no permitido', { file: file(ascii('<svg'), 'a.svg', 'image/svg+xml') }],
    ['extensión distinta al tipo', { file: file(JPEG, 'foto.png', 'image/jpeg') }],
    ['contenido distinto al tipo', { file: file(JPEG, 'foto.png', 'image/png') }],
    ['archivo demasiado grande', { file: file(JPEG, 'foto.jpg', 'image/jpeg', MB) }],
    ['falta la miniatura', { thumb: undefined }],
    ['miniatura no WebP', { thumb: file(PNG, 'thumb.png', 'image/png') }],
    ['miniatura de más de 400 px', { thumb: file(webp('VP8X', 401), 't.webp', 'image/webp') }],
    ['dimensiones no válidas', { width: '0' }],
    ['dimensiones no enteras', { height: '10.5' }],
  ])('rechaza: %s', async (_, overrides) => {
    const result = await schema.safeParseAsync(upload(overrides));
    expect(result.success).toBe(false);
  });
});

describe('listQuerySchema', () => {
  const id = crypto.randomUUID();

  it('usa límite 20 y sin cursor por defecto', () => {
    expect(listQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('decodifica el cursor generado por encodeCursor', () => {
    const createdAt = new Date('2026-10-26T10:00:00Z');
    const { cursor } = listQuerySchema.parse({ cursor: encodeCursor(createdAt, id) });
    expect(cursor).toEqual({ createdAt, id });
  });

  it.each([{ limit: '0' }, { limit: '51' }, { cursor: 'abc' }, { cursor: `1_${id}x` }])(
    'rechaza %o',
    (query) => {
      expect(listQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});
