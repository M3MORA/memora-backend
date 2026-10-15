# MEMORA IAM — RBAC v1 permission matrix

- **Approval:** `APPROVED` by MEMORA user on **2026-10-15**.
- **Canonical spec:** `rbac-v1.approved.json` (6 roles, 45 permissions, 48 mappings).
- **Runtime registry:** `libs/contracts/src/iam/permissions.ts`.
- **Marker key:** `MEMORA_RBAC_V1_2026_10_15`.

Codes besides `DESIGN_REVIEW`, `FINAL_QC`, and `LASER_OPERATE` are **user-approved v1 technical names**. They are not historical names certified by original Main Flow trackers; those three also appear in the DB Tracker.

Sensitive mappings approved in v1:

- `JEWELER` → `LASER_OPERATE`
- `MANAGER` → `CLAIM_SERVICE_QUOTE_MANAGE`

There is **no ADMIN wildcard**. ADMIN has six explicit IAM/privacy grants only.

## Roles (6)

| Code | Public signup |
|---|---|
| `CUSTOMER` | Yes (only this role) |
| `STORE_STAFF` | No |
| `MANAGER` | No |
| `JEWELER` | No |
| `DELIVERY_STAFF` | No |
| `ADMIN` | No |

Existing role UUIDs must not be recreated. Seed inserts missing roles/permissions only.

## Grants (48)

### CUSTOMER (13)

`CART_MANAGE_OWN`, `ORDER_CREATE`, `ORDER_READ_OWN`, `ORDER_FINAL_CONFIRM`, `ORDER_CANCEL_REQUEST_OWN`, `DESIGN_SUBMIT_OWN`, `SOURCE_AUDIO_UPLOAD_OWN`, `FULFILLMENT_PREFERENCE_UPDATE_OWN`, `CLAIM_SUBMIT_OWN`, `DATA_RIGHTS_REQUEST_OWN`, `MEMORY_MANAGE_OWN`, `MEMORY_SHARE_OWN`, `MEMORY_REVOKE_SHARE_OWN`

### STORE_STAFF (7)

`ORDER_READ_OPERATIONS`, `SOURCE_CAPTURE`, `DELIVERY_DISPATCH`, `RECIPIENT_VERIFY`, `HANDOVER_RECORD`, `CLAIM_CREATE_ON_BEHALF`, `CLAIM_INTAKE`

### MANAGER (16)

`CATALOG_TEMPLATE_MANAGE`, `CATALOG_VARIANT_MANAGE`, `CATALOG_OPTION_MANAGE`, `INVENTORY_ALLOCATE`, `ORDER_READ_OPERATIONS`, `DESIGN_REVIEW`, `DESIGN_CHANGE_APPROVE`, `PRODUCTION_PLAN`, `PRODUCTION_ASSIGN`, `FINAL_QC`, `PRODUCTION_DISPOSITION`, `PRODUCTION_EXCEPTION_APPROVE`, `DELIVERY_ASSIGN`, `DELIVERY_REASSIGN`, `CLAIM_DECIDE`, `CLAIM_SERVICE_QUOTE_MANAGE`

### JEWELER (2)

`PRODUCTION_STEP_EXECUTE`, `LASER_OPERATE`

### DELIVERY_STAFF (4)

`DELIVERY_ACCEPT`, `DELIVERY_UPDATE`, `RECIPIENT_VERIFY`, `HANDOVER_RECORD`

### ADMIN (6)

`IAM_USER_READ`, `IAM_USER_PROVISION`, `IAM_USER_STATUS_MANAGE`, `IAM_USER_ROLE_ASSIGN`, `IAM_RBAC_MANAGE`, `DATA_RIGHTS_PROCESS`

`ORDER_READ_OPERATIONS`, `RECIPIENT_VERIFY`, and `HANDOVER_RECORD` are granted to more than one role (48 mappings of 45 distinct codes).

## Permission catalog (45)

