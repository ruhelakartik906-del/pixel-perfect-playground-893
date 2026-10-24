# Skipped test inventory — 24 October 2026

Based on the preserved final full-suite run: **356 passed, 127 skipped, 0 failed** across 52 files. All 127 skips are at guarded suite level; none is an unconditional abandoned test. No disabled external suite was enabled during this review.

Categories overlap conceptually: these skips are **intentional safety gates because the environment/fixtures must be prepared**. There are no skipped placeholders to classify as missing implementations. Missing acceptance tests are identified separately below; they are not included in the 127.

| File under `src/test/` | Count | Classification | Exact enabling prerequisites |
|---|---:|---|---|
| `crm-installations.local.test.ts` | 22 | Environment-dependent, intentional isolation | `CRM_LICENSE_LOCAL_QA=1`; disposable local PostgreSQL `127.0.0.1:55441`, database `postgres`, user `qa`, SSL off; fresh schema/roles. Applies 0089–0092 and writes synthetic local fixtures. |
| `ad-routing-recipients.local.test.ts` | 16 | Environment-dependent, intentional isolation | `LEADS_LOCAL_QA=1`; disposable PostgreSQL `127.0.0.1:55440`, database `postgres`, user `qa`, SSL off; destructive fixture/schema rebuild restricted to local QA. |
| `attendance-rpc.local.test.ts` | 10 | Environment-dependent, intentional isolation | `LEADS_LOCAL_QA=1`; disposable PostgreSQL `127.0.0.1:55440`, database `attendance_qa`, user `qa`, SSL off; fresh fixture schema. |
| `automation-retry.local.test.ts` | 4 | Environment-dependent, intentional isolation | `AUTOMATION_LOCAL_RETRY_QA=1`; disposable PostgreSQL `127.0.0.1:55439`, database `postgres`, user `qa`, SSL off and expected automation fixtures. |
| `company-leads.local.test.ts` | 30 | Environment-dependent, intentional isolation | `LEADS_LOCAL_QA=1`; disposable PostgreSQL `127.0.0.1:55440`, database `postgres`, user `qa`, SSL off; schema rebuild. |
| `leads-board.local.test.ts` | 14 | Environment-dependent, intentional isolation | `LEADS_LOCAL_QA=1`; disposable PostgreSQL `127.0.0.1:55440`, database `postgres`, user `qa`, SSL off; schema rebuild. |
| `automation-deal.integration.test.ts` | 8 | Environment-dependent, intentional hosted-QA gate | `AUTOMATION_DEAL_QA_DIR`; valid Admin/Employee session JSON files, configured Cloud API URL/public key and approved disposable company/users. Performs hosted writes. |
| `automation-executor.integration.test.ts` | 7 | Environment-dependent, intentional hosted-QA gate | `AUTOMATION_QA_DIR`; expected QA fixture/session JSON and configured Cloud API URL/public key; hosted fixture readback. |
| `automation-stage.integration.test.ts` | 9 | Environment-dependent, intentional hosted-QA gate | `AUTOMATION_STAGE_QA_DIR`; Admin/Employee session files, approved removable fixtures and configured Cloud API URL/public key; hosted creates/updates. |
| `routing-quota.integration.test.ts` | 7 | Environment-dependent, intentional hosted-QA gate | `ROUTING_QA_DIR`; Admin session/prepared QA state, configured Cloud API URL/public key and approved disposable company/users; hosted rules/leads writes. |
| **Total** | **127** | **96 local + 31 hosted-QA** | Not 127 failed tests; not evidence that all integration behavior passes. |

The 22 license database tests also ran separately in the preceding turn: **22 passed**, plus **19 license unit tests passed** (41 total). Their skip in the default run does not erase that isolated run, nor mean it was executed by default. Other 105 skips are unrelated modules and were not rerun for this license follow-up.

## Missing required license coverage (not skipped tests)
- Automated server-function auth/failure handling and Admin UI fault injection, loading/refresh failure, simultaneous double-click behavior and populated pagination.
- Actual provider provisioning, activation, suspension, reset/revocation, acknowledged renewal, outage/reconciliation and remote protected-operation expiry.
- Two independent customers' direct API/session/file isolation and replay/callback/concurrent lifecycle tests.

The first group needs a focused harness/mocked failure test design; the latter groups need real provider documentation, sandbox contract and approved independent installations. Keep them recorded as unverified; never manufacture a provider response to claim end-to-end success. See `license-integration-checklist.md` for the acceptance plan.