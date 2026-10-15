import { defineConfig, env } from 'prisma/config';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({
  path: resolve(__dirname, '../../.env'),
  override: false,
  quiet: true,
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx apps/iam-service/prisma/seed.ts',
  },
  datasource: {
    url: env('IAM_DATABASE_URL'),
  },
});
