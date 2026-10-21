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

- Public chrome stays outside workspaces; compact AuthCard is Login/Register-only — why: shared chrome and isolated spacing.
- Make management uses Admin-gated functions, hashed credentials, source mappings and redacted logs; intake uses the existing public route and locked canonical Leads/routing RPCs — why: isolation, safe rotation and atomic quotas.
- Protected CRM workspace pages live under `src/routes/_authenticated/`; public marketing/auth pages stay top-level — why: account gating should not affect crawlable public pages.
- Master Admin uses protected admin routes, shared nav/UI, a role guard and fallback splat — why: authorized access and working links.
- First Super Admin provisioning uses only private secrets via `provision-admin.functions.ts` and stops once one exists; logins share authenticated `auth-access.functions.ts` with stored roles/status — why: public signup cannot grant privileges, and blocked/pending checks precede role redirects.
- CRM stages share board_label and protected status RPCs; Board creation shares a validated RLS-scoped dialog storing optional fields in form_answers — why: canonical storage and existing privileges.
- Sales uses separate catalog/customers, `can_manage_sales`, private images and stable full pagination in six-connection batches — why: scoped access and complete totals.
- Financial writes use the `sales_financial_action` database RPC through an authenticated server function; issued invoices are immutable snapshots and payment/credit actions lock the invoice — why: balances and audit records must be atomic under concurrent actions.
- Permission roles (`access_roles` + `user_access_roles`) are separate from the system `user_roles` enum; the permission catalog lives in `src/lib/permissions.ts` — why: custom roles must never grant system privileges.
- Invitations use public acceptance and stay pending until locked password acceptance; Admin-only Auth invite/recovery resends preserve identity/company/roles — why: no editor access or duplicate users.
- Non-WhatsApp legacy Admin policies use active-admin checks and restrictive CRM assignment/account boundaries — why: permissive policies must not reopen blocked/unrelated access.
- Mail/WhatsApp pages store data locally only; nothing reaches Sent/Inbox or WhatsApp without a delivery integration — why: no faked sending.
- WhatsApp workflows/broadcasts are stored only; delivery counts and processing/completed states are writable only by the server (DB trigger), and integration status `connected` can't be set from the browser (RLS) — why: no simulated sending or fake connection badges.
- HRM employees link existing profiles; `hr_set_access` audits approval/rejection — why: one identity and atomic access.
- HRM management uses shared validated forms with scoped database policies; attendance, leave and payroll mutate only through transactional audited RPCs — why: identity, balances and financial history cannot depend on browser controls.
- Bulk attendance uses one atomic RPC; leave-derived attendance carries a source request ID cleared by manual correction — why: failed bulk saves roll back and reversing leave never removes unrelated manual records.
- Calendar derives meetings, holidays and approved leave from their original records; private HR files (documents, announcement attachments) use authorized server uploads/downloads following record visibility — why: avoid duplicate events and public or cross-company files.
- Employee HR self-service lives outside the super-admin layout at `/my-hr`; custom HR administrators use permission-scoped HR access — why: keep the admin shell without granting unrelated administration.
- Support uses owner-scoped reads, locked RPCs, private-note RLS and authorized files — why: secure ownership and conversation history.
- Admin settings use authenticated active-Super-Admin functions; own credentials use Auth with current-password reauthentication, and business preferences extend the existing singleton sales settings via a dedicated authorized RPC — why: reuse identity and seller snapshots without changing financial history or other modules.
- Admin/user work uses locked company/personal RPCs and original creators — why: no duplicate records or fictitious companies.
- Five work pages share spreadsheet controls, private page-specific drafts/customization and locked cell writes — why: preserve ownership/history without incomplete tasks.
- Chat shares Admin records/files via participant RPCs/RLS; chat_people exposes public identities only; company groups keep membership gates — why: discovery must not grant private-record access.

- User commercial RPCs scope companies/permissions, proposal evidence and draft-only invoices — why: preserve finance/history.
- Automation uses canonical work and unique events; retry fault tests use unchanged SQL in disposable localhost DBs — why: safe scope/deduplication without production faults.
