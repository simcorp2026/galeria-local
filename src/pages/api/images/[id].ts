import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { findImageById } from '../../../lib/db/queries';
import { images } from '../../../lib/db/schema';
import { deleteObjects, toImageResponse } from '../../../lib/storage';

const notFound = () => Response.json({ error: 'Imagen no encontrada' }, { status: 404 });

export const GET: APIRoute = async ({ params }) => {
  const image = await findImageById(getDb(env.DB), params.id);
  if (!image) return notFound();
  return Response.json(toImageResponse(image));
};

export const DELETE: APIRoute = async ({ params }) => {
  const db = getDb(env.DB);
  const image = await findImageById(db, params.id);
  if (!image) return notFound();

  // Primero D1: si luego falla R2 quedan objetos huérfanos, nunca un registro sin archivos
  await db.delete(images).where(eq(images.id, image.id));
  try {
    await deleteObjects(env.BUCKET, [image.originalKey, image.thumbKey]);
  } catch (error) {
    console.error('Error al borrar los objetos de R2', image.id, error);
  }
  return new Response(null, { status: 204 });
};
