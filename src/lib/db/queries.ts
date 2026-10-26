import { eq } from 'drizzle-orm';
import { isImageId } from '../storage';
import type { Db } from './client';
import { images } from './schema';

// undefined si el id no tiene formato UUID o no existe
export async function findImageById(db: Db, id: string | undefined) {
  if (!isImageId(id)) return undefined;
  return db.select().from(images).where(eq(images.id, id)).get();
}