| Domain | Code | Name | Business source |
|---|---|---|---|
| IAM | `IAM_USER_READ` | Read user accounts | IAM admin extension; user-approved RBAC v1 |
| IAM | `IAM_USER_PROVISION` | Provision staff accounts | IAM admin extension; user-approved RBAC v1 |
| IAM | `IAM_USER_STATUS_MANAGE` | Manage user status | IAM admin extension; user-approved RBAC v1 |
| IAM | `IAM_USER_ROLE_ASSIGN` | Assign user roles | IAM admin extension; user-approved RBAC v1 |
| IAM | `IAM_RBAC_MANAGE` | Manage RBAC mappings | IAM admin extension; user-approved RBAC v1 |
| CATALOG_INVENTORY | `CATALOG_TEMPLATE_MANAGE` | Manage ring templates | MF01-07; user-approved RBAC v1 |
| CATALOG_INVENTORY | `CATALOG_VARIANT_MANAGE` | Manage template variants | MF01-08; MF04-19; user-approved RBAC v1 |
| CATALOG_INVENTORY | `CATALOG_OPTION_MANAGE` | Manage catalog options | MF01-07; user-approved RBAC v1 |
| CATALOG_INVENTORY | `INVENTORY_ALLOCATE` | Allocate inventory | MF04-03; user-approved RBAC v1 |
| ORDERING_DESIGN | `CART_MANAGE_OWN` | Manage own cart | MF01-13 to MF01-20; user-approved RBAC v1 |
| ORDERING_DESIGN | `ORDER_CREATE` | Create order | MF01-22; MF02-01; user-approved RBAC v1 |
| ORDERING_DESIGN | `ORDER_READ_OWN` | Read own orders | MF02-19 to MF02-20; user-approved RBAC v1 |
| ORDERING_DESIGN | `ORDER_READ_OPERATIONS` | Read operational orders | MF02; MF05; user-approved RBAC v1 |
| ORDERING_DESIGN | `ORDER_FINAL_CONFIRM` | Confirm own final quote | MF03-08; user-approved RBAC v1 |
| ORDERING_DESIGN | `ORDER_CANCEL_REQUEST_OWN` | Request own order cancellation | MF03-14; user-approved RBAC v1 |
| ORDERING_DESIGN | `DESIGN_SUBMIT_OWN` | Submit own design for review | MF02-15 to MF02-17; MF03-01; user-approved RBAC v1 |
| ORDERING_DESIGN | `DESIGN_REVIEW` | Review submitted design | MF03-02 to MF03-03; code appears in DB Tracker; user-approved RBAC v1 |
| ORDERING_DESIGN | `DESIGN_CHANGE_APPROVE` | Approve design change | MF03-05 to MF03-06; user-approved RBAC v1 |
| PERSONALIZATION | `SOURCE_CAPTURE` | Capture fingerprint at store | MF02-07; user-approved RBAC v1 |
| PERSONALIZATION | `SOURCE_AUDIO_UPLOAD_OWN` | Upload own audio | MF02-09 to MF02-10; user-approved RBAC v1 |
| PRODUCTION | `PRODUCTION_PLAN` | Plan production | MF04-01 to MF04-03; user-approved RBAC v1 |
| PRODUCTION | `PRODUCTION_ASSIGN` | Assign production work | MF04-17; user-approved RBAC v1 |
| PRODUCTION | `PRODUCTION_STEP_EXECUTE` | Execute assigned production step | MF04-06; MF04-17; user-approved RBAC v1 |
| PRODUCTION | `LASER_OPERATE` | Operate laser | MF04-08; MF04-17; code appears in DB Tracker; user-approved RBAC v1 |
| PRODUCTION | `FINAL_QC` | Record final QC | MF04-11 to MF04-13; code appears in DB Tracker; user-approved RBAC v1 |
| PRODUCTION | `PRODUCTION_DISPOSITION` | Decide production disposition | MF04-13; MF04-16; user-approved RBAC v1 |
| PRODUCTION | `PRODUCTION_EXCEPTION_APPROVE` | Approve production exception | MF04-06; user-approved RBAC v1 |
| FULFILLMENT | `FULFILLMENT_PREFERENCE_UPDATE_OWN` | Update own fulfillment preferences | MF05-04; MF05-17; user-approved RBAC v1 |
| FULFILLMENT | `DELIVERY_ASSIGN` | Assign delivery staff | MF05-15; user-approved RBAC v1 |
| FULFILLMENT | `DELIVERY_REASSIGN` | Reassign delivery staff | MF05-15; user-approved RBAC v1 |
| FULFILLMENT | `DELIVERY_ACCEPT` | Accept delivery task | MF05-15; user-approved RBAC v1 |
| FULFILLMENT | `DELIVERY_UPDATE` | Update delivery task | MF05-15 to MF05-16; user-approved RBAC v1 |
| FULFILLMENT | `DELIVERY_DISPATCH` | Dispatch delivery package | MF05-16; user-approved RBAC v1 |
| FULFILLMENT | `RECIPIENT_VERIFY` | Verify recipient | MF05-05; MF05-18; user-approved RBAC v1 |
| FULFILLMENT | `HANDOVER_RECORD` | Record handover | MF05-06; MF05-16; user-approved RBAC v1 |
| AFTER_SALES_PRIVACY | `CLAIM_SUBMIT_OWN` | Submit own claim | MF06-02; user-approved RBAC v1 |
| AFTER_SALES_PRIVACY | `CLAIM_CREATE_ON_BEHALF` | Create claim on behalf of customer | MF06-02; user-approved RBAC v1 |
| AFTER_SALES_PRIVACY | `CLAIM_INTAKE` | Intake after-sales item | MF06-07; user-approved RBAC v1 |
| AFTER_SALES_PRIVACY | `CLAIM_DECIDE` | Decide after-sales claim | MF06-08; user-approved RBAC v1 |
| AFTER_SALES_PRIVACY | `CLAIM_SERVICE_QUOTE_MANAGE` | Manage service quote | MF06-09; manager mapping user-approved RBAC v1 |
| AFTER_SALES_PRIVACY | `DATA_RIGHTS_REQUEST_OWN` | Request personal data rights | MF06-06; user-approved RBAC v1 |
| AFTER_SALES_PRIVACY | `DATA_RIGHTS_PROCESS` | Process data rights request | MF06-06; user-approved RBAC v1 |
| MEMORY | `MEMORY_MANAGE_OWN` | Manage own memory | MF05-09 to MF05-12; user-approved RBAC v1 |
| MEMORY | `MEMORY_SHARE_OWN` | Share own memory | MF05-12; MF05-21 to MF05-23; user-approved RBAC v1 |
| MEMORY | `MEMORY_REVOKE_SHARE_OWN` | Revoke own memory share | MF05-12; MF05-22; user-approved RBAC v1 |

