# Consolidated dependency security cleanup

## Scope
Resolve dependency advisories across the complete npm and Bun graphs while preserving CRM functionality, authentication, tenant boundaries, licensing and Hostinger Node 22 compatibility. No publishing, database migrations, production data changes or credential changes.

## Audit baseline
The reproducible npm installation currently reports 21 affected packages: 3 High and 18 Moderate, with no Critical or Low findings. These include Vite, Zod, SheetJS, esbuild through Drizzle tooling, and minimatch through lint tooling. Affected-parent counts are not distinct advisory counts. Existing scanner results alone do not establish a clean dependency graph.

## Implementation
1. Record advisory identifiers, installed versions, dependency paths, duplicates and available compatible fixes in a consolidated report.
2. Upgrade Vite to a verified secure 8.x release and Zod to a secure 4.x release. Adapt only incompatible validation/type/error callers; preserve input restrictions and test their concrete behavior.
3. Keep spreadsheet features and existing imports. Verify the official secure SheetJS distribution and integrity before replacing the vulnerable npm artifact; report a blocker if the verified distribution is unavailable.
4. Upgrade affected tooling and transitive dependencies. Prefer supported dependency upgrades; use scoped compatibility overrides only when justified and verified. Do not accept npm's suggested old-major downgrades or bypass peer checks.
5. Preserve the established nested npm install strategy and necessary Nitro/Rolldown compatibility pins unless a tested upgrade supersedes them. Regenerate both lockfiles, reconcile differences, and validate clean npm installation and the complete dependency tree.

## Verification
- Run full npm audit, including development dependencies, and the available dependency scanner. Target zero fixable High, Moderate and Low findings; document any genuinely blocked advisory instead of hiding it.
- Run all existing automated tests. Run local account/session/permission, tenant/RLS, customer/employee, licensing, routing and automation tests against disposable local databases only, with suites isolated to prevent fixture interference.
- Run WhatsApp signature/encryption/webhook and API tests. Authenticated browser checks must remain read-only unless they operate on a disposable local environment.
- Check the automatic application build. Manual project builds are prohibited in this environment; explicitly distinguish that result from an unperformed Hostinger Node production build.
- Report tests skipped for missing hosted credentials/provider setup, live integrations not exercised, and actual Hostinger artifact/startup verification not performed. Do not claim zero gaps or full hosting readiness without those checks.

## Deliverable
A project report listing changed packages and versions, advisory paths, clean-install/audit/build results, regression results, remaining advisories and blockers, and unchanged Hostinger settings: Node 22.12+, npm ci including build dependencies, NITRO_PRESET=node-server, expected .output/server/index.mjs.