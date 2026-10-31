# Consolidated dependency security cleanup

## Result

- Full npm audit: **0 vulnerabilities** (Critical/High/Moderate/Low all zero), down from 21 affected package entries: 3 High and 18 Moderate.
- Lovable dependency scan: no known vulnerabilities in 57 production dependencies. **SheetJS vendor tarball is not checked by that scanner** because it is not an npm registry version. Its official 0.20.3 artifact exceeds the published fix versions for both existing SheetJS advisories; npm audit reports no remaining SheetJS advisory.
- Clean npm ci: passed using Node 22.23.4/npm 10.9.9, committed nested strategy, 1,349 installed packages. Full npm ls --all: passed without invalid/missing dependencies.
- Automatic Lovable build: build OK after final changes. No manual production build, Hostinger artifact/startup or deployment was performed.

## Changed dependencies and compatibility

- Vite 8.1.5 → 8.3.5; stays on Vite 8 and supports Node 22.12+.
- Zod 3.25.76 → 4.6.7; override all nested Zod copies to the same secure declared version. Three existing modules required explicit string key schemas for z.record: hrm.functions.ts, user-phase2.functions.ts and messaging.ts. No authorization or business-rule bypass was added.
- SheetJS xlsx 0.18.5 → official HTTPS vendor tarball 0.20.3. Both lockfiles retain artifact integrity. Existing xlsx import/export API retained; real XLSX write/read roundtrip passed.
- Drizzle Kit remains installed, now declared ^0.31.11 instead of unconstrained 0.x. Legacy loader stays present but its vulnerable esbuild dependency is securely overridden in @esbuild-kit/core-utils only. Vite's optional esbuild peer is not globally forced to an incompatible version.
- minimatch secure 11.x override removes vulnerable older copies. Existing ESLint/TypeScript-ESLint APIs inspected; complete npm peer tree passed; ESLint smoke invocation completed without dependency runtime errors. It reported existing formatting violations, not a clean repository lint result.
- source-map-js ≥1.2.2, js-yaml ≥4.3.2 and seroval ≥1.6.11 overrides eliminate additional advisories detected by the Bun-lock scanner but absent from npm audit.
- Previously tested Nitro/h3 and Rolldown WASM compatibility pins and nested npm strategy retained. No required dependency removed, --force/legacy-peer-deps used, security check disabled, or advisory hidden.
- npm and Bun graphs contain platform/tool-specific secure duplicate packages; do not force unsafe universal deduplication. Both graphs were checked separately. No outdated-package mass upgrade unrelated to advisories.

## Previously flagged npm package entries and final resolved versions

| Package | Previous severity | Final npm resolved versions |
|---|---|---|
| @esbuild-kit/core-utils | moderate | 3.3.2 |
| @esbuild-kit/esm-loader | moderate | 2.6.5 |
| @eslint-community/eslint-utils | moderate | 4.10.1 |
| @eslint/config-array | moderate | 0.21.2 |
| @eslint/eslintrc | moderate | 3.3.7 |
| @typescript-eslint/eslint-plugin | moderate | 8.72.1 |
| @typescript-eslint/parser | moderate | 8.72.1 |
| @typescript-eslint/type-utils | moderate | 8.72.1 |
| @typescript-eslint/typescript-estree | moderate | 8.72.1 |
| @typescript-eslint/utils | moderate | 8.72.1 |
| drizzle-kit | moderate | 0.31.11 |
| esbuild | moderate | 0.25.12, 0.28.2 |
| eslint | moderate | 9.39.5 |
| eslint-config-prettier | moderate | 10.1.8 |
| eslint-plugin-prettier | moderate | 5.5.7 |
| eslint-plugin-react-refresh | moderate | 0.4.26 |
| minimatch | moderate | 11.0.3 |
| typescript-eslint | moderate | 8.72.1 |
| vite | high | 4.3.3, 8.3.5 |
| xlsx | high | 0.20.3 |
| zod | high | 4.6.7 |

## Regression evidence

- Ordinary complete suite: **411 passed**, 156 environment-gated tests skipped, across 48 passing files.
- Separately enabled disposable PostgreSQL suites: **121 passed** across ten files:
  - tenant/customer creation/rollback: 8
  - customer-admin employee management/limits/isolation: 7
  - support access/modes/expiry/revocation/audit: 11
  - active-session suspension/role and permission revocation: 5
  - license direct-request RLS: 9
  - installation lifecycle/authorization: 11
  - ad routing/quotas/retry protection/private source isolation: 16
  - attendance RPCs: 10
  - company lead permissions/isolation: 30
  - Board RPC authorization: 14
- Combined executed checks: **532 passed**; 35 unique tests remain unexecuted after accounting for separately run local suites.
- Four added migration regressions cover XLSX roundtrip, WhatsApp sample string validation, injected customer actor rejection, and Zod oversized-array short-circuit behavior.
- Existing full suite includes auth/session cache, customer API denial/rollback, WhatsApp encryption/signature helpers, routing and automation unit coverage.
- Public login visually rendered; signed-out /admin/create-customer redirected to /admin/login; browser reported no runtime errors. This is not a signed-in production flow verification.
- PostgreSQL startup initially failed due missing library in sandbox PostgreSQL 17; retried successfully using complete PostgreSQL 16. Each destructive suite used fresh local state. Initial employee fixture collision and missing local roles were resolved by fresh clusters/role setup, not production/schema edits. All started local databases stopped and their data directories deleted.

