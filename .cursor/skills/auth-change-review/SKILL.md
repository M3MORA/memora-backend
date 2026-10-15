---
name: auth-change-review
description: Review and implement MEMORA IAM/Google OAuth/JWT/Refresh/RBAC changes with trust-boundary tests before accepting an authentication change.
---
# Authentication/Authorization change

1. Identify whether task is **authentication**, **function permission**, **resource ownership**, or **service authentication**. These are distinct controls.
2. Inspect actual Gateway guards and IAM RPCs, tokens/session lifecycle, cookie/CSRF/CORS, state/PKCE, Google ID verification and internal gRPC credentials. Do not read `.env` secrets; use `.env.example`.
3. Design threats: spoofed userId, OAuth replay/state reuse, forged provider identity, local↔Google email collision, revoked permission, refresh replay, inactive user, guest identity linking, cross-origin CSRF.
4. Use existing IAM JWT/Redis services, always least privilege. Role codes are not equivalent to object ownership. Never introduce a public token mint path or default admin override.
5. Add tests for 401/403/503, inactive/absent principal, replay, privilege escalation and no leaked tokens. Verify local login/refresh regression alongside Google changes.
6. Report security model and which tests were automated versus genuine provider/network E2E. If Google credentials are absent, mark live OAuth unverified.
