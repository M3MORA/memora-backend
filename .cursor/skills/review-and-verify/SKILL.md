---
name: review-and-verify
description: Audit a MEMORA implementation or PR for scope, architecture, security, contracts, type safety, tests and evidence without inventing fixes.
---
# Review and Verify

1. Review diff/change list, requested acceptance criteria and owner boundaries. Do not make edits unless asked.
2. Check unexpected files/packages/schema/API changes, auth bypass, DI duplication, unsafe environment handling, protobuf compatibility, DB/permission approval and leaks.
3. Use `docs/ai/verification-matrix.md` to choose focused commands (cheap first). Never claim a check not run.
4. Distinguish code tests, mock E2E, live IAM/Postgres/Redis smoke, and live Google login. Check process was restarted on latest code.
5. Report findings **ordered by severity**, concrete file/symbol, reproduction/proof and minimal remediation. Separate unsupported conclusions from verified facts.
