import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getObject, isImageMimeType, isServableKey } from '../../lib/storage';

const notFound = () => new Response('No encontrado', { status: 404 });

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key || !isServableKey(key)) return notFound();

  const object = await getObject(env.BUCKET, key);
  const contentType = object?.httpMetadata?.contentType;
  if (!object || !contentType || !isImageMimeType(contentType)) return notFound();

  return new Response(object.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(object.size),
      ETag: object.httpEtag,
      // Las claves llevan UUID y nunca se sobrescriben
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
};
