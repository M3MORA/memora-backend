---
name: debug-and-fix
description: Diagnose and fix a MEMORA bug, compile failure, E2E regression or runtime error with minimal edits and a focused regression test.
---
# Debug and Fix

1. Reproduce once if feasible; record exact command/error/route. Determine current process build/version before trusting a localhost smoke test.
2. Trace only the implicated feature and its imports/contracts/providers. Check underlying TS resolution/config before patching downstream `no-unsafe-*` diagnostics.
3. Form one falsifiable root-cause hypothesis; inspect nearby tests/data. Avoid scanning the whole monorepo or mass-updating files.
4. Apply smallest fix. Do not delete guards, disable ESLint/strict mode, add broad try/catch, or change public behavior to quiet tests.
5. Add a focused regression test. Re-run reproduction, then affected typecheck/lint/tests/build.
6. Report root cause, exact changed files, proof, and anything not verified. If only a running old process was tested, state that clearly.
