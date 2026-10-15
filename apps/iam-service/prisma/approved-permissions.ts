import { PERMISSION_DEFINITIONS } from '../../../libs/contracts/src/iam/permissions';

export type PermissionSeedRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type PermissionSeedTx = {
  permission: {
    findUnique(args: {
      where: { code: string };
    }): Promise<PermissionSeedRecord | null>;
    create(args: {
      data: {
        code: string;
        name: string;
        description: string;
        isActive: boolean;
      };
    }): Promise<PermissionSeedRecord>;
  };
};

export type PermissionSeedClient = {
  $transaction<T>(fn: (tx: PermissionSeedTx) => Promise<T>): Promise<T>;
};

export type PermissionSeedResult = {
  code: string;
  id: string;
  outcome: 'created' | 'existing' | 'existing_inactive';
};

export async function seedApprovedPermissions(
  prisma: PermissionSeedClient,
): Promise<readonly PermissionSeedResult[]> {
  return prisma.$transaction(async (tx) => {
    const results: PermissionSeedResult[] = [];
    for (const definition of PERMISSION_DEFINITIONS) {
      results.push(await applyApprovedPermission(tx, definition));
    }
    return results;
  });
}

async function applyApprovedPermission(
  tx: PermissionSeedTx,
  definition: (typeof PERMISSION_DEFINITIONS)[number],
): Promise<PermissionSeedResult> {
  const existing = await tx.permission.findUnique({
    where: { code: definition.code },
  });
  if (existing !== null) {
    return toExistingResult(existing);
  }

  try {
    const created = await tx.permission.create({
      data: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        isActive: true,
      },
    });
    return {
      code: created.code,
      id: created.id,
      outcome: 'created',
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const raced = await tx.permission.findUnique({
      where: { code: definition.code },
    });
    if (raced === null) {
      throw error;
    }
    return toExistingResult(raced);
  }
}

function toExistingResult(
  existing: PermissionSeedRecord,
): PermissionSeedResult {
  return {
    code: existing.code,
    id: existing.id,
    outcome: existing.isActive ? 'existing' : 'existing_inactive',
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
