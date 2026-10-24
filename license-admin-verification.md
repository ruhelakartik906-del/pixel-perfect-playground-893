# License Admin verification — 24 October 2026

## Completed
- Existing pages preserved; duplicate in-flight saves/renewals blocked immediately.
- Committed saves are no longer reported as failed merely because a later list refresh fails.
- Fixed a real Admin renewal failure: the validator rejected the database's `+00:00` expiry timestamp. Offset timestamps now pass without losing microseconds, preserving optimistic concurrency checks.
- Removed anonymous and authenticated direct-write grants from installation/audit records. Authenticated accounts have SELECT only; active Super Admin RLS and authorized transactional actions remain required.

## Changed files
- `src/components/admin/CreateCrmAdmin.tsx`
- `src/components/admin/SoldCrmAdmins.tsx`
- `src/lib/crm-installations.ts`
- `src/lib/crm-installations.functions.ts`
- `src/test/crm-installations.test.ts`
- `src/test/crm-installations.local.test.ts`
- `drizzle/migrations/0092_restrict_license_registry_grants.sql` (applied; grants read back)
- Generated database types refreshed by migration tool; roadmap/architecture notes and this report updated.

## Actual checks
- `bunx vitest run`: **356 passed, 127 skipped, 0 failed**, 42 passing files and 10 skipped files. Skipped suites require their own explicit integration-test configuration; they are not claimed as passing.
- `CRM_LICENSE_LOCAL_QA=1 bunx vitest run src/test/crm-installations.local.test.ts src/test/crm-installations.test.ts`: **41 passed, 0 failed**. Includes real disposable PostgreSQL authorization/RLS, duplicate protection, blocked/pending Admin denial, audit tampering denial, unknown/expired license denial, and simultaneous renewal on two connections (one commit, one stale rejection, one new audit).
- Initial concurrency test failed because its JavaScript conversion truncated microseconds; corrected the test to use the exact persisted expiry rather than weakening the lock/check.
- Harness build: **build OK**, latest recorded check after application fixes at 06:37:50 UTC. No manual build/typecheck run.
- `bun run lint`: **failed**, 12,215 errors and 33 warnings across the pre-existing codebase, mostly formatting; no broad unrelated cleanup performed.
- Changed-file ESLint with only the formatting rule disabled: **passed**. This is not a claim that the full lint script passed.

## Browser and persisted state
Authorized real Super Admin session verified both pages, empty list, create form, invalid URL validation, actual temporary record save, list/details after refresh, audit read, real renewal, and unavailable activation with no confirmation action. Database readback showed exactly `create` and `extend`, expiry increased to 2028, and all verification flags false/status Setup Required. Ordinary user's real session was denied both Admin URLs. Screenshots inspected; successful Admin flow had no page errors.

Only a disposable registry entry was used. It created no customer account or remote installation and sent no email. Its exact record and two audit entries were removed; live readback confirmed zero installations/audits. Disposable PostgreSQL was stopped and deleted. No existing account, membership, customer record or role was changed.

Server-error/loading UI fault injection and simultaneous double-click browser behavior were not separately exercised. Populated multi-page pagination and remote tenant-to-tenant testing remain unverified.

## Secure blockers and owner next action
**Customer CRM integration: Setup Required.** No available connector connection was returned. No specific customer CRM provider/API contract, isolated customer backend, provisioning credential, or deployed enforcement interface was supplied/found.

Owner must identify the intended independent customer CRM provider and test installation URL, provide its provisioning/reset/revocation API documentation, and connect a least-privilege server-side credential through the supported connection/secret flow (never paste passwords or keys into chat). The intended customer deployment must implement authenticated installation-bound license checks on every protected server operation, session revocation, and an acknowledged activation/suspension protocol. Then integration and cross-customer tests can be implemented against that isolated test installation.

Creation/renewal of registry records is verified; remote account provisioning, activation, suspension, reset/revocation and actual customer-operation enforcement are **not implemented/verified** and remain fail-closed. The current `crm_installation_license_state` helper is service-only and does not itself protect a remote CRM. Unknown/expired/setup states were checked locally, not on a production customer installation. Do not enable flags manually as a substitute for integration.

No publish, Git push, auto-push configuration change or DNS change was performed. No further migration approval is currently pending. Production readiness is not claimed.