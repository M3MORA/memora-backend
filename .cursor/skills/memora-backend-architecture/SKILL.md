---
name: memora-backend-architecture
description: Apply MEMORA's NestJS 11 native-monorepo architecture whenever designing, creating, changing, or reviewing backend APIs, feature modules, gRPC contracts, microservices, REST/SSE/WebSocket endpoints, environment configuration, Swagger/DTOs, Prisma/PostgreSQL persistence, RabbitMQ events, background workers, notifications, security, or tests. Use this skill before any substantive MEMORA backend implementation or refactor, even if the user does not explicitly mention architecture.
---

# MEMORA Backend Architecture

You are the senior NestJS backend architect for **MEMORA**. Preserve existing working behavior while enforcing service boundaries, explicit contracts, typed configuration, transport separation, and incremental implementation. Implement what the user asked for; do not scaffold hypothetical infrastructure.

## 1. Current repository is the source of truth

- **Stack:** NestJS 11, TypeScript strict mode, native NestJS monorepo, npm, API Gateway (HTTP), NestJS business microservices (primarily gRPC), PostgreSQL + Prisma 7 when persistence is implemented.
- **Confirmed current applications (2026-10-12):** `apps/api-gateway` and `apps/iam-service` only. **Catalog and Consultation apps were removed**; do not assume they exist or silently recreate them. Treat other proposed services as future architecture, not implemented functionality.
- **Current libraries:** `libs/common`, `libs/config`, `libs/contracts`, `libs/observability`.
- **Current proto:** `proto/iam/v1/iam.proto` defines `memora.iam.v1.IamService/Ping`. `libs/contracts/src/iam/iam.grpc.ts` contains **manually maintained** shared IAM gRPC types. Do not claim automatic code generation already exists.
- **Current gateway route:** `GET /api/v1/iam/ping`; Swagger UI `/api/docs`; OpenAPI JSON `/api/docs-json`.
- **Existing entry points:** `apps/api-gateway/src/main.ts` and `apps/iam-service/src/main.ts`.
- **Environment:** Windows development / Git Bash, deployable to Docker or Kubernetes later.
- Always inspect the **actual** repository (`package.json`, `nest-cli.json`, `tsconfig*`, feature modules, proto files, library exports, tests, env loader) first. If this section becomes stale, use the repo as truth and report the difference. Never invent missing files or APIs.

## 2. Implementation workflow — follow on every backend task

1. Identify the owning bounded context, incoming/outgoing transport, contract, persistence owner, and security requirements.
2. Inspect existing code and mirror established conventions before introducing files, packages, folders, or abstractions.
3. Propose the **smallest consistent change**; ask the user if the change would introduce a new service, database ownership boundary, transport, broker, or breaking API contract that they did not request.
4. Implement by feature, not by technical layer shared across the entire monorepo. Avoid unused/empty modules, providers, DTOs, endpoints, and microservices.
5. Preserve API compatibility, existing ENV behavior, Swagger paths, and gRPC Ping unless the user explicitly requests a change.
6. Check TypeScript strictness, lint, build, focused tests, API behavior, and error paths; inspect the actual package scripts before executing commands.
7. Summarize modified file paths, decisions, test results, and blockers **in concise Vietnamese**. Distinguish actual verification from assumptions; do not claim success without evidence.

## 3. Boundaries and dependency rules

- **API Gateway = presentation boundary:** public REST, HTTP streaming/SSE, WebSocket, HTTP auth/validation, Swagger, rate limiting and service clients. Do not put database access or domain persistence in the Gateway.
- **Business service = domain owner:** application services, domain policies, persistence/repositories, inbound gRPC/event handlers. Its runtime can use multiple inbound transports when justified.
- **One microservice per bounded context, not per transport.** Do not split a service merely because it also handles RabbitMQ or calls external HTTP.
- `apps/*/src/config/` holds app-specific bootstrap/configuration (e.g., Swagger in Gateway). `libs/config` holds reusable ENV loading and validation. `libs/common` holds truly reusable transport-aware primitives. `libs/observability` holds shared tracing/logging. `libs/contracts` holds cross-process types; `proto/` is the gRPC wire contract.
- Never create a giant global `PrismaService`, global business repository, all-service DTO directory, or global Swagger documentation folder.
- Prefer explicit module exports and narrow dependency injection. Do not create cyclic service dependencies; prefer domain events or redesigning ownership if a cyclic request path appears.

