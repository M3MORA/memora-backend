import { config as loadDotenv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import {
  listApprovedGrantPairs,
  PERMISSION_DEFINITIONS,
  RBAC_V1_MARKER_KEY,
  RBAC_V1_ROLE_CODES,
  rbacV1GrantsChecksum,
  type ApprovedGrantPair,
} from '../../../libs/contracts/src/iam/permissions';
import { Prisma, PrismaClient } from '../generated/prisma/client';

const IAM_POSTGRES_SCHEMA = 'iam';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

loadDotenv({
  path: resolve(__dirname, '../../../.env'),
  override: false,
  quiet: true,
});

export type GrantRow = {
  roleCode: string;
  permissionCode: string;
  roleId: string;
  permissionId: string;
};

export type CatalogRole = {
  id: string;
  code: string;
  isActive: boolean;
};

export type CatalogPermission = {
  id: string;
  code: string;
  isActive: boolean;
};

export type BootstrapMarker = {
  key: string;
  grantsChecksum: string;
  grantsInserted: number;
};

export type RbacBootstrapTx = {
  $executeRaw(
    query: TemplateStringsArray,
    ...values: string[]
  ): Promise<unknown>;
  role: {
    findMany(): Promise<CatalogRole[]>;
  };
  permission: {
    findMany(): Promise<CatalogPermission[]>;
  };
  rolePermission: {
    findMany(): Promise<GrantRow[]>;
    createMany(args: {
      data: Array<{
        roleId: string;
        permissionId: string;
        grantedByUserId: null;
      }>;
    }): Promise<{ count: number }>;
  };
  rbacBootstrapExecution: {
    findUnique(args: {
      where: { key: string };
    }): Promise<BootstrapMarker | null>;
    create(args: {
      data: {
        key: string;
        grantsChecksum: string;
        grantsInserted: number;
        appliedBy: string | null;
      };
    }): Promise<BootstrapMarker>;
  };
};

export type RbacBootstrapClient = {
  $transaction<T>(
    fn: (tx: RbacBootstrapTx) => Promise<T>,
    options?: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
};

type PrismaBootstrapClient = {
  $transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
};

function adaptPrisma(prisma: PrismaBootstrapClient): RbacBootstrapClient {
  return {
    $transaction: (fn, options) =>
      prisma.$transaction((tx) => fn(mapPrismaTx(tx)), options),
  };
}

function mapPrismaTx(tx: Prisma.TransactionClient): RbacBootstrapTx {
  return {
    $executeRaw: (query, ...values) => tx.$executeRaw(query, ...values),
    role: {
      findMany: () =>
        tx.role.findMany({
          select: { id: true, code: true, isActive: true },
        }),
    },
    permission: {
      findMany: () =>
        tx.permission.findMany({
          select: { id: true, code: true, isActive: true },
        }),
    },
    rolePermission: {
      findMany: async () => {
        const rows = await tx.rolePermission.findMany({
          include: { role: true, permission: true },
        });
        return rows.map((row) => ({
          roleCode: row.role.code,
          permissionCode: row.permission.code,
          roleId: row.roleId,
          permissionId: row.permissionId,
        }));
      },
      createMany: (args) => tx.rolePermission.createMany(args),
    },
    rbacBootstrapExecution: {
      findUnique: async ({ where }) => {
        const row = await tx.rbacBootstrapExecution.findUnique({
          where,
        });
        if (row === null) {
          return null;
        }
        return {
          key: row.key,
          grantsChecksum: row.grantsChecksum,
          grantsInserted: row.grantsInserted,
        };
      },
      create: async ({ data }) => {
        const created = await tx.rbacBootstrapExecution.create({ data });
        return {
          key: created.key,
          grantsChecksum: created.grantsChecksum,
          grantsInserted: created.grantsInserted,
        };
      },
    },
  };
}

export type BootstrapBlocked = {
  missingRoles: string[];
  missingPermissions: string[];
  inactiveRoles: string[];
  inactivePermissions: string[];
};

export type RbacBootstrapReport = {
  mode: 'dry-run' | 'apply';
  markerKey: string;
  grantsChecksum: string;
  alreadyApplied: boolean;
  grantsInserted: number;
  toAdd: ApprovedGrantPair[];
  existing: ApprovedGrantPair[];
  unexpected: Array<{ roleCode: string; permissionCode: string }>;
  blocked: BootstrapBlocked;
  databaseHost: string;
  nodeEnv: string;
};

export class UnsafeBootstrapTargetError extends Error {
  constructor(reason: string) {
    super(`RBAC v1 apply refused: ${reason}`);
    this.name = 'UnsafeBootstrapTargetError';
  }
}

export class RbacBootstrapBlockedError extends Error {
  constructor(readonly report: RbacBootstrapReport) {
    super('RBAC v1 apply blocked by missing or inactive catalog rows');
    this.name = 'RbacBootstrapBlockedError';
  }
}

export class UnexpectedRolePermissionsError extends Error {
  constructor(
    readonly unexpected: Array<{ roleCode: string; permissionCode: string }>,
  ) {
    super(
      `RBAC v1 apply refused: ${unexpected.length} unexpected role_permissions require review`,
    );
    this.name = 'UnexpectedRolePermissionsError';
  }
}

export class BootstrapChecksumMismatchError extends Error {
  constructor(existing: string, expected: string) {
    super(
      `RBAC v1 marker checksum mismatch existing=${existing} expected=${expected}`,
    );
    this.name = 'BootstrapChecksumMismatchError';
  }
}

export function assertSafeDevelopmentTarget(
  databaseUrl: string,
  nodeEnv: string | undefined,
): { host: string; nodeEnv: string } {
  const envName = nodeEnv ?? 'development';
  if (envName === 'production') {
    throw new UnsafeBootstrapTargetError('NODE_ENV=production');
  }
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new UnsafeBootstrapTargetError('IAM_DATABASE_URL is not a valid URL');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new UnsafeBootstrapTargetError(
      `database host ${host} is not a local development target`,
    );
  }
  return { host, nodeEnv: envName };
}

export async function runRbacV1Bootstrap(
  prisma: RbacBootstrapClient,
  options: {
    apply: boolean;
    nodeEnv: string;
    databaseHost: string;
    actor: string;
  },
): Promise<RbacBootstrapReport> {
  const grantsChecksum = rbacV1GrantsChecksum();
  const approved = listApprovedGrantPairs();
  const approvedKeys = new Set(
    approved.map((pair) => grantKey(pair.roleCode, pair.permissionCode)),
  );

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${RBAC_V1_MARKER_KEY}))`;

      const marker = await tx.rbacBootstrapExecution.findUnique({
        where: { key: RBAC_V1_MARKER_KEY },
      });
      if (marker !== null && marker.grantsChecksum !== grantsChecksum) {
        throw new BootstrapChecksumMismatchError(
          marker.grantsChecksum,
          grantsChecksum,
        );
      }

      const roles = await tx.role.findMany();
      const permissions = await tx.permission.findMany();
      const grants = await tx.rolePermission.findMany();
      const blocked = collectBlocked(roles, permissions);
      const { toAdd, existing, unexpected } = diffGrants(
        approved,
        approvedKeys,
        grants,
      );

      const report: RbacBootstrapReport = {
        mode: options.apply ? 'apply' : 'dry-run',
        markerKey: RBAC_V1_MARKER_KEY,
        grantsChecksum,
        alreadyApplied: marker !== null,
        grantsInserted: 0,
        toAdd,
        existing,
        unexpected,
        blocked,
        databaseHost: options.databaseHost,
        nodeEnv: options.nodeEnv,
      };

      if (!options.apply) {
        return report;
      }

      if (marker !== null) {
        return report;
      }

      if (hasBlocked(blocked)) {
        throw new RbacBootstrapBlockedError(report);
      }
      if (unexpected.length > 0) {
        throw new UnexpectedRolePermissionsError(unexpected);
      }

      const rolesByCode = new Map(roles.map((role) => [role.code, role]));
      const permissionsByCode = new Map(
        permissions.map((permission) => [permission.code, permission]),
      );
      const data = toAdd.map((pair) => {
        const role = rolesByCode.get(pair.roleCode);
        const permission = permissionsByCode.get(pair.permissionCode);
        if (role === undefined || permission === undefined) {
          throw new RbacBootstrapBlockedError(report);
        }
        return {
          roleId: role.id,
          permissionId: permission.id,
          grantedByUserId: null,
        };
      });

      if (data.length > 0) {
        await tx.rolePermission.createMany({ data });
      }
      await tx.rbacBootstrapExecution.create({
        data: {
          key: RBAC_V1_MARKER_KEY,
          grantsChecksum,
          grantsInserted: data.length,
          appliedBy: options.actor,
        },
      });

      return {
        ...report,
        grantsInserted: data.length,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function collectBlocked(
  roles: CatalogRole[],
  permissions: CatalogPermission[],
): BootstrapBlocked {
  const rolesByCode = new Map(roles.map((role) => [role.code, role]));
  const permissionsByCode = new Map(
    permissions.map((permission) => [permission.code, permission]),
  );
  const missingRoles = RBAC_V1_ROLE_CODES.filter(
    (code) => !rolesByCode.has(code),
  );
  const missingPermissions = PERMISSION_DEFINITIONS.map(
    (definition) => definition.code,
  ).filter((code) => !permissionsByCode.has(code));
  const inactiveRoles = RBAC_V1_ROLE_CODES.filter((code) => {
    const role = rolesByCode.get(code);
    return role !== undefined && !role.isActive;
  });
  const inactivePermissions = PERMISSION_DEFINITIONS.map(
    (definition) => definition.code,
  ).filter((code) => {
    const permission = permissionsByCode.get(code);
    return permission !== undefined && !permission.isActive;
  });
  return {
    missingRoles: [...missingRoles],
    missingPermissions,
    inactiveRoles: [...inactiveRoles],
    inactivePermissions,
  };
}

function hasBlocked(blocked: BootstrapBlocked): boolean {
  return (
    blocked.missingRoles.length > 0 ||
    blocked.missingPermissions.length > 0 ||
    blocked.inactiveRoles.length > 0 ||
    blocked.inactivePermissions.length > 0
  );
}

function diffGrants(
  approved: readonly ApprovedGrantPair[],
  approvedKeys: Set<string>,
  grants: GrantRow[],
): Pick<RbacBootstrapReport, 'toAdd' | 'existing' | 'unexpected'> {
  const present = new Set(
    grants.map((grant) => grantKey(grant.roleCode, grant.permissionCode)),
  );
  const toAdd = approved.filter(
    (pair) => !present.has(grantKey(pair.roleCode, pair.permissionCode)),
  );
  const existing = approved.filter((pair) =>
    present.has(grantKey(pair.roleCode, pair.permissionCode)),
  );
  const unexpected = grants
    .filter(
      (grant) =>
        !approvedKeys.has(grantKey(grant.roleCode, grant.permissionCode)),
    )
    .map((grant) => ({
      roleCode: grant.roleCode,
      permissionCode: grant.permissionCode,
    }));
  return { toAdd, existing, unexpected };
}

function grantKey(roleCode: string, permissionCode: string): string {
  return `${roleCode}\t${permissionCode}`;
}

function printReport(report: RbacBootstrapReport): void {
  console.log(`[iam-rbac-v1] mode=${report.mode}`);
  console.log(`[iam-rbac-v1] marker=${report.markerKey}`);
  console.log(`[iam-rbac-v1] grants_checksum=${report.grantsChecksum}`);
  console.log(
    `[iam-rbac-v1] env=${report.nodeEnv} host=${report.databaseHost}`,
  );
  console.log(`[iam-rbac-v1] already_applied=${report.alreadyApplied}`);
  console.log(
    `[iam-rbac-v1] to_add=${report.toAdd.length} existing=${report.existing.length} unexpected=${report.unexpected.length} inserted=${report.grantsInserted}`,
  );
  if (report.unexpected.length > 0) {
    for (const row of report.unexpected) {
      console.log(
        `[iam-rbac-v1] unexpected ${row.roleCode} -> ${row.permissionCode}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const connectionString = process.env.IAM_DATABASE_URL;
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error('IAM_DATABASE_URL is required for RBAC v1 bootstrap');
  }

  const target = assertSafeDevelopmentTarget(
    connectionString,
    process.env.NODE_ENV,
  );
  if (apply) {
    assertSafeDevelopmentTarget(connectionString, process.env.NODE_ENV);
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
    const report = await runRbacV1Bootstrap(adaptPrisma(prisma), {
      apply,
      nodeEnv: target.nodeEnv,
      databaseHost: target.host,
      actor: process.env.IAM_RBAC_BOOTSTRAP_ACTOR ?? 'iam-rbac-v1-bootstrap',
    });
    printReport(report);
    if (apply) {
      console.log(
        `[iam-rbac-v1] apply complete inserted=${report.grantsInserted}`,
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  process.argv[1].replace(/\\/g, '/').endsWith('rbac-v1-bootstrap.ts');

if (invokedDirectly) {
  main().catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(`[iam-rbac-v1] failed: ${error.message}`);
    } else {
      console.error('[iam-rbac-v1] failed');
    }
    process.exitCode = 1;
  });
}
