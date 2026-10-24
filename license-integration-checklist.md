# License integration readiness and safe test plan

Review date: 24 October 2026. This is a requirements checklist, not an implemented provider contract or production-readiness claim.

## Owner's next single action
Provide one **non-secret integration brief** identifying the customer CRM provider/product/version (or the owner-built CRM), two independent disposable customer test installations and their HTTPS URLs, and the official API documentation links. Include who controls the customer deployment and which test operations are approved. Do not provide credentials in chat.

Provider, installation identity and API endpoints cannot be inferred from a CRM URL or from the central registry. No available connector connections were returned during this review. No provider has been selected; no remote lifecycle contract exists in this project yet.

## Contract information required before implementation
- [ ] Provider/product/version, API base URL, API documentation and sandbox availability.
- [ ] Two independent test installations A/B, immutable provider tenant/installation identifiers, and proof that each points to its own intended backend rather than this central CRM or the legacy app.
- [ ] Provisioning API: invitation/account creation, existing-account collision behavior, invitation acceptance and rollback; customer Admin role must be scoped to its intended installation only.
- [ ] Activation/suspension API: exact method/payload, version/precondition, acknowledged effective state, operation status/readback, and enforcement acknowledgement.
- [ ] Renewal API or agreed central-authority protocol: exact UTC expiry with precision preserved, calendar-year semantics, effective version and readback.
- [ ] Reset/revocation API: distinguish password recovery from session/token revocation; identity preservation, token lifetime, all-session invalidation and old-token rejection.
- [ ] License-check protocol: caller authentication, immutable installation binding, response fields/statuses, signed data if used, expiry/clock rules and every protected customer operation that must enforce it.
- [ ] Failure contract: unknown, unverified, expired, suspended and setup-required states; provider outage, timeout, partial acknowledgement and reconciliation behavior. No optimistic success based only on a label.
- [ ] Retry/concurrency contract: provider-supported idempotency keys, operation IDs, replay window, duplicate response semantics, stale version rejection and a way to read operation outcome after an ambiguous timeout.
- [ ] Any callback/webhook contract: signature verification, timestamp/replay protection and callback URLs. Do not invent paths or deploy callbacks before knowing the provider requirements.
- [ ] Provider credential type/scopes and test authority: least-privilege server-only access, credential owner, rotation/revocation procedure and separation of test/production accounts.

Once the provider is known, inspect the matching connector and use its secure connection flow. If no applicable connector exists, explain the credential setup and request it through the project's secure configuration form after approval. Never store credentials in source, browser storage, screenshots, logs or returned error details. No secret form is needed before identifying the provider.

## Implementation acceptance gates
1. Keep all setup-dependent actions unavailable until independently verified connection, customer provisioning and server enforcement are present. Never manually toggle flags as proof of completion.
2. Authenticate each central privileged action and authorize the active Super Admin before accessing credentials. Keep ordinary users outside registry/audit writes and central license probes.
3. Bind every remote call and acknowledgement to its intended immutable installation ID, not merely an email or supplied URL. Super Admin central oversight is intentionally global; that is not a customer tenant permission.
4. Define pending/failed/reconciled operation persistence before implementing distributed lifecycle writes. A local transaction cannot atomically commit a remote provider call.
5. Persist verified provider outcomes and audit actor, operation/version, intended installation, before/after state and safe error category. Keep secrets and provider-sensitive details out of audit JSON.
6. Preserve the central license lock and exact-expiry precondition. Add durable idempotency/reconciliation only against the real provider contract; no blind retry after ambiguous completion.
7. Enforce license state on the customer server's protected reads/writes, not just login or visible navigation. Define no-access behavior during unavailable/unverified checks and test it.

## Safe end-to-end test plan (blocked until contract and sandbox exist)
Use only approved disposable A/B installations and separate Admin/customer A/customer B sessions. Capture safe operation IDs and outcomes, not secrets. Establish baseline counts and cleanup identifiers before writes; do not modify customer/financial history or existing production accounts.

