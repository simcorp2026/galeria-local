import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { IMAGE_MIME_TYPES } from '../storage';

// Solo metadatos: los archivos viven en R2
export const images = sqliteTable(
  'images',
  {
    id: text('id').primaryKey(), // crypto.randomUUID()
    originalName: text('original_name').notNull(),
    originalKey: text('original_key').notNull().unique(), // originals/{uuid}.{ext}
    thumbKey: text('thumb_key').notNull().unique(), // thumbs/{uuid}.webp
    mimeType: text('mime_type', { enum: IMAGE_MIME_TYPES }).notNull(),
    size: integer('size').notNull(), // bytes del original
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  // Paginación por cursor: ORDER BY created_at DESC, id DESC
  (table) => [index('images_created_at_id_idx').on(table.createdAt, table.id)],
);

export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;
