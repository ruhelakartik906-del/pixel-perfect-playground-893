# User-panel Leads

- Remove the new Board/Lead Status experience from Super Admin navigation and restore its existing Leads list; preserve Admin management.
- Reuse User Board, details and dialogs for add/edit/delete/move, with active Employee/manager company authorization and self-assignment on creation.
- Keep canonical lead/stage records. Store company-specific status labels, colors, order, visibility and new-lead default separately so one company cannot change another company’s Board or automation stages.
- Enable status controls and synchronize saved configuration with the User Board; preserve protected initial/closed stages and reject deletion of statuses in use.
- Run focused authorization/data tests and verify accessible User pages and refresh. Report any unavailable authorized live-session checks.

## Technical details
Authenticated RPCs enforce active accounts, permitted active companies and assigned-lead boundaries; no account statuses or role assignments are changed. Additive stage ownership and company configuration preserve existing foreign keys and automation IDs.