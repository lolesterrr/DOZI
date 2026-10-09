import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` turns changes in src/db/schema into a new migration in src/db/migrations.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
});
