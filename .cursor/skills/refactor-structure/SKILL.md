---
name: refactor-structure
description: Move or reorganize MEMORA NestJS modules/files while preserving API and DI behavior; feature-first Gateway, thin service adapters, no speculative rewrites.
---
# Structural Refactor

1. Before editing, inventory file ownership/imports, Nest modules/providers, routes, tests, config and build baseline. Read `docs/architecture/api-gateway-structure.md` if present.
2. Propose target tree using Domain -> Feature -> Layer; create no empty dirs/modules. Keep domain `<domain>.module.ts` and shared `clients/` only if they are used.
3. Move code with history-preserving operations if Git is available; on Windows handle file locks without deleting original. Preserve identifiers/contracts.
4. Update imports, barrel exports only if necessary, Jest paths, Swagger, DI providers and APP_GUARD ordering. Avoid duplicate gRPC clients or lazy global modules.
5. Verify TS, ESLint, tests, builds, HTTP route list. Restart running process before claiming live behavior reflects the new code.
6. Report before/after, moved files, unchanged contracts and failures. **No new features, schema or seed** in structural tasks.
