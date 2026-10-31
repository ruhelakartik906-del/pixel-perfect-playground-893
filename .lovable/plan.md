# Complete WhatsApp AI Inbox and Meta Lead Ads

## Scope and safeguards
Implement only WhatsApp and Facebook/Instagram Lead Ads. Leave Google and Zoom unchanged. Preserve existing accounts, CRM records, saved credentials, organization boundaries, existing WhatsApp webhook address, Make intake and working routing. No publishing, deployment, destructive migrations or deletion of existing data.

The existing WhatsApp connection lifecycle is reusable, but the webhook currently only stores events and the inbox has no operational provider send/receive pipeline. Direct Meta Lead Ads consent and ingestion, WhatsApp AI and live inbox updates are not yet implemented.

## 1. Official WhatsApp onboarding
- Upgrade the existing Embedded Signup flow to Meta’s documented v4 contract, keeping signup version distinct from Graph API version.
- Customer Admin connects through the Marketplace using the existing configuration and encrypted credential storage. Validate one-time expiring consent state, token/app ownership, granted scopes, WABA and phone ownership before saving.
- Complete registration where required and verify subscription to this app, including account updates. Confirm coexistence from Meta rather than trusting a checkbox.
- Preserve existing connections on failed reconnects; store metadata and credentials atomically where possible. Never claim Connected before every required provider step and secure save succeeds.

## 2. Durable WhatsApp transport and processing
- Extend the existing conversation/message records with explicit organization connection references without changing legacy records’ ownership.
- Upgrade the existing signed webhook in place: bounded input, durable receipt, delivery/message deduplication, idempotent processing and fair retry/recovery for pending work.
- Normalize inbound text, images, documents, audio, video and other supported message types. Download media server-side with strict byte/type limits into authorized private storage.
- Implement authorized manual sends, attachments and approved templates through the organization’s official Cloud API connection. Persist accepted sends, immediate errors and ambiguous outcomes.
- Reconcile delivery/read/failed callbacks in either arrival order; preserve timestamps/errors and prevent older statuses overwriting later states.
- Enforce WhatsApp session/template rules, monthly usage and applicable number/storage limits at the operation boundary.
- Keep recovery execution prepared but inactive on published hosting until deployment approval; make the delay/verification boundary visible rather than implying undeployed automation runs.

## 3. Functional team inbox
- Extend the current WhatsApp inbox instead of creating a duplicate inbox: real message history, contact/conversation details, search, filters, unread counts and Open/Pending/Resolved states.
- Add Customer Admin-managed inbox access, eligible employee assignment/reassignment, internal notes, manual replies, templates and attachments.
- Employees can read/use only conversations authorized by membership, assigned permissions and conversation access. Assignment cannot grant unrelated CRM record access.
- Implement authorized real-time invalidation and re-fetch, read markers, loading/empty/error/disconnected states and in-app assignment notifications. Do not claim external notification delivery.

## 4. AI suggestions and opt-in chatbot replies
- Use real server-side Lovable AI for employee-requested suggestions and explicitly enabled organization auto-replies. AI usage consumes workspace credits.
- Customer Admin controls AI enable/disable and approved business instructions. Default auto-replies off; distinguish suggestions from sent messages.
- Persist jobs, consent/configuration, single-flight leases, idempotent progress and terminal credit/policy/provider-denial pause states; bound every run.
- Human assignment or takeover cancels queued AI replies and prevents future automatic sends. Revalidate handover immediately before dispatch with a transactional claim/version boundary; explain that a message already accepted by Meta cannot be recalled.
- Do not leak private notes, unrelated contacts or other organizations into prompts. Treat customer messages as untrusted content, not operational instructions.
- Provide safe error/refusal feedback, explicit resume controls and auditable AI-to-human transitions. Never retry denials/refusals or send fabricated fallback replies.

## 5. Direct Facebook and Instagram Lead Ads
- Implement official customer Meta authorization and secure server-side exchange with encrypted, organization-owned credentials.
- Fetch only granted Pages, linked Instagram accounts and available Forms; let customers select sources and configure field mapping.
- Subscribe selected Pages to leadgen, receive signed durable notifications, retrieve full available lead/ad/campaign/form fields and preserve original answers.
- Import into canonical Leads through an authorized atomic path that preserves deduplication, existing assignment, original ownership, source attribution and automation ordering.
- Add safe manual sync, failed-import history and bounded retry actions. Reject conflicting cross-organization Page/Form ownership; disconnect/revocation stops future imports without deleting CRM history.

## 6. Employee lead distribution
- Reuse existing assignment history and routing. Preserve all existing cumulative quota rules and valid assignments.
- Add organization-owned round-robin and team/source policies as an explicit separate mode, with locked counters and concurrent-safe recipient selection.
- Customer Admin manages only eligible organization employees and manual assignments; check active account, company membership, HR restrictions and declared availability on every assignment.
- Add organization-scoped availability/team configuration only where missing. Record every assignment/reassignment and create authorized in-app notifications after the assignment commits.

## Technical implementation
- Additive migrations only, explicit grants/RLS on every new table and service-role-only credential/processing storage. Authorize through the caller’s scoped client before privileged operations; never relax existing RLS.
- Protected server functions own customer actions. Public callback/webhook/worker handlers validate state/signatures/caller credentials and bounded inputs themselves.
- Extend existing Meta/WhatsApp helpers and original inbox components. Keep direct Meta Lead Ads distinct from Make’s authenticated intake while sharing canonical lead/routing operations.
- Use private per-user realtime doorbells for authorized re-fetches, not broadcast payloads containing contacts/messages.
- Use edge-compatible AI SDK streaming and database-backed queue leases, fair retries and terminal pause guards. Keep secrets, tokens, authorization codes and sensitive provider bodies out of logs and browser data.
- Record architecture decisions and focused business-rule tests; retain current styling and app-specific page metadata.

## Verification and report
- Run focused database/security tests for multi-organization isolation, employee permission denial, assignment availability, round-robin concurrency, duplicate lead/message prevention, status ordering, session/template boundaries and AI handover races.
- Test real provider configuration and non-destructive reads independently. Use actual provider responses; do not simulate Connected or successful delivery. Local deterministic fixtures, if used for rule tests, remain isolated and are never presented as hosted/provider acceptance.
- Verify signed-in UI actions and read-back against an authorized isolated organization/provider account. Do not create or delete production customer records for testing without explicit permission and a verified cleanup path.
- Check automatic production-build results; do not run the managed project build manually. No deployment to make hosted acceptance appear complete.
- Report separately: completed features; evidenced Meta approval/Advanced Access/business-verification needs; missing configuration; exact tests/results; and remaining blockers. No blanket completion or production-readiness claim.

## External verification boundaries
Saved Meta credentials are available, but their App Review/Advanced Access/business-verification status, permitted assets and coexistence eligibility have not been verified. Application credentials alone do not grant customer Page/WABA access. New webhook/worker behavior cannot be tested on the published site while deployment is prohibited. Google setup was skipped and remains untouched.

## Delivery order
Onboarding and durable transport first, then team inbox and AI handover, then direct Lead Ads and assignment extensions. Complete every independently implementable item and stop only for required provider authorization, approved test access or forbidden deployment; keep unfinished items explicit.