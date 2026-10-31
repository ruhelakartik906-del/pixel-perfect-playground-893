# Customer Integrations Marketplace

## Outcome
Customers connect their own WhatsApp Business, Facebook/Instagram Lead Ads, Google Calendar/Meet and Zoom from the existing dashboard. Master Admin controls platform availability and subscription access. Preserve accounts, existing connections, permissions, routing and customer data; do not publish without separate approval.

## Existing foundations to preserve
- Extend the existing Master Integrations Cockpit rather than creating a second management section.
- Reuse organization WhatsApp Embedded Signup, encrypted credentials, connection checks and the signed Meta webhook.
- Connect the existing CRM WhatsApp inbox to organization-owned connections. Its current stored-message views are not live delivery.
- Reuse canonical lead creation, source mapping, deduplication, attribution and locked assignment/routing. Existing Make intake remains working and separate from direct Meta consent.
- Google Meet/Zoom currently have informational cards only; no working provider connection should be implied.

## Phase 1 — Marketplace and Master controls
- Add a customer Integrations Marketplace in the existing workspace, with five provider cards, account details, granted permissions, last successful sync/check, errors, Connect/Reconnect/Disconnect and plan/setup restrictions.
- Extend Master Integrations Management with global switches, provider-specific subscription access, required permissions, connection limits, callback/webhook addresses and safe connection health, logs and usage.
- Store non-secret configuration separately from protected credentials. Secure credential entry never reveals saved secrets; existing credentials are not replaced without authorization.
- Customer Admins manage only their organization’s connections. Employees use services only through assigned permissions; backend checks enforce active membership, plan availability and permission requirements.
- Global disabling blocks new provider operations without silently deleting connections. Keep zero, unlimited and default limits distinct and preserve customer overrides.

## Phase 2 — WhatsApp Business
- Harden and reuse official Embedded Signup, including durable one-time authorization correlation and organization/account ownership verification. Support coexistence only when Meta confirms eligibility.
- Implement organization-scoped incoming/outgoing messages in the existing inbox, provider template synchronization and approved-template sending, media handling and delivery/error timelines.
- Persist verified webhook deliveries before processing; deduplicate deliveries and messages, reconcile early/out-of-order statuses and provide durable retry/recovery for unfinished work.
- Record accepted sends separately from delivered/read status; preserve provider timestamps and failures. Ambiguous send outcomes remain visible, not blindly resent.
- Enforce connected-number, monthly messaging and storage limits at the authoritative operation boundary.

## Phase 3 — Facebook and Instagram Lead Ads
- Add official Meta consent, validate granted access, and let customers select only authorized Pages, linked Instagram accounts, Ad Accounts and Lead Forms.
- Implement field mapping, webhook subscriptions, signed durable lead notifications, server-side lead retrieval and retry-safe import into the existing canonical lead/routing model.
- Preserve provider lead IDs, original answers, source attribution, assignment privacy and quotas. Cross-organization conflicts are rejected rather than reassigning an existing source.
- Show subscription health, last successful import and redacted errors; handle revoked access and reconnect without overwriting unrelated connections.

## Phase 4 — Google Calendar and Meet
- Use the available Google Calendar App User Connector for each consenting signed-in account, with organization-authorized sharing/use and encrypted server-only handles. No shared builder account or invented user identity.
- Add event create/update/cancel, supported Calendar-generated Meet links, timezone/all-day handling and CRM contact/task/meeting associations.
- Persist provider IDs and synchronization state; retry safely and avoid duplicate meetings or reminder records. Disconnect revokes access without deleting CRM history.
- Google requires a workspace OAuth client before implementation can activate consent; none is currently configured. Register the required Lovable callback, enable offline access and publish the Google OAuth app or use an eligible Internal app.

## Phase 5 — Zoom
- Build official per-customer Zoom OAuth, as explicitly approved, because no matching built-in per-user connector exists.
- Implement one-time expiring state, authenticated organization binding, encrypted tokens, safe refresh/revocation and meeting create/update/cancel.
- Save meeting identifiers and URLs against authorized CRM contacts/deals, preserving historical records on disconnect.

## Technical approach
- Keep protected customer pages under the existing authenticated workspace and use authenticated server functions for provider operations. Public callbacks/webhooks verify their own state/signature and inputs.
- Extend existing WhatsApp connection/event/inbox structures additively; introduce only missing provider metadata, encrypted storage, consent state and durable processing structures.
- Give every new application table explicit grants and RLS; credential tables stay server-only. Authorize before privileged reads/writes. Never log tokens, authorization codes, signatures or full sensitive provider payloads.
- Integrate provider-specific plan flags with current plan validation and effective overrides; enforce limits under concurrency, not only through card visibility.
- Use official APIs or the supported per-user connector path, bounded media downloads, safe DTOs, and compatible server libraries. Keep Master settings, tenant consent and employee usage as separate security boundaries.
- Give new content pages app-specific titles and descriptions and preserve the existing visual system.

## Verification and completion boundaries
- Add focused rule tests for organization isolation, employee permissions, global/plan gates, connection limits, state expiry/replay, encrypted storage, revoked grants and refresh failures.
- Test each provider independently: WhatsApp receipt/send/status/media; Meta webhook/import/replay/mapping/routing; Google event/Meet changes; Zoom meeting changes.
- Verify signed-in Master/customer flows, refresh persistence and employee denial in the actual UI. Use disposable local data for destructive/concurrency checks; do not alter existing customer records or production credentials for testing.
- Hosted testing requires configured provider applications, approved scopes and a user-authorized isolated test organization/account with a verified cleanup path. Undeployed webhook callbacks cannot be live-verified without separate publishing approval.
- Until those conditions are met, report **Setup Required** and **Live verification pending** accurately. A card, successful consent or accepted send alone does not establish a complete integration.

## Delivery order
Complete Marketplace plus Meta/WhatsApp first, then Google Calendar/Meet and Zoom. Report finished capabilities and specific provider/setup blockers after each phase; do not claim the whole marketplace complete while operational flows remain unfinished.