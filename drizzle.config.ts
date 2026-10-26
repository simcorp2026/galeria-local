import { defineConfig } from 'drizzle-kit';

// Solo genera SQL; las migraciones se aplican con `wrangler d1 migrations apply`
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
});
