import { createHash } from 'node:crypto';

/**
 * MEMORA RBAC v1 permission registry.
 * Canonical runtime catalog. Approval spec: `rbac-v1.approved.json`.
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
  {
    code: 'IAM_USER_READ',
    name: 'Read user accounts',
    description: 'Read administrative user identity and account status.',
    domain: 'IAM',
    businessSource: 'IAM admin extension; user-approved RBAC v1',
  },
  {
    code: 'IAM_USER_PROVISION',
    name: 'Provision staff accounts',
    description:
      'Provision staff and administrative accounts; never use public signup.',
    domain: 'IAM',
    businessSource: 'IAM admin extension; user-approved RBAC v1',
  },
  {
    code: 'IAM_USER_STATUS_MANAGE',
    name: 'Manage user status',
    description:
      'Lock, disable and activate accounts subject to security checks.',
    domain: 'IAM',
    businessSource: 'IAM admin extension; user-approved RBAC v1',
  },
  {
    code: 'IAM_USER_ROLE_ASSIGN',
    name: 'Assign user roles',
    description: 'Assign/revoke staff roles with actor attribution and audit.',
    domain: 'IAM',
    businessSource: 'IAM admin extension; user-approved RBAC v1',
  },
  {
    code: 'IAM_RBAC_MANAGE',
    name: 'Manage RBAC mappings',
    description: 'Manage grants using controlled, audited operations.',
    domain: 'IAM',
    businessSource: 'IAM admin extension; user-approved RBAC v1',
  },
  {
    code: 'CATALOG_TEMPLATE_MANAGE',
    name: 'Manage ring templates',
    description: 'Manage ring template definitions and lifecycle.',
    domain: 'CATALOG_INVENTORY',
    businessSource: 'MF01-07; user-approved RBAC v1',
  },
  {
    code: 'CATALOG_VARIANT_MANAGE',
    name: 'Manage template variants',
    description: 'Maintain approved physical variants and constraints.',
    domain: 'CATALOG_INVENTORY',
    businessSource: 'MF01-08; MF04-19; user-approved RBAC v1',
  },
  {
    code: 'CATALOG_OPTION_MANAGE',
    name: 'Manage catalog options',
    description: 'Maintain material, size, gemstone and compatibility options.',
    domain: 'CATALOG_INVENTORY',
    businessSource: 'MF01-07; user-approved RBAC v1',
  },
  {
    code: 'INVENTORY_ALLOCATE',
    name: 'Allocate inventory',
    description: 'Allocate ring blanks and gemstones to authorized production.',
    domain: 'CATALOG_INVENTORY',
    businessSource: 'MF04-03; user-approved RBAC v1',
  },
  {
    code: 'CART_MANAGE_OWN',
    name: 'Manage own cart',
    description: 'Create, edit and remove drafts in the subject’s own cart.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF01-13 to MF01-20; user-approved RBAC v1',
  },
  {
    code: 'ORDER_CREATE',
    name: 'Create order',
    description: 'Create order from validated cart/checkout.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF01-22; MF02-01; user-approved RBAC v1',
  },
  {
    code: 'ORDER_READ_OWN',
    name: 'Read own orders',
    description: 'Read only orders belonging to verified customer identity.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF02-19 to MF02-20; user-approved RBAC v1',
  },
  {
    code: 'ORDER_READ_OPERATIONS',
    name: 'Read operational orders',
    description: 'Read orders only within role-authorized operational scope.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF02; MF05; user-approved RBAC v1',
  },
  {
    code: 'ORDER_FINAL_CONFIRM',
    name: 'Confirm own final quote',
    description: 'Confirm current ring item versions and final quote.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF03-08; user-approved RBAC v1',
  },
  {
    code: 'ORDER_CANCEL_REQUEST_OWN',
    name: 'Request own order cancellation',
    description:
      'Request cancellation; service enforces stage and cancellation policy.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF03-14; user-approved RBAC v1',
  },
  {
    code: 'DESIGN_SUBMIT_OWN',
    name: 'Submit own design for review',
    description: 'Submit eligible personalized ring item version.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF02-15 to MF02-17; MF03-01; user-approved RBAC v1',
  },
  {
    code: 'DESIGN_REVIEW',
    name: 'Review submitted design',
    description:
      'Manager approve/request changes on exact submitted design version.',
    domain: 'ORDERING_DESIGN',
    businessSource:
      'MF03-02 to MF03-03; code appears in DB Tracker; user-approved RBAC v1',
  },
  {
    code: 'DESIGN_CHANGE_APPROVE',
    name: 'Approve design change',
    description: 'Approve controlled design changes before production lock.',
    domain: 'ORDERING_DESIGN',
    businessSource: 'MF03-05 to MF03-06; user-approved RBAC v1',
  },
  {
    code: 'SOURCE_CAPTURE',
    name: 'Capture fingerprint at store',
    description:
      'Store Staff capture with P1, consent, device and session gates.',
    domain: 'PERSONALIZATION',
    businessSource: 'MF02-07; user-approved RBAC v1',
  },
  {
    code: 'SOURCE_AUDIO_UPLOAD_OWN',
    name: 'Upload own audio',
    description: 'Record/upload source audio for permitted ring item.',
    domain: 'PERSONALIZATION',
    businessSource: 'MF02-09 to MF02-10; user-approved RBAC v1',
  },
  {
    code: 'PRODUCTION_PLAN',
    name: 'Plan production',
    description: 'Plan production release and work order preparation.',
    domain: 'PRODUCTION',
    businessSource: 'MF04-01 to MF04-03; user-approved RBAC v1',
  },
  {
    code: 'PRODUCTION_ASSIGN',
    name: 'Assign production work',
    description:
      'Assign jeweler subject to skill, permission and work order checks.',
    domain: 'PRODUCTION',
    businessSource: 'MF04-17; user-approved RBAC v1',
  },
  {
    code: 'PRODUCTION_STEP_EXECUTE',
    name: 'Execute assigned production step',
    description: 'Execute only assigned and eligible production steps.',
    domain: 'PRODUCTION',
    businessSource: 'MF04-06; MF04-17; user-approved RBAC v1',
  },
  {
    code: 'LASER_OPERATE',
    name: 'Operate laser',
    description:
      'Operate laser only with active laser skill and eligible assignment/package.',
    domain: 'PRODUCTION',
    businessSource:
      'MF04-08; MF04-17; code appears in DB Tracker; user-approved RBAC v1',
  },
  {
    code: 'FINAL_QC',
    name: 'Record final QC',
    description:
      'Record final QC with manager-only and segregation-of-duty checks.',
    domain: 'PRODUCTION',
    businessSource:
      'MF04-11 to MF04-13; code appears in DB Tracker; user-approved RBAC v1',
  },
  {
    code: 'PRODUCTION_DISPOSITION',
    name: 'Decide production disposition',
    description: 'Authorize REWORK, REMAKE or SCRAP with traceability.',
    domain: 'PRODUCTION',
    businessSource: 'MF04-13; MF04-16; user-approved RBAC v1',
  },
  {
    code: 'PRODUCTION_EXCEPTION_APPROVE',
    name: 'Approve production exception',
    description:
      'Review and approve scoped deviations without mutating DESIGN_LOCK.',
    domain: 'PRODUCTION',
    businessSource: 'MF04-06; user-approved RBAC v1',
  },
  {
    code: 'FULFILLMENT_PREFERENCE_UPDATE_OWN',
    name: 'Update own fulfillment preferences',
    description: 'Request permitted fulfillment/address changes.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-04; MF05-17; user-approved RBAC v1',
  },
  {
    code: 'DELIVERY_ASSIGN',
    name: 'Assign delivery staff',
    description: 'Assign a delivery task to appropriate staff.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-15; user-approved RBAC v1',
  },
  {
    code: 'DELIVERY_REASSIGN',
    name: 'Reassign delivery staff',
    description: 'Reassign task with reason and immutable history.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-15; user-approved RBAC v1',
  },
  {
    code: 'DELIVERY_ACCEPT',
    name: 'Accept delivery task',
    description: 'Accept/decline only task assigned to current delivery staff.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-15; user-approved RBAC v1',
  },
  {
    code: 'DELIVERY_UPDATE',
    name: 'Update delivery task',
    description: 'Update progress/failure for assigned delivery task only.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-15 to MF05-16; user-approved RBAC v1',
  },
  {
    code: 'DELIVERY_DISPATCH',
    name: 'Dispatch delivery package',
    description: 'Record store-to-driver package handoff and checks.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-16; user-approved RBAC v1',
  },
  {
    code: 'RECIPIENT_VERIFY',
    name: 'Verify recipient',
    description: 'Verify QR/recipient identity for authorized handover.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-05; MF05-18; user-approved RBAC v1',
  },
  {
    code: 'HANDOVER_RECORD',
    name: 'Record handover',
    description: 'Record immutable proof of physical handover.',
    domain: 'FULFILLMENT',
    businessSource: 'MF05-06; MF05-16; user-approved RBAC v1',
  },
  {
    code: 'CLAIM_SUBMIT_OWN',
    name: 'Submit own claim',
    description: 'Submit claim for own eligible ring item after handover.',
    domain: 'AFTER_SALES_PRIVACY',
    businessSource: 'MF06-02; user-approved RBAC v1',
  },
  {
    code: 'CLAIM_CREATE_ON_BEHALF',
    name: 'Create claim on behalf of customer',
    description:
      'Store intake acting on verified customer behalf, with attribution.',
    domain: 'AFTER_SALES_PRIVACY',
    businessSource: 'MF06-02; user-approved RBAC v1',
  },
  {
    code: 'CLAIM_INTAKE',
    name: 'Intake after-sales item',
    description: 'Create custody intake for claim/ring item.',
    domain: 'AFTER_SALES_PRIVACY',
    businessSource: 'MF06-07; user-approved RBAC v1',
  },
  {
    code: 'CLAIM_DECIDE',
    name: 'Decide after-sales claim',
    description: 'Decide warranty, return or maintenance path with evidence.',
    domain: 'AFTER_SALES_PRIVACY',
    businessSource: 'MF06-08; user-approved RBAC v1',
  },
  {
    code: 'CLAIM_SERVICE_QUOTE_MANAGE',
    name: 'Manage service quote',
    description:
      'Manage maintenance service quote subject to commercial/payment gates.',
    domain: 'AFTER_SALES_PRIVACY',
    businessSource: 'MF06-09; manager mapping user-approved RBAC v1',
  },
  {
    code: 'DATA_RIGHTS_REQUEST_OWN',
    name: 'Request personal data rights',
    description: 'Submit verified data rights request for own data.',
    domain: 'AFTER_SALES_PRIVACY',
    businessSource: 'MF06-06; user-approved RBAC v1',
  },
  {
    code: 'DATA_RIGHTS_PROCESS',
    name: 'Process data rights request',
    description: 'Verify requester and process approved data rights workflow.',
    domain: 'AFTER_SALES_PRIVACY',
    businessSource: 'MF06-06; user-approved RBAC v1',
  },
  {
    code: 'MEMORY_MANAGE_OWN',
    name: 'Manage own memory',
    description: 'Manage digital memory owned by verified customer identity.',
    domain: 'MEMORY',
    businessSource: 'MF05-09 to MF05-12; user-approved RBAC v1',
  },
  {
    code: 'MEMORY_SHARE_OWN',
    name: 'Share own memory',
    description: 'Invite recipient to owner-controlled memory access.',
    domain: 'MEMORY',
    businessSource: 'MF05-12; MF05-21 to MF05-23; user-approved RBAC v1',
  },
  {
    code: 'MEMORY_REVOKE_SHARE_OWN',
    name: 'Revoke own memory share',
    description: 'Revoke memory access while retaining ownership.',
    domain: 'MEMORY',
    businessSource: 'MF05-12; MF05-22; user-approved RBAC v1',
  },
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
  CUSTOMER: [
    'CART_MANAGE_OWN',
    'ORDER_CREATE',
    'ORDER_READ_OWN',
    'ORDER_FINAL_CONFIRM',
    'ORDER_CANCEL_REQUEST_OWN',
    'DESIGN_SUBMIT_OWN',
    'SOURCE_AUDIO_UPLOAD_OWN',
    'FULFILLMENT_PREFERENCE_UPDATE_OWN',
    'CLAIM_SUBMIT_OWN',
    'DATA_RIGHTS_REQUEST_OWN',
    'MEMORY_MANAGE_OWN',
    'MEMORY_SHARE_OWN',
    'MEMORY_REVOKE_SHARE_OWN',
  ],
  STORE_STAFF: [
    'ORDER_READ_OPERATIONS',
    'SOURCE_CAPTURE',
    'DELIVERY_DISPATCH',
    'RECIPIENT_VERIFY',
    'HANDOVER_RECORD',
    'CLAIM_CREATE_ON_BEHALF',
    'CLAIM_INTAKE',
  ],
  MANAGER: [
    'CATALOG_TEMPLATE_MANAGE',
    'CATALOG_VARIANT_MANAGE',
    'CATALOG_OPTION_MANAGE',
    'INVENTORY_ALLOCATE',
    'ORDER_READ_OPERATIONS',
    'DESIGN_REVIEW',
    'DESIGN_CHANGE_APPROVE',
    'PRODUCTION_PLAN',
    'PRODUCTION_ASSIGN',
    'FINAL_QC',
    'PRODUCTION_DISPOSITION',
    'PRODUCTION_EXCEPTION_APPROVE',
    'DELIVERY_ASSIGN',
    'DELIVERY_REASSIGN',
    'CLAIM_DECIDE',
    'CLAIM_SERVICE_QUOTE_MANAGE',
  ],
  JEWELER: ['PRODUCTION_STEP_EXECUTE', 'LASER_OPERATE'],
  DELIVERY_STAFF: [
    'DELIVERY_ACCEPT',
    'DELIVERY_UPDATE',
    'RECIPIENT_VERIFY',
    'HANDOVER_RECORD',
  ],
  ADMIN: [
    'IAM_USER_READ',
    'IAM_USER_PROVISION',
    'IAM_USER_STATUS_MANAGE',
    'IAM_USER_ROLE_ASSIGN',
    'IAM_RBAC_MANAGE',
    'DATA_RIGHTS_PROCESS',
  ],
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
    .map((pair) => `${pair.roleCode}\t${pair.permissionCode}`)
    .join('\n');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
