# SaaS CRM — Stages 2 to 10 Implementation Plan

Builds on the completed Stage 1 multi-tenant core (plans, subscriptions, feature permissions, usage limits, master_* RPCs). One stage per turn, verified before moving on. Nothing published without your approval.

## Stage order and approach

### Stage 2 — Permission-aware Customer & Employee panels (first turn)
- Map the module catalog (Dashboard, Leads, Contacts, Companies, Sales, Deals, Tasks, Quotations, Invoices, Payments, Products, Employees, WhatsApp modules, Chatbots, Flows, Drips, Facebook/Meta, Analytics, API, Webhooks, Settings) to `org_feature_permissions` keys.
- Customer Admin nav hides disabled modules; disabled routes show an access-denied/upgrade screen.
- Server-side enforcement: protected server functions check `org_feature_allowed` before reading/writing — not just frontend hiding.
- Employee nav/actions filtered by `user_access_roles` permissions (existing custom-role system).
- Permission refresh when Master Admin changes a plan (query invalidation on plan change).

### Stage 3 — Customer Admin employee management
- Employee create/invite/edit/activate/suspend, role & team assignment, permission configuration, activity view, invitation reset — reusing the existing invitation and access_roles infrastructure.
- Server-enforced employee limit from `org_usage_limits` (trigger already exists from Stage 1; wire the UI to show used/remaining).

### Stage 4 — Master Admin workspace access
- View Only and Full Support modes into the real customer workspace (no duplicate UI).
- Short-lived, org-bound support sessions via `org_support_sessions`; persistent banner with customer, mode, start time, exit; full audit; no RLS bypass; customer can see support history.

### Stage 5 — WhatsApp Business Cloud API platform
- Embedded Signup onboarding, three-column Inbox, conversation management, Template Manager, Campaign Manager, webhook receiver with HMAC verification, automations/triggers.
- **External blocker:** requires a Meta app + WhatsApp connector credentials. Built against the official Cloud API; live tests only after you connect credentials. No fake connection states.

### Stage 6 — Meta Lead Ads
- Meta OAuth, Pages/Ad Accounts/Lead Forms selection, leadgen webhook, automatic lead creation with org isolation and duplicate prevention. **External blocker:** Meta app credentials + app review.

### Stage 7 — Chatbot builder
- Visual bot builder (welcome, FAQ, qualification, custom), keyword/flow nodes, field capture, lead creation, human handover, execution logs. Runs on the real backend; WhatsApp delivery depends on Stage 5 credentials.

### Stage 8 — Visual flow builder
- Node-based automation builder with triggers/conditions/actions, draft/activate/pause, version history, server-side background execution (extends existing automation infrastructure).

### Stage 9 — Drip campaigns
- Multi-step WhatsApp drip campaigns with delays, stop conditions (reply/opt-out/conversion), background scheduler, idempotent execution, analytics.

### Stage 10 — End-to-end testing & production readiness
- Auth, multi-tenant isolation, permissions, employee limits, automation and Master Admin tests run here.
- WhatsApp/Meta live tests (sections E, F) require your real Meta credentials — reported as blocked until provided.
- Performance pass: indexing, pagination, lazy loading.

## Rules honored throughout
- Existing Lovable Cloud backend only; no second CRM; no data deletion; org isolation preserved.
- All permissions/limits enforced server-side; no secrets in frontend; official Meta APIs only.
- No "Coming Soon" placeholders for required modules; honest status reporting per stage.
- Old licensing registry data left untouched.

## First turn delivers
Stage 2 complete: feature-key catalog, permission-aware nav for Customer Admin and Employee, route guards with upgrade messaging, server-side feature checks on protected functions, focused tests, build check.
