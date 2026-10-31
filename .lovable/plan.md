# Repair Plans and Customer Workspace Access

## Confirmed problems
- Plan saving has two live functions with identical parameter names but different plan-ID types. This causes the reported ambiguous-function error.
- Assigning a plan currently replaces customer limits and features; customer overrides are not stored separately.
- All nine limits are stored, but enforcement is incomplete.
- Support access currently opens a separate, limited screen rather than the actual customer CRM pages.

## 1. Reliable plans and three-mode limits
- Use one unambiguous, validated plan-saving contract; preserve existing plan IDs and assignments.
- Add clear **Default / Custom / Unlimited** controls for employees, leads, monthly WhatsApp messages, connected numbers, chatbots, active workflows, drip campaigns, API requests and storage MB.
- Default retains the existing configured value; Custom accepts non-negative whole numbers within supported storage bounds; Unlimited is explicitly null, never a large substitute. Zero remains a real restriction.
- Support create, edit, duplicate and safe removal. Assigned plans retain historical references and customer configuration; unsafe deletion is blocked or retired rather than destroying history.
- Keep save errors actionable and success feedback tied to confirmed persistence.

## 2. Assignment without configuration loss
- Separate plan defaults, customer overrides and effective settings.
- Preserve existing effective customer settings during introduction of overrides; do not silently replace legacy values.
- Show assigned plan, effective limits, features and subscription status in Customer Details.
- Provide explicit assignment/change confirmation and per-setting reset to plan defaults. Preserve overrides on reassignment unless the Admin intentionally resets them.
- Preserve subscription dates/status and all financial history when changing a plan.

## 3. Server-enforced limits
- Enforce resource limits at actual creation/upload/connection boundaries, including concurrent requests and bulk actions.
- Count employees and leads from canonical organization records; count WhatsApp numbers only for the selected organization.
- Define monthly message/API usage and storage accounting from actual accepted actions and authorized files, without fabricated usage.
- Apply limits to existing workflow/resource operations. Where chatbots, drip campaigns or live messaging have no operational implementation yet, keep the limit contract ready and identify the unavailable flow explicitly; do not claim nonexistent features were verified.

## 4. Actual customer workspace in support mode
- Reuse the existing CRM shell and page components, not a second dashboard/interface.
- Supply those pages through a session-authorized workspace data/action adapter. Keep the Master identity unchanged; never sign in as the customer or grant browser-wide access.
- Derive organization and effective permissions from the live session and selected customer workspace. Ensure navigation, reads, files, exports and actions consistently use that context.
- Persistent banner: **Master Admin — View Only Access** or **Master Admin — Full Support Access**, showing customer/company, reason and timing, with Exit Access returning to Master Admin.
- In View Only, block every mutation on the server, including direct requests. In Full Support, permit validated customer-authorized support actions while retaining finance, ownership and sensitive-action safeguards.

## 5. Session security and auditing
- Revalidate session owner, organization, mode, active account, expiry and revocation on every request.
- Audit access start, expiry, exit/revocation and supported reads/actions without recording credentials or unnecessary sensitive content.
- Preserve Customer Admin visibility and immediate revocation.
- Partition caches by session and organization; discard support data on exit/expiry/revocation so it cannot appear in another workspace.

## Technical approach
- Use additive database changes and authenticated server functions with the existing session RPC security model; do not weaken RLS or expose privileged credentials.
- Resolve overload ambiguity using an explicitly distinct canonical RPC contract or retire the obsolete overload safely after checking all callers.
- Extend shared presentation components with a workspace adapter rather than embedding customer impersonation or ad-hoc company filters.
- Record structural decisions in AGENTS.md; update the existing task roadmap and route metadata where routes change.

## Verification and delivery boundaries
- Run focused unit and disposable-database integration tests for plan create/edit/duplicate/assignment, null/zero/custom/default values, preserved overrides, safe deletion, concurrent limits, every supported View Only mutation, Full Support authorization, expiry/revocation and cross-organization isolation.
- Verify the real authenticated UI and persisted results only in a controlled test environment with cleanup established. Existing production customer records must remain untouched.
- Live test-customer creation remains blocked until the user supplies a new test-only email and safe removal is confirmed; use the organization name **Routiva Deployment Test** if that flow is later authorized.
- Report provider-dependent or unimplemented operational flows as unverified, not mock success.
- **Do not publish or deploy.** Database schema changes affect the shared backend immediately, so preserve compatibility with the currently published app throughout.