## IAM CheckPermissions vs contextual authorization

IAM `CheckPermissions` is **ALL** of the requested **active** permissions granted through **active** roles and **non-revoked** `user_roles`. Unknown/inactive codes deny. `CheckRoles` remains **ANY**. LOCKED/DISABLED accounts receive no roles/permissions. Fail closed if IAM/Postgres is unavailable.

RBAC is **not** resource ownership. Future owning services must still enforce:

- Customer/guest: `customer_identities.id` is the ownership principal. Do not treat email match or unlinked `userId` as ownership. Guest OTP is not a fake CUSTOMER JWT.
- `LASER_OPERATE`: active `LASER_ENGRAVING` skill at required level, current assigned jeweler, eligible Work Order, approved Production Package.
- `FINAL_QC`: Manager plus separation of duties (no self-QC) in Production Service.
- `SOURCE_CAPTURE`: P1 + consent + staff + device + capture session; no remote customer fingerprint upload.
- Delivery mutations: assigned task, valid state, custody chain. Store and Delivery record handover in their own scopes.
- Memory: owner identity, entitlement, access-grant/PIN.
- `DATA_RIGHTS_PROCESS`: verified data-subject request. ADMIN does not override resource ownership.

## Data operations

| Operation | Writes `role_permissions`? | Idempotency |
|---|---|---|
| `npm run prisma:iam:seed` | No | Inserts missing permissions by `code`; never rewrites UUIDs, never reactivates disabled rows, never overwrites metadata |
| `npm run iam:rbac-v1:dry-run` | No | Read-only comparison |
| `npm run iam:rbac-v1:apply` | Yes, first successful run only | Durable row in `iam.rbac_bootstrap_executions`; later apply does not restore deleted grants |

Apply is refused for `NODE_ENV=production` and non-localhost database hosts. Unexpected existing mappings fail apply for human review; they are not deleted and not treated as approved.