| Scenario | Steps and required evidence |
|---|---|
| Provision/create | Create a central registry record; provision only intended A. Read provider account/tenant identity back. Repeat same operation and verify one account and one successful operation/audit; B unchanged. Unavailable/misconfigured provider leaves Setup Required and no local customer account. |
| Activate | Require verified provisioning/enforcement; perform activation and read acknowledgement/persisted version. A's authenticated protected read/write succeeds; unconfigured B remains denied. Reject ordinary, pending and blocked actors. |
| Renew | Test 1/2 years, Kolkata leap day, valid-license extension and expired-license renewal from renewal time. Read exact persisted expiry locally and remotely. Two concurrent same-version requests produce one effective renewal; no duplicate audit/provider operation. |
| Suspend | Suspend A; confirm persisted and remote effective state. Reject existing A sessions/tokens on protected reads/writes after the agreed effective boundary; B remains unchanged. Replay cannot reactivate A. |
| Reset/revoke | Trigger approved recovery/revocation; do not display passwords. Existing tokens fail, intended account identity/tenant/role remain unchanged, unrelated B tokens still work. Replayed recovery/operation tokens are rejected. Verify audit and provider readback. |
| Expiry/invalid | Use sandbox clock/fixture controls, never change production time. Check immediately before, at and after expiry; unknown ID, future start, malformed proof, unverified state and suspended state deny protected access. Audit decision boundaries without secrets. |
| Cross-customer | Customer A cannot list/read/update/reset/activate/suspend B, even with known IDs, altered URL/email, token reuse or callback payload substitution. Repeat B→A and direct API/server-action calls bypassing UI. Confirm both databases and file scopes remain isolated. |
| Failure/replay/concurrency | Inject sandbox timeout before/after provider commit, failure between local/remote changes, duplicated/out-of-order callbacks, concurrent renew/suspend/reset and credential rotation. Reconcile with provider operation readback; never report unacknowledged success or silently grant access. |
| Cleanup | Remove exact disposable fixtures through approved provider APIs and central authorized cleanup, revoke QA sessions/credentials, verify counts and A/B baseline, retain only redacted verification evidence. |

Do not enable live integration suites just by setting environment flags. Session files and fixture state must correspond to an authorized isolated QA target. Record exact test counts, API acknowledgements, UI readback and cleanup; mark any unsupported provider capability explicitly.

## Current security evidence and limits
- **Verified previously in disposable PostgreSQL (22 checks):** Admin/ordinary/public denial, pending/blocked Admin restrictions, direct write denial, audit tampering denial, duplicate creation, transactional audit, row-locked concurrent renewal, stale rejection, unknown/expired/setup license denial and refusal of unconfigured lifecycle actions.
- **Previously verified actual browser flow:** authorized Super Admin save/renew/audit/refresh and ordinary user's denial of both pages. Those successful live writes were not repeated in this review.
- **Re-read live in this review:** both registry tables have RLS with active-Admin SELECT policies; authenticated has SELECT only and cannot write either table; anon cannot SELECT or execute the action; authenticated cannot call the service-only license probe; service_role can. Both registry/audit counts remain zero.
- **Not a remote access guarantee:** `crm_installation_license_state` is a service-only registry decision helper. It does not protect this CRM's unrelated operations or customer servers. Unknown IDs return null, which any future consumer must treat as deny. A service credential bypasses RLS and can mutate records/audits; ordinary-user tampering denial is not cryptographic or privileged-administrator audit immutability.
- **Not durable provider idempotency:** duplicate creation is currently prevented by unique email/URL; renewal uses a locked exact-expiry precondition. UI in-flight guards are not an external replay protocol or proof of distributed transaction safety.
- **Coverage still missing:** server-function wrapper denial/fault injection, Admin loading/error states, browser simultaneous submissions and populated pagination are not automated acceptance proofs. Remote activation/suspension/reset/provisioning/enforcement and customer-to-customer tests do not exist and cannot run without the contract.
- **Non-security validation discrepancy:** direct authorized SQL RPC checks phone length, while the browser/server schema also checks format. Recorded as an existing consistency gap, not an access bypass; no lifecycle or unrelated schema change was made for this review.

No new migration, deployment, publishing, DNS or account permission change is required by this checklist. Remote lifecycle remains **Setup Required**.