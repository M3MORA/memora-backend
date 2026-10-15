'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const spec = JSON.parse(
  fs.readFileSync(path.join(root, 'rbac-v1.approved.json'), 'utf8'),
);

if (spec.approval_status !== 'APPROVED') {
  throw new Error('approval_status is not APPROVED');
}

const roles = Object.keys(spec.roles);
const permCodes = spec.permissions.map((permission) => permission.code);
if (new Set(permCodes).size !== permCodes.length) {
  throw new Error('duplicate permission codes');
}
if (permCodes.length !== 45) {
  throw new Error(`expected 45 permissions, got ${permCodes.length}`);
}
if (roles.length !== 6) {
  throw new Error(`expected 6 roles, got ${roles.length}`);
}

let mappingCount = 0;
for (const role of roles) {
  for (const code of spec.roles[role]) {
    if (!permCodes.includes(code)) {
      throw new Error(`unknown mapping ${role} ${code}`);
    }
    mappingCount += 1;
  }
}
if (mappingCount !== 48) {
  throw new Error(`expected 48 mappings, got ${mappingCount}`);
}

function esc(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const defs = spec.permissions
  .map(
    (permission) => `  {
    code: '${permission.code}',
    name: '${esc(permission.name)}',
    description: '${esc(permission.description)}',
    domain: '${permission.domain}',
    businessSource: '${esc(permission.business_source)}',
  }`,
  )
  .join(',\n');

const grants = roles
  .map((role) => {
    const list = spec.roles[role]
      .map((code) => `    '${code}',`)
      .join('\n');
    return `  ${role}: [\n${list}\n  ]`;
  })
  .join(',\n');

const content = `import { createHash } from 'node:crypto';

/**
 * MEMORA RBAC v1 permission registry.
 * Canonical runtime catalog. Approval spec: \`rbac-v1.approved.json\`.
 * Codes are user-approved v1 technical names (2026-10-15), not historical MF tracker names
 * except DESIGN_REVIEW, FINAL_QC, and LASER_OPERATE which also appear in the DB Tracker.
 */
export const RBAC_V1_MARKER_KEY = 'MEMORA_RBAC_V1_2026_10_15';
export const RBAC_V1_APPROVAL_DATE = '2026-10-15';
export const RBAC_V1_APPROVAL_STATUS = 'APPROVED';
export const RBAC_V1_SCHEMA_VERSION = '1.0.0';
export const RBAC_V1_EXPECTED = {
  roles: 6,
  permissions: 45,
  rolePermissionMappings: 48,
} as const;

export const PERMISSION_DEFINITIONS = [
${defs},
] as const;

export type PermissionDefinition = (typeof PERMISSION_DEFINITIONS)[number];
export type PermissionCode = PermissionDefinition['code'];
export type PermissionDomain = PermissionDefinition['domain'];

export const PERMISSIONS = Object.fromEntries(
  PERMISSION_DEFINITIONS.map((definition) => [
    definition.code,
    definition.code,
  ]),
) as { readonly [Code in PermissionCode]: Code };

export const RBAC_V1_ROLE_CODES = [
  'CUSTOMER',
  'STORE_STAFF',
  'MANAGER',
  'JEWELER',
  'DELIVERY_STAFF',
  'ADMIN',
] as const;

export type RbacV1RoleCode = (typeof RBAC_V1_ROLE_CODES)[number];

export const RBAC_V1_ROLE_PERMISSIONS = {
${grants},
} as const satisfies Record<RbacV1RoleCode, readonly PermissionCode[]>;

export type ApprovedGrantPair = {
  readonly roleCode: RbacV1RoleCode;
  readonly permissionCode: PermissionCode;
};

export function listApprovedGrantPairs(): readonly ApprovedGrantPair[] {
  const pairs: ApprovedGrantPair[] = [];
  for (const roleCode of [...RBAC_V1_ROLE_CODES].sort()) {
    const codes = RBAC_V1_ROLE_PERMISSIONS[roleCode];
    for (const permissionCode of [...codes].sort()) {
      pairs.push({ roleCode, permissionCode });
    }
  }
  return pairs;
}

export function rbacV1GrantsChecksum(): string {
  const payload = listApprovedGrantPairs()
    .map((pair) => \`\${pair.roleCode}\\t\${pair.permissionCode}\`)
    .join('\\n');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
`;

const out = path.join(root, 'libs/contracts/src/iam/permissions.ts');
fs.writeFileSync(out, content);
console.log(`wrote ${path.relative(root, out)}`);
