# Multi-Tenant SaaS CRM — Implementation Map

Goal: upgrade the existing Routiva CRM into a single-backend multi-tenant SaaS platform. Decisions confirmed: one central multi-tenant backend, licensing pages replaced by All Users, Meta/WhatsApp flows built now with credentials added by you later, Stage 1 = multi-tenant core + All Users.

## Architecture foundation (all stages)

- Tenant = existing `companies` row (reused, not duplicated). Every tenant-owned record stays scoped by company; existing RLS, roles, and isolation are preserved.
- New tables (all with GRANTs + RLS, additive only):
  - `org_subscriptions` — plan, status (active/suspended/expired), term, expiry per company.
  - `org_feature_permissions` — per-company feature flags (leads, contacts, deals, invoices, WhatsApp, chatbots, flows, drip, integrations, analytics…).
  - `org_usage_limits` — max employees, max leads, monthly WhatsApp messages, numbers, chatbots, workflows, campaigns, storage.
  - `plans` + `plan_features` — reusable plan templates Master Admin can apply, with per-customer overrides.
  - `org_support_sessions` — audited Master Admin workspace-access sessions (Stage 3).
- Enforcement: security-definer `org_feature_allowed(_company, _feature)` and `org_limit_available(_company, _limit)` used by server functions and RLS — never frontend-only. Disabled feature → nav hidden, direct URL blocked, API rejected, data preserved, upgrade message shown.

## Stage 1 — Multi-tenant core + All Users (this stage)

1. **Schema**: tables above + `org_feature_allowed` / `org_limit_available` functions + audit columns. Default: existing companies get all current features enabled (no behavior change for existing data).
2. **Login split**:
   - `/admin` — Master Admin (super_admin) login only; customers/employees rejected server-side.
   - `/login` — customer admin + employee login; routes to dashboard by role. Existing `/auth` redirects to `/login`.
   - No public signup for either.
3. **All Users module** (replaces Sold CRM Admins / Create CRM Admin / CRM Installation in nav; old pages removed, registry tables kept untouched in DB):
   - Dashboard cards: total/active/suspended/expired customers, total employees, approaching expiry, integration errors.
   - Table: search (name/company/email/phone), filters (status, plan, date), sorting, pagination.
   - Row actions: View Details, Edit, Manage Permissions, Manage Subscription, Suspend, Activate, Archive (with confirmation + retention).
4. **Create Customer form** (replaces installation form): company name, admin full name, email, mobile, password only. Server function (admin-authorized, supabaseAdmin inside handler) creates: auth user, profile, company (organization), membership, default permissions, subscription record — atomically. No installation ID/URL/validity fields.
5. **Plan & Permissions page** per customer: employee limits (max/current/remaining, backend-blocked creation at limit), CRM feature toggles, usage limits, plan apply + overrides.
6. **Employee limit enforcement**: customer-admin employee creation server function checks `org_limit_available` before insert; 6th employee rejected when limit is 5.

## Later stages (mapped, not built in Stage 1)

- **Stage 2 — Customer/Employee panels**: module gating by permissions across the CRM nav, employee management UI with roles (Admin/Sales Manager/Sales Executive/Support/Custom) and per-employee permissions, suspension behavior.
- **Stage 3 — Master workspace access**: View Only / Full Support modes, persistent banner, short-lived audited server-authorized sessions, no RLS bypass.
- **Stage 4 — WhatsApp Inbox**: three-column Hatflow-style inbox on official Cloud API via the WhatsApp connector; webhook inbox, real-time sync, assignment, notes, templates. Needs your Meta connection.
- **Stage 5 — Meta/Facebook Lead Ads**: per-customer OAuth connect flow, page/form selection, webhook sync, dedupe, sync logs. Needs your Meta app credentials.
- **Stage 6 — Chatbots, Flow Builder, Drip Campaigns**: full modules respecting per-customer permissions and limits.
- **Stage 7 — Performance + acceptance tests**: code splitting, pagination, the 15 end-to-end tests from the brief, final delivery report.

## Safety rules (every stage)

- Additive migrations only; no existing customer data, auth, RLS, or features removed.
- No mock data, no fake connection statuses, no secrets in frontend code.
- Master Admin operations use explicit server-side authorization; frontend-supplied org/role values never trusted.
- Nothing published without your explicit approval.

## Stage 1 verification

- Focused tests: org creation atomicity, feature/limit enforcement, login split authorization, employee limit rejection, cross-company isolation.
- Browser checks: Master Admin creates a customer at /admin; new customer logs in at /login; customer blocked from /admin.
- Build check. No publish.
