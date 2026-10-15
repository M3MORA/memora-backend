---
name: implement-http-api
description: Add or update a MEMORA NestJS Gateway REST endpoint using an existing or new owning-service gRPC method; preserve Domain-Feature-Layer, DTO, Swagger, auth and tests.
---
# Implement a Gateway HTTP API

## Enter when
User requests a REST API/CRUD HTTP handler or changes its contract. Do not use for folder-only refactor or explanation.

## Procedure
1. Scope: identify `<domain>/<feature>` and owning business service. Enumerate existing routes/RPCs/DTOs; confirm expected business behavior and permission status. Read only relevant files and `docs/ai/context-map.md`.
2. **Reuse existing RPC when sufficient.** If a new RPC is necessary, follow `create-grpc-rpc`; do not start by editing proto unconditionally.
3. Implement service-owned invariants and resource authorization; persist only through its repositories.
4. In Gateway, add feature-local `controllers/`, `dto/request`, `dto/response`, `mappers`, `docs` as needed. HTTP DTO classes validate input; map to RPC; preserve response interceptor and filter.
5. Register controller/provider in domain `<domain>.module.ts` unless feature module justified. Add `@Public()` only if truly public. Use approved `@RequirePermissions` constant only when catalog grants exist. Missing approval => report blocker, never invent permission.
6. Test success, validation, unauthenticated, forbidden, owner mismatch, internal gRPC failure, DTO/proto mapping; verify Swagger and regression cases.
7. Run focused typecheck/lint/tests/build. Report observed results; don't claim live smoke without running it.

## Stop-and-ask cases
Breaking HTTP/proto, new domain service, unknown data ownership, unapproved permission/migration, payment/biometric/data-rights policy ambiguity.