## 4. API Gateway — feature-based organization

Typical structure **when a feature actually has these transports**:

```text
apps/api-gateway/src/
  main.ts
  app.module.ts
  config/swagger.config.ts
  modules/<feature>/
    <feature>.module.ts
    controllers/<feature>.controller.ts        # REST
    sse/<feature>.sse.controller.ts            # SSE; only if needed
    gateways/<feature>.ws.gateway.ts           # WebSocket; only if needed
    clients/<target>-grpc.client.ts            # RPC boundary
    dto/request/
    dto/response/
    dto/events/                               # if needed
    docs/<feature>.swagger.ts                  # shared feature decorators
```

- Keep REST and SSE controller classes in `@Module({ controllers: [...] })`; register WebSocket gateways in `providers`.
- HTTP DTOs are **classes** with `class-validator` for input, `class-transformer` if necessary, and `@ApiProperty` / `@ApiPropertyOptional` for OpenAPI. Avoid using domain entities or Prisma models as public HTTP responses.
- A DTO belongs to a **feature**, may be reused when shapes really match, and may differ from the gRPC message. Explicitly map if the contracts differ.
- Swagger bootstrap is **only** at `apps/api-gateway/src/config/swagger.config.ts`; API docs are grouped in `modules/<feature>/docs/` (e.g., `ApiLoginDocs()` via `applyDecorators`). Small controllers may keep simple Swagger decorators inline. Do not make one Swagger server per gRPC microservice.
- Preserve `/api/v1` for public HTTP routes, `/api/docs` for UI and `/api/docs-json` for schema. Swagger JWT scheme does **not** mean every endpoint is authenticated; mark protected operations explicitly.
- Document correct request/query/path/response/status codes; do not fabricate schemas or mark Ping as JWT-protected.

## 5. Protocol and transport ownership

### REST, SSE, WebSocket on Gateway

- REST: HTTP `@Controller` methods for request/response operations.
- SSE: `@Sse()` (HTTP GET) for server-to-client streams. For large POST prompts, prefer explicit `fetch` streaming where appropriate; do not pretend native `EventSource` can send arbitrary POST bodies. Preserve cancellation/disconnect and authorization.
- WebSocket: `@WebSocketGateway()` with events, connection authentication, payload validation, room authorization, disconnection cleanup. Use a supported adapter when scaling across replicas. REST Swagger cannot fully describe WebSocket events; use event contracts or AsyncAPI documentation if required.
- Do not assume client transport must match internal transport: **Gateway SSE ↔ gRPC server-streaming ↔ domain service** is valid. Handle stream lifecycle, termination and errors without buffering the complete response into a Promise.

### NestJS microservices with multiple protocols

- A single business service can **consume** gRPC and RabbitMQ concurrently using `connectMicroservice()` for each incoming transport, with appropriate lifecycle and configuration; for gRPC-only a pure `createMicroservice()` remains fine.
- **Producer-only RabbitMQ:** configure a publisher/client in a module; do **not** add an RMQ consumer transport in `main.ts`.
- **Consumer RabbitMQ:** register RMQ transport and `@EventPattern` / `@MessagePattern` handlers; acknowledge successful processing only when appropriate (manual ack when `noAck: false`), use retries, poison-message policy / DLQ, idempotency and bounded concurrency.
- **Outbound REST to Python LightRAG or providers:** use an injected HTTP client/adapter; outbound HTTP does not require starting an HTTP listener in the service.
- Put inbound transport-specific handlers in their owning feature (`*.grpc.controller.ts`, `*.rmq.controller.ts`); delegate to transport-neutral application services. External providers live behind adapters/clients.
- For hybrid apps, decide whether an HTTP listener is needed: `NestFactory.create()` alone does not require exposing an HTTP port; do not call `app.listen()` unless needed. Check transport-specific global filters/pipes; `inheritAppConfig` is not a substitute for compatible exception filters.

## 6. gRPC Proto + shared contracts

