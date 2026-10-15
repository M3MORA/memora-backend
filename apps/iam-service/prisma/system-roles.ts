export const SYSTEM_ROLE_DEFINITIONS = [
  {
    code: 'CUSTOMER',
    name: 'Customer',
    description:
      'End-customer account for storefront orders, memory/design requests, and delivery tracking. Assigned automatically on public registration.',
  },
  {
    code: 'STORE_STAFF',
    name: 'Store Staff',
    description:
      'Boutique operations: in-store order support, customer assistance, and catalog help. Not granted by public registration.',
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description:
      'Store and operations management: staff coordination, order oversight, and exception handling. Privileged; never assigned via public registration.',
  },
  {
    code: 'JEWELER',
    name: 'Jeweler',
    description:
      'Workshop production: execute jewelry making, design handoff, and production tasks. Not granted by public registration.',
  },
  {
    code: 'DELIVERY_STAFF',
    name: 'Delivery Staff',
    description:
      'Fulfillment courier: assigned deliveries and handover confirmation. Not granted by public registration.',
  },
  {
    code: 'ADMIN',
    name: 'Administrator',
    description:
      'Platform administrator for IAM, catalog, and operational configuration. Privileged; never created or assigned by public registration.',
  },
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_DEFINITIONS)[number]['code'];

export type RoleSeedRecord = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
};

export type SystemRoleSeedTx = {
  role: {
    findUnique(args: {
      where: { code: string };
    }): Promise<RoleSeedRecord | null>;
    create(args: {
      data: {
        code: string;
        name: string;
        description: string;
        isSystem: boolean;
        isActive: boolean;
      };
    }): Promise<RoleSeedRecord>;
  };
};

export type SystemRoleSeedClient = {
  $transaction<T>(fn: (tx: SystemRoleSeedTx) => Promise<T>): Promise<T>;
};

export type SystemRoleSeedResult = {
  code: SystemRoleCode;
  id: string;
  outcome: 'created' | 'existing' | 'existing_inactive';
};

export type SystemRoleSeedConflict = {
  code: string;
  reasons: string[];
  id: string;
};

export class SystemRoleSeedConflictError extends Error {
  readonly conflicts: readonly SystemRoleSeedConflict[];

  constructor(conflicts: readonly SystemRoleSeedConflict[]) {
    super(
      `IAM system role seed conflict: ${conflicts
        .map((conflict) => `${conflict.code} (${conflict.reasons.join('; ')})`)
        .join(' | ')}`,
    );
    this.name = 'SystemRoleSeedConflictError';
    this.conflicts = conflicts;
  }
}

export async function seedSystemRoles(
  prisma: SystemRoleSeedClient,
): Promise<readonly SystemRoleSeedResult[]> {
  return prisma.$transaction(async (tx) => {
    const results: SystemRoleSeedResult[] = [];
    const conflicts: SystemRoleSeedConflict[] = [];

    for (const definition of SYSTEM_ROLE_DEFINITIONS) {
      const applied = await applySystemRole(tx, definition);
      if (applied.kind === 'conflict') {
        conflicts.push(applied.conflict);
        continue;
      }
      results.push(applied.result);
    }

    if (conflicts.length > 0) {
      throw new SystemRoleSeedConflictError(conflicts);
    }

    return results;
  });
}

async function applySystemRole(
  tx: SystemRoleSeedTx,
  definition: (typeof SYSTEM_ROLE_DEFINITIONS)[number],
): Promise<
  | { kind: 'ok'; result: SystemRoleSeedResult }
  | { kind: 'conflict'; conflict: SystemRoleSeedConflict }
> {
  const existing = await tx.role.findUnique({
    where: { code: definition.code },
  });

  if (existing !== null) {
    const reasons = conflictReasons(existing, definition);
    if (reasons.length > 0) {
      return {
        kind: 'conflict',
        conflict: { code: definition.code, id: existing.id, reasons },
      };
    }

    return {
      kind: 'ok',
      result: {
        code: definition.code,
        id: existing.id,
        outcome: existing.isActive ? 'existing' : 'existing_inactive',
      },
    };
  }

  try {
    const created = await tx.role.create({
      data: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        isSystem: true,
        isActive: true,
      },
    });

    return {
      kind: 'ok',
      result: {
        code: definition.code,
        id: created.id,
        outcome: 'created',
      },
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const raced = await tx.role.findUnique({
      where: { code: definition.code },
    });
    if (raced === null) {
      throw error;
    }

    const reasons = conflictReasons(raced, definition);
    if (reasons.length > 0) {
      return {
        kind: 'conflict',
        conflict: { code: definition.code, id: raced.id, reasons },
      };
    }

    return {
      kind: 'ok',
      result: {
        code: definition.code,
        id: raced.id,
        outcome: raced.isActive ? 'existing' : 'existing_inactive',
      },
    };
  }
}

function conflictReasons(
  existing: RoleSeedRecord,
  definition: (typeof SYSTEM_ROLE_DEFINITIONS)[number],
): string[] {
  const reasons: string[] = [];
  if (existing.name !== definition.name) {
    reasons.push(`name="${existing.name}" expected="${definition.name}"`);
  }
  if (!existing.isSystem) {
    reasons.push('is_system=false expected=true');
  }
  return reasons;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
