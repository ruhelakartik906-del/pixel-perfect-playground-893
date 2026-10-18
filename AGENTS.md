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

- Public sections live in `src/components/site/`; root mounts header/footer outside workspaces — why: shared public chrome.
- Routing validation lives in `src/lib/routing.ts`; assignments/rules use locked RPCs through `ad-routing.functions.ts` — why: authorized, atomic quotas, idempotency and audit.
- Protected CRM workspace pages live under `src/routes/_authenticated/`; public marketing/auth pages stay top-level — why: account gating should not affect crawlable public pages.
- Master Admin lives under `src/routes/_authenticated/admin/`; nav/UI use `src/components/admin/{nav.ts,ui.tsx}`; guard verifies `super_admin` via `has_role`, and unbuilt modules use the `$` splat — why: authorized access and working links.
- First Super Admin provisioning uses only private secrets via `provision-admin.functions.ts` and stops once one exists; logins share authenticated `auth-access.functions.ts` with stored roles/status — why: public signup cannot grant privileges, and blocked/pending checks precede role redirects.
- CRM configuration (pipelines, lead/deal stages, sources/tags/categories/contract types, list-view columns) lives in DB tables edited at `/admin/crm/crm-system-setup`; Leads/Deals read these, never hardcoded lists — why: admins change setup without code. Reassignment by non-admins is blocked by a DB trigger, not UI.
- Sales uses separate catalog/customer tables, `can_manage_sales` authorization and private signed product images; reporting uses paginated read-only ledger queries and shared calculations — why: scoped access, complete totals and consistent accounting.
- Financial writes use the `sales_financial_action` database RPC through an authenticated server function; issued invoices are immutable snapshots and payment/credit actions lock the invoice — why: balances and audit records must be atomic under concurrent actions.
- Permission roles (`access_roles` + `user_access_roles`) are separate from the system `user_roles` enum; the permission catalog lives in `src/lib/permissions.ts` — why: custom roles must never grant system privileges.
- User invites and mailbox credentials go through `src/lib/admin-users.functions.ts`; mailbox passwords live in a table with no client grants — why: credentials must never reach the browser.
- Mail/WhatsApp pages store data locally only; nothing reaches Sent/Inbox or WhatsApp without a delivery integration — why: no faked sending.
- WhatsApp workflows/broadcasts are stored only; delivery counts and processing/completed states are writable only by the server (DB trigger), and integration status `connected` can't be set from the browser (RLS) — why: no simulated sending or fake connection badges.
- HRM employee records (`hr_employees`) link to existing profiles; access approve/reject goes through the `hr_set_access` RPC with audit rows — why: one auth system, atomic access changes.
- HRM management uses shared validated forms with scoped database policies; attendance, leave and payroll mutate only through transactional audited RPCs — why: identity, balances and financial history cannot depend on browser controls.
- Bulk attendance uses one atomic RPC; leave-derived attendance carries a source request ID cleared by manual correction — why: failed bulk saves roll back and reversing leave never removes unrelated manual records.
- Calendar derives meetings, holidays and approved leave from their original records; private HR files use authorized server uploads/downloads and append-only versions — why: avoid duplicate events and public confidential files.
- Employee HR self-service lives outside the super-admin layout at `/my-hr`; custom HR administrators use permission-scoped HR access — why: preserve the existing admin shell without granting unrelated administration.
- Support uses owner-scoped reads, locked RPCs, private-note RLS and authorized files — why: secure ownership and conversation history.
- Admin settings use authenticated active-Super-Admin functions; own credentials use Auth with current-password reauthentication, and business preferences extend the existing singleton sales settings via a dedicated authorized RPC — why: reuse identity and seller snapshots without changing financial history or other modules.
- Admin/user CRM work shares company-scoped records and locked RPCs; unlinked personal tasks use owner-scoped storage — why: preserve company-required Admin behavior and private work without fictitious companies.
- User CRM uses assigned-record/owner-only RPCs, audited deals and source calendars; messaging shares Admin records with participant-checked group/receipt RPCs and private files, with provider actions blocked until verified — why: preserve identity/history without leaks or simulated delivery.

- User commercial RPCs enforce permission/company scope, proposal decision evidence and draft-only shared invoice writes — why: preserve privileged finance and immutable history.
