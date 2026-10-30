<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Public chrome stays outside workspaces; AuthCard is Login/Register-only — why: isolate spacing.
- Make uses Admin-gated functions, hashed credentials, source mappings/redacted logs; intake uses the existing public route and locked Leads/routing RPCs — why: safe rotation, isolation and atomic quotas.
- CRM lives under `src/routes/_authenticated/`; marketing/auth stay public. Admin uses shared nav/UI, role guard and fallback splat — why: protected workspaces and working links.
- First Admin provisioning uses only private secrets and stops once one exists; logins use stored roles/status via authenticated auth-access functions — why: public signup cannot grant privileges; pending/blocked checks precede redirects.
- Leads use scoped RPCs, canonical reads, ad-private owners and atomic Board stage/outcome/first-move saves — why: preserve privacy, quotas and detail guards.
- Sales uses separate catalog/customers, can_manage_sales, private images and stable pagination in six-connection batches — why: scoped access and complete totals.
- Financial writes use authenticated sales_financial_action; issued invoices are immutable and payment/credit actions lock invoices — why: atomic balances/audit under concurrency.
- access_roles/user_access_roles stay separate from system user_roles; catalog is src/lib/permissions.ts — why: custom permissions cannot grant system privileges.
- Invitations use public acceptance, remain pending until locked password acceptance; Admin Auth resends preserve identity/company/roles — why: no editor access or duplicates.
- Legacy Admin policies require active Admin and restrictive CRM assignment/account boundaries — why: permissive policies cannot reopen blocked/unrelated access.
- Mail/WhatsApp are stored-only without delivery; WhatsApp counts and processing/completed states are server-only via trigger, connected status cannot be set by browser RLS — why: no fake sending/connections.
- HRM employees link profiles; hr_set_access audits decisions. Shared validated forms/scoped policies and transactional attendance/leave/payroll RPCs preserve identity, balances and history.
- Bulk attendance is atomic; leave attendance carries source request ID cleared by manual correction — why: rollback failures and preserve unrelated manual records on reversal.
- Calendar derives original meetings/holidays/approved leave; private HR documents/attachments use authorized uploads/downloads matching record visibility — why: no duplicate events or public/cross-company files.
- /my-hr stays outside Admin; custom HR administrators use scoped permissions — why: no unrelated privileges.
- Support uses owner reads, locked RPCs, private-note RLS and authorized files — why: secure ownership/history.
- Settings require active Super Admin; own credentials use Auth/current-password reauthentication, business defaults extend singleton sales settings via authorized RPC — why: preserve identity, seller snapshots and financial history.
- Work uses locked company/personal RPCs and original creators; five pages share spreadsheets, private per-page drafts/customization and locked cells — why: no duplicates, fictitious companies or lost ownership/history.
- Chat uses participant RPCs/RLS/files; chat_people exposes public identities only and company groups require membership — why: discovery cannot grant private access.
- User commercial RPCs scope companies/permissions, proposal evidence and draft-only invoices — why: preserve finance/history.
- Work/commercial reads use short browser freshness plus mutation invalidation; prerequisite batches max six — why: fewer duplicate requests without shared server caches/skipped authorization.
- Automation uses canonical work/unique events; retry tests run unchanged SQL in disposable local DBs — why: dedupe and no production faults.
- Attendance projects original HR/personal summaries (HR wins per account/date); Admin-only roster exclusion preserves HR identity.
- Licensing: Master manages via audited Super Admin RPC (hashed credentials); customers verify via /api/public/license/verify; LICENSE_MODE=customer fails closed (60s cache) and mirrors into service-role-only license_state; restrictive license_gate policies on customer-data tables (except license_state, role tables, Master registry, zero-policy tables) block direct Data API access when stale — why: central authority, no client-trusted status.
- Multi-tenant core: tenant = companies row; plans/org_subscriptions/org_feature_permissions/org_usage_limits are managed only by master_* RPCs (active Super Admin); org_feature_allowed/org_limit_available are the backend gates; employee limit enforced by a company_members insert trigger; /register redirects to /login (no public signup) — why: single-backend SaaS with server-enforced plans.