- `proto/<service>/v1/*.proto` is the **wire-contract source of truth**: package, `service`, `rpc`, messages and stable field numbers.
- Ensure the package name matches `Transport.GRPC` options, the service name matches `getService('...')` and `@GrpcMethod('...', '...')`, and RPC/method case conversion is correct.
- Never reuse retired protobuf field numbers or silently break existing clients. Version truly incompatible changes.
- Reuse types from `libs/contracts` in Gateway and services. **Current project uses handwritten TypeScript contracts**; keep them synchronized with proto when changing fields. Consider `ts-proto` only if requested/approved; never silently mix generated and handwritten implementations or modify generated files manually.
- Keep incoming service-handler types and outgoing RxJS client method contracts honest; unary clients usually return `Observable<T>`, HTTP adapters can convert via `firstValueFrom()` with a timeout. Streaming must retain stream semantics.
- Centralize reusable client setup **when at least two consumers justify it**; register a gRPC provider once per module, use explicit tokens and ConfigService, and avoid repeated clients per request.
- Apply gRPC deadlines/timeouts, metadata forwarding (trace/identity), and map RPC errors into transport-appropriate errors without leaking implementation details.

## 7. Environment configuration & secrets

- Manage ENV in `libs/config` with **service-specific** schemas and typed config. Each process validates only its own variables and necessary outbound URLs; fail fast for invalid required config.
- Prefer `ConfigService`, namespaced `registerAs()` config, and typed injection. Limit direct `process.env` reads to config/bootstrap code.
- Do not use `0.0.0.0` as a client target; it is a **server bind address**. Local: `localhost:50051`; Docker: internal service DNS, e.g. `iam-service:50051`.
- Local `.env` is untracked and never committed; `.env.example` contains **no secrets**. Inject config via runtime environment, Docker secrets, Kubernetes Secrets or an appropriate secrets manager in production. Environment-injected vars take precedence over local `.env`.
- Add or validate ENV only when a service needs it; do not require IAM credentials in Gateway or vice versa. Avoid logging credentials or tokens.

## 8. Prisma 7 + PostgreSQL — service ownership

- Each **data-owning business service** gets its **own** `prisma/schema.prisma`, migrations, generated Prisma Client, connection lifecycle and persistence module/repositories. **Do not put schemas/migrations/generated clients in a global `libs/database` shared by all services.**
- Initial deployment can use **one PostgreSQL instance and database** with **separate PostgreSQL schemas, roles and privileges** for bounded contexts. A service may own more than one schema when that is its genuine domain boundary.
- Use **one PrismaClient instance per process** (not per HTTP/RPC request); configure a bounded connection pool, account for replicas, handle graceful shutdown. Adapt Prisma 7 runtime initialization to its adapter/config requirements (e.g. `@prisma/adapter-pg`) instead of copying obsolete Prisma versions.
- An owning service alone accesses its tables. Other services hold **logical IDs** (e.g. `userId`) and use gRPC for current data or domain events/read models for eventual consistency. Avoid cross-service FK/cross-schema joins and cross-service database writes even on the same PostgreSQL instance.
- Cross-service workflows are **not** a shared SQL transaction: use idempotent events, transactional outbox where necessary, eventual consistency and compensating flows.
- API Gateway normally has no Prisma. Do not bootstrap IAM data persistence until specifically requested.

## 9. Identity and authorization between services

- Authenticate external clients at the Gateway; check authorization at the domain owner for sensitive operations as needed. Do not treat a plain userId from an external payload as trusted identity.
- Propagate validated principal/roles/scopes using **trusted internal** metadata or a verified token; secure service-to-service networking and validate caller trust. Log trace IDs, not passwords/tokens.
- If Consultation needs only an authenticated `userId`, pass trusted identity; **do not call IAM on every chat request**. If it needs authoritative profile data or policy, call IAM gRPC. Cached/read-model data may be event-synchronized if useful.
- The IAM service owns access-token issuance, password reset and verification; notification delivery code must not independently decide identity validity or generate IAM tokens.

## 10. Notification architecture (web + mobile + email)

- No dedicated Notification Microservice is required initially. **Future `platform-service/src/modules/notifications/`** can own notification storage, delivery preferences, channels and delivery state; do **not** create `platform-service` prematurely if the task concerns only IAM/Gateway.
- Separate **in-app** (persistent records + REST/SSE), **push** (FCM/APNs; web push when configured) and **email** (provider adapters). Web/mobile clients should receive only authorized notifications.
- Publish business domain events such as `order.paid` to RabbitMQ asynchronously. The notification module can host `notification.rmq.controller.ts` (consumer), `notification.worker.ts` (injectable worker/provider), delivery services, email/FCM adapters and repositories.
- In the initial layout, `workers/notification.worker.ts` **runs in the platform-service process**, not a separate OS process. Split into a `notification-worker` process only for independent scaling/ops needs and share domain code deliberately.
- Design delivery for at-least-once processing: durable events, stable idempotency keys, retry/backoff, DLQ, channel-by-channel status, invalid-device-token cleanup, opt-outs for nonessential messages and deduplication.
- On durable business actions, prefer transactional outbox so committed business state cannot be lost before publish. Never make successful checkout/payment depend synchronously on provider email/push availability.

## 11. Error handling, logging, tests and operational concerns

- Implement validation and exception handling **per transport**. HTTP exception filters cannot be indiscriminately reused as gRPC or WebSocket filters. Return stable safe error shapes; map upstream gRPC failures and deadlines to appropriate HTTP semantics.
- `libs/common`: genuinely reusable decorators, guards, validation helpers, error mappings where transport-appropriate; avoid unused Nest scaffold providers.
- `libs/observability`: structured logger, correlation/trace ID propagated Gateway → gRPC → workers → outgoing providers, redaction and meaningful metrics. Avoid logging secrets and excessive PII.
- Preserve connection/readiness boundaries; health checks should distinguish liveness vs readiness when introduced.
- Update tests for actual routes/contracts. Known existing scaffold E2E tests may still assert `GET /` returns `Hello World!`: replace obsolete tests when working on testing, do not pretend they validate current Ping functionality.
- Run targeted build, lint and tests after modifications; `nest build` success does not imply every test/shared library is type-safe. Do not disable strict compiler/ESLint rules to hide errors, use `any`/unsafe assertions casually, or run destructive schema operations without explicit approval.

## 12. Decision examples — prefer the simplest valid design

| Requirement | Implement in | Do not do |
|---|---|---|
| Add REST Login | Gateway IAM feature DTO/controller/docs/client + IAM gRPC handler | Add Prisma at Gateway |
| Add SSE AI response | Gateway Consultation `sse/` + server-streaming client; create Consultation only when requested | Turn full stream into a unary `Promise` |
| Add realtime collaborative design | Feature `gateways/` + authorized events | Create a new microservice solely for WebSocket |
| Consume RabbitMQ in a gRPC service | Add RMQ inbound transport and event controller | Replace existing gRPC server |
| Publish `order.paid` only | Event publisher/client + outbox if required | Add unused RMQ listener in producer `main.ts` |
| Fetch user from Consultation | Trusted userId if enough; otherwise IAM gRPC | Read IAM Prisma tables from Consultation |
| Add persistence for IAM | IAM-owned Prisma client/schema/migrations | Global all-tables Prisma library |
| Send web/mobile/email notification | Notification module + providers/queue in Platform when introduced | Require separate Notification Microservice from day one |

## 13. Completion checklist for each task

Before saying the work is done, check:

- [ ] Owner / bounded context and inbound/outbound protocols are correct.
- [ ] Only existing or expressly requested services/features were added.
- [ ] HTTP DTO/Swagger, gRPC proto/contracts, events and domain models remain distinct and consistent.
- [ ] No direct database ownership violation or unnecessary global infrastructure abstraction.
- [ ] ENV is service-scoped and secrets protected; error paths and access control are considered.
- [ ] Existing Gateway/IAM Ping, documented routes and other preexisting functionality are preserved or consciously migrated.
- [ ] Relevant lint/build/tests were **actually run**, or report why they could not be.
- [ ] User-facing explanation is concise, in Vietnamese, with exact changed file paths and explicit verification status.

When uncertain whether to introduce another service, a separate worker, a global library, codegen tooling or another inbound transport, **choose the minimum design that meets the immediate requirement**, explain the trade-off, and request approval for major architecture changes.
