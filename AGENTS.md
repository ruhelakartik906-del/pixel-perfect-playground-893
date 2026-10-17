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

- Public marketing sections live in `src/components/site/`; header/footer are mounted in `__root.tsx` — why: shared across all public routes (CRM workspace will need its own layout without them).
- Lead quota assignment logic lives in `src/lib/routing.ts` with tests in `src/test/routing.test.ts` — why: single source for the per-rule quota/overflow rule.
- Protected CRM workspace pages live under `src/routes/_authenticated/`; public marketing/auth pages stay top-level — why: account gating should not affect crawlable public pages.
- Master Admin panel lives under `src/routes/_authenticated/admin/` with nav config in `src/components/admin/nav.ts` and shared UI in `src/components/admin/ui.tsx`; the layout guard requires the `super_admin` role via `has_role` — why: admin access must be role-verified, not hidden links; unbuilt modules fall through to the `$` splat page so no link breaks.
- The first Super Admin is provisioned only by the input-less server fn in `src/lib/provision-admin.functions.ts`, using the private `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` secrets, and is a no-op once any super_admin exists; admins sign in at `/admin/login` (top-level route), users at `/login` — why: admin access never depends on public registration or hardcoded credentials.
- CRM configuration (pipelines, lead/deal stages, sources/tags/categories/contract types, list-view columns) lives in DB tables edited at `/admin/crm/crm-system-setup`; Leads/Deals read these, never hardcoded lists — why: admins change setup without code. Reassignment by non-admins is blocked by a DB trigger, not UI.
- Sales uses separate catalog/customer tables, protected route loaders calling `sales.functions.ts`, and the active-admin `can_manage_sales` policy; uploaded product images are private with signed URLs — why: financial access and tenant identity remain separate and role-verified.
- Financial writes use the `sales_financial_action` database RPC through an authenticated server function; issued invoices are immutable snapshots and payment/credit actions lock the invoice — why: balances and audit records must be atomic under concurrent actions.
- Permission roles (`access_roles` + `user_access_roles`) are separate from the system `user_roles` enum; the permission catalog lives in `src/lib/permissions.ts` — why: custom roles must never grant system privileges.
- User invites and mailbox credentials go through `src/lib/admin-users.functions.ts`; mailbox passwords live in a table with no client grants — why: credentials must never reach the browser.
- Mail/WhatsApp pages store data locally only; nothing reaches Sent/Inbox or WhatsApp without a delivery integration — why: no faked sending.