## Unverified or blocked checks

- Four automation-retry.local tests require an absent local fault/cron fixture (qa_fault, qa_failure_attempt and cron.calls); no fixture was invented to claim production retry verification. Existing automation unit tests passed; hosted automation/quota integration tests remain disabled to preserve production data.
- Real account creation, live login permissions, Meta signup/message delivery and external webhook/provider roundtrips were not submitted against production. These require controlled hosted test credentials/configuration and customer-data safeguards.
- Actual Hostinger npm run build, .output/server/index.mjs existence, Node startup and signed-in end-to-end workflows remain unverified. Managed automatic build is a separate result.
- No known remaining dependency advisory reported by either scanner, subject to the vendor tarball coverage caveat and advisory database coverage. This is a dependency cleanup, not proof of zero application-level security gaps.

## Hostinger settings and unchanged boundaries

Node 22.12+; npm ci --include=dev; npm run build; NITRO_PRESET=node-server; expected output .output and entry server/index.mjs (node .output/server/index.mjs from root). Existing Cloud-hosted privileged endpoints must still be deployed through an approved separate action; Cloud-only credentials must never be invented or copied into Hostinger/browser code.

No production records, database policies, migrations, credentials, URLs, license statuses, or unrelated pages changed. Nothing published or deployed.

## Advisory inventory (npm baseline)

- esbuild: https://github.com/advisories/GHSA-67mh-4wv8-2f99 — esbuild enables any website to send any requests to the development server and read the response (affected <=0.24.2)

- minimatch: https://github.com/advisories/GHSA-g3hv-75wg-m249 — minimatch has potential denial of service via globparts amplification (affected <11.0.1)

- vite: https://github.com/advisories/GHSA-698v-4r3x-3vcv — launch-editor: escapeCmdArgs() omits % escaping on Windows (affected >=8.0.0 <=8.1.5)

- vite: https://github.com/advisories/GHSA-r825-w8mm-5pxw — launch-editor: Editor CLI flag misinterpretation causing arbitrary command execution for some editors (affected >=8.0.0 <=8.1.5)

- vite: https://github.com/advisories/GHSA-587h-7wmj-h5pm — launch-editor: `fs.existsSync()` existence check can be bypassed on Windows (affected >=8.0.0 <=8.1.5)

- vite: https://github.com/advisories/GHSA-9jrq-w75r-8gcw — Vite: Cross origin script execution through Vite custom middleware (affected >=8.0.0 <=8.1.5)

- vite: https://github.com/advisories/GHSA-rq7h-c2jc-7f22 — Vite: Files outside `server.fs.allow` could be served when project paths match system paths on non-Windows machine (affected >=8.0.0 <=8.1.5)

- xlsx: https://github.com/advisories/GHSA-4r6h-8v6p-xvw6 — Prototype Pollution in sheetJS (affected <0.19.3)

- xlsx: https://github.com/advisories/GHSA-5pgg-2g8v-p4x9 — SheetJS Regular Expression Denial of Service (ReDoS) (affected <0.20.2)

- zod: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 — Zod can exhaust memory while validating oversized constrained collections (affected <4.6.6)

## Baseline affected dependency paths

- @esbuild-kit/core-utils: `node_modules/drizzle-kit/node_modules/@esbuild-kit/esm-loader/node_modules/@esbuild-kit/core-utils`

- @esbuild-kit/esm-loader: `node_modules/drizzle-kit/node_modules/@esbuild-kit/esm-loader`

- @eslint-community/eslint-utils: `node_modules/eslint/node_modules/@eslint-community/eslint-utils`, `node_modules/typescript-eslint/node_modules/@typescript-eslint/utils/node_modules/@eslint-community/eslint-utils`

- @eslint/config-array: `node_modules/eslint/node_modules/@eslint/config-array`

- @eslint/eslintrc: `node_modules/eslint/node_modules/@eslint/eslintrc`

- @typescript-eslint/eslint-plugin: `node_modules/typescript-eslint/node_modules/@typescript-eslint/eslint-plugin`

- @typescript-eslint/parser: `node_modules/typescript-eslint/node_modules/@typescript-eslint/parser`

- @typescript-eslint/type-utils: `node_modules/typescript-eslint/node_modules/@typescript-eslint/eslint-plugin/node_modules/@typescript-eslint/type-utils`

- @typescript-eslint/typescript-estree: `node_modules/typescript-eslint/node_modules/@typescript-eslint/typescript-estree`

- @typescript-eslint/utils: `node_modules/typescript-eslint/node_modules/@typescript-eslint/utils`

- drizzle-kit: `node_modules/drizzle-kit`

- esbuild: `node_modules/drizzle-kit/node_modules/@esbuild-kit/esm-loader/node_modules/@esbuild-kit/core-utils/node_modules/esbuild`

- eslint: `node_modules/eslint`

- eslint-config-prettier: `node_modules/eslint-config-prettier`

- eslint-plugin-prettier: `node_modules/eslint-plugin-prettier`

- eslint-plugin-react-refresh: `node_modules/eslint-plugin-react-refresh`

- minimatch: `node_modules/eslint/node_modules/minimatch`, `node_modules/typescript-eslint/node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch`

- typescript-eslint: `node_modules/typescript-eslint`

- vite: `node_modules/vite`

- xlsx: `node_modules/xlsx`

- zod: `node_modules/zod`
