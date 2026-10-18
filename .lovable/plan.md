# Routiva CRM backend completion

Preserve all existing pages, records and working services. WhatsApp stays unchanged and disconnected.

## First implementation pass

1. **Close confirmed access gaps.** Administrative invitation/mailbox operations and legacy record policies currently rely on role alone. Require an active authorized administrator, prevent blocked administrators from reactivating themselves, and preserve permitted personal access for standard users without a company.
2. **Make invitations reliable.** Validate the selected company and permission role before sending. Save the invited user’s profile, role and membership atomically, activate only after successful setup, and report failures honestly. Validate the invitation’s return address.
3. **Keep shared records complete.** Paginate existing Admin sales reads so older invoices, proposals and activity cannot disappear beyond the database response limit. Reuse canonical records and existing Admin oversight for Tasks and Follow-ups rather than duplicating them.
4. **Verify these changes safely.** Add focused permission, invitation rollback and pagination tests. Use authorized sessions for save/readback and cross-account checks where available. Do not alter real account roles, statuses, credentials or financial records for testing.

## Remaining completion work, in priority order

- Verify and repair demonstrated gaps in Leads/Routing, Tasks/Follow-ups, Deals and Admin–User synchronization.
- Verify proposals, invoice drafts, issuance, payments, credits and reporting safeguards without changing live financial history.
- Verify Admin–User Chat/Support conversations, attachments and company isolation.
- Complete applicable HRM attendance/leave/meeting/announcement operations and read tracking; preserve existing payroll rules.
- Implement non-WhatsApp automation execution using existing definitions: conditions, ordered actions, delays, logs, failure handling and idempotent retries. Paused workflows stay paused; unconfigured external actions never run.
- Complete secure lead-intake and email infrastructure where supported. Missing provider credentials or approvals remain **SETUP REQUIRED**, not connected.

## Verification boundaries

The available requester account is a pending Client, not an authorized Admin. Existing shared-record implementation is not proof of cross-account synchronization. Mark unavailable Admin/employee/company checks **UNVERIFIED**; request approval for any additional authorized account session when necessary.

Production financial/payroll test writes require confirmed isolation. External email delivery and Meta intake require real provider configuration. These dependencies do not block safe internal fixes, but prevent an honest claim that the whole backend is production-ready.

## Technical approach

- Reuse existing authenticated server functions, transactional database operations, ownership fields and scoped policies.
- Apply additive database changes only; tighten actual permission gaps without disabling RLS or granting standard users elevated access.
- Use stable, bounded collection reads and Worker-compatible server logic.
- Track unfinished work and exact blockers in the existing roadmap. Report **Module | Completed Work | Verified | Still Pending** after each completed pass.