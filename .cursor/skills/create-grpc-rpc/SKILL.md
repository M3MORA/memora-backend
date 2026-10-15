---
name: create-grpc-rpc
description: Create or evolve a MEMORA protobuf/gRPC method and its handwritten TypeScript contracts, implementation and Gateway client with safe compatibility.
---
# Create/Change gRPC RPC

1. Determine if an existing RPC suffices. Map current `.proto` package/service/fields and existing TS interface; read the owning service controller/application and Gateway adapter.
2. Explain changes to wire schema: fields/new numbers, optional/presence semantics, errors, caller trust, streaming/unary, timeout; ask before breaking contract.
3. Change `proto/<domain>/v1/*.proto` first **only if required**. Reserve retired numbers/names. Do not introduce `ts-proto` unless approved; follow existing handwritten `@app/contracts` mirror.
4. Implement handler as transport adapter calling existing/extended application method. No Prisma in RPC controller.
5. Update Gateway domain gRPC client if needed, always attach internal caller auth and convert transport errors at edge. Do not rewrite global filters.
6. Tests: proto/type field alignment, errors, credentials/actor spoofing, retry/deadline (avoid automatic retries for non-idempotent mutations).
7. Run focused typecheck/lint/build and report. Be explicit if live gRPC wasn't exercised.
