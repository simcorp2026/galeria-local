import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

// Uso: getDb(env.DB), con `import { env } from 'cloudflare:workers'`
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;
