import { config as loadDotenv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import { seedApprovedPermissions } from './approved-permissions';
import { seedSystemRoles, SystemRoleSeedConflictError } from './system-roles';

const IAM_POSTGRES_SCHEMA = 'iam';

loadDotenv({
  path: resolve(__dirname, '../../../.env'),
  override: false,
  quiet: true,
});

async function main(): Promise<void> {
  const connectionString = process.env.IAM_DATABASE_URL;
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error('IAM_DATABASE_URL is required to seed IAM');
  }

  const pool = new Pool({
    connectionString,
    max: 2,
    options: `-c search_path=${IAM_POSTGRES_SCHEMA}`,
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, { schema: IAM_POSTGRES_SCHEMA }),
  });

  try {
    const roles = await seedSystemRoles(prisma);
    for (const result of roles) {
      console.log(
        `[iam-seed] role ${result.code} ${result.outcome} id=${result.id}`,
      );
    }

    const permissions = await seedApprovedPermissions(prisma);
    let created = 0;
    let existing = 0;
    let existingInactive = 0;
    for (const result of permissions) {
      if (result.outcome === 'created') {
        created += 1;
      } else if (result.outcome === 'existing_inactive') {
        existingInactive += 1;
      } else {
        existing += 1;
      }
    }
    console.log(
      `[iam-seed] permissions created=${created} existing=${existing} existing_inactive=${existingInactive}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof SystemRoleSeedConflictError) {
    console.error('[iam-seed] aborted: system role definition conflict');
    for (const conflict of error.conflicts) {
      console.error(
        `[iam-seed] conflict code=${conflict.code} id=${conflict.id} ${conflict.reasons.join('; ')}`,
      );
    }
  } else if (error instanceof Error) {
    console.error(`[iam-seed] failed: ${error.message}`);
  } else {
    console.error('[iam-seed] failed');
  }
  process.exitCode = 1;
});
