import { describe, expect, it } from 'vitest';
import { buildKeys, isImageId, isServableKey } from './storage';

const id = crypto.randomUUID();

describe('buildKeys', () => {
  it('genera claves de original y miniatura', () => {
    expect(buildKeys(id, 'image/jpeg')).toEqual({
      originalKey: `originals/${id}.jpg`,
      thumbKey: `thumbs/${id}.webp`,
    });
  });
});

describe('isImageId', () => {
  it('acepta solo UUID', () => {
    expect(isImageId(id)).toBe(true);
    expect(isImageId(undefined)).toBe(false);
    expect(isImageId(`${id}x`)).toBe(false);
    expect(isImageId("1' OR '1'='1")).toBe(false);
  });
});

describe('isServableKey', () => {
  it('acepta claves generadas', () => {
    const { originalKey, thumbKey } = buildKeys(id, 'image/png');
    expect(isServableKey(originalKey)).toBe(true);
    expect(isServableKey(thumbKey)).toBe(true);
  });

  it('rechaza otras claves', () => {
    expect(isServableKey(`thumbs/${id}.png`)).toBe(false);
    expect(isServableKey(`otros/${id}.jpg`)).toBe(false);
    expect(isServableKey('originals/../secreto.jpg')).toBe(false);
  });
});
