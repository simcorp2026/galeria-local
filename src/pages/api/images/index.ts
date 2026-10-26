import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { getDb } from '../../../lib/db/client';
import { images } from '../../../lib/db/schema';
import {
  buildKeys,
  deleteObjects,
  putObject,
  toImageResponse,
  type ImageMimeType,
} from '../../../lib/storage';
import {
  createUploadSchema,
  encodeCursor,
  getMaxUploadBytes,
  listQuerySchema,
} from '../../../lib/validation';

export const GET: APIRoute = async ({ url }) => {
  // Un parámetro vacío (?cursor=) equivale a no enviarlo
  const params = Object.fromEntries([...url.searchParams].filter(([, value]) => value !== ''));
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { limit, cursor } = parsed.data;

  // Orden estable: created_at DESC, id DESC; se pide uno de más para saber si hay otra página
  const rows = await getDb(env.DB)
    .select()
    .from(images)
    .where(
      cursor
        ? or(
            lt(images.createdAt, cursor.createdAt),
            and(eq(images.createdAt, cursor.createdAt), lt(images.id, cursor.id)),
          )
        : undefined,
    )
    .orderBy(desc(images.createdAt), desc(images.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null;

  return Response.json({ items: page.map(toImageResponse), nextCursor });
};

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
  }

  const schema = createUploadSchema(getMaxUploadBytes(env.MAX_UPLOAD_MB));
  const parsed = await schema.safeParseAsync(Object.fromEntries(form));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { file, thumb, width, height } = parsed.data;

  const id = crypto.randomUUID();
  const mimeType = file.type as ImageMimeType;
  const { originalKey, thumbKey } = buildKeys(id, mimeType);

  try {
    await putObject(env.BUCKET, originalKey, file, mimeType);
    await putObject(env.BUCKET, thumbKey, thumb, 'image/webp');
    const [image] = await getDb(env.DB)
      .insert(images)
      .values({
        id,
        originalName: file.name,
        originalKey,
        thumbKey,
        mimeType,
        size: file.size,
        width,
        height,
      })
      .returning();
    return Response.json(toImageResponse(image), { status: 201 });
  } catch (error) {
    // Rollback: no dejar objetos huérfanos en R2
    await deleteObjects(env.BUCKET, [originalKey, thumbKey]).catch(() => {});
    console.error('Error al guardar la imagen', error);
    return Response.json({ error: 'No se pudo guardar la imagen' }, { status: 500 });
  }
};
