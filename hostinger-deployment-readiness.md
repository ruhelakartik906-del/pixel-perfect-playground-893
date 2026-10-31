# Hostinger Node.js deployment

## Confirmed diagnosis

- The repository had `bun.lock` but no `package-lock.json`; npm therefore resolved dependency ranges afresh rather than reproducing the existing Bun graph.
- Reproduced `Cannot read properties of null (reading 'edgesOut')` in a clean temporary directory using Node 22.23.4 and npm 10.9.9. npm's Arborist `#loadPeerSet` dereferenced a null parent while building the Vitest peer set. This is an npm resolver crash, not evidence that Vitest itself is defective. The precise nested edge causing that null parent was not identified.
- Fresh resolution also revealed two concrete conflicts: Nitro 3.0.260603-beta depends on ocache ^0.1.4, but newly resolved h3 2.0.8 requires ocache >=0.3.0; Rolldown's WASM binding 1.2.1 requires Emnapi 2.0.0-alpha.3, but newly resolved @napi-rs/wasm-runtime 1.2.6 requires different Emnapi versions.
- Scoped overrides retain h3 2.0.1-rc.26 and WASM runtime 1.2.0 from the existing tested Bun lock. No direct application dependencies were removed or downgraded.
- `.npmrc` selects nested installation. A hoisted lock produced incomplete nested entries; the nested lock installs correctly with npm 10.9.9, without `--legacy-peer-deps` or `--force`. npm 11.6.2 was used to generate the initial tree because npm 10 crashed during unlocked resolution.

## Corrected hosting settings

| Setting | Value |
|---|---|
| Application | Nitro / Node.js |
| Node | 22, minimum 22.12.0; tested 22.23.4 |
| Package manager | npm; tested 10.9.9 |
| Install | `npm ci --include=dev` using committed package-lock.json and .npmrc |
| Build | `npm run build` |
| Build environment | `NITRO_PRESET=node-server` |
| Output directory | `.output` |
| Entry relative to output | `server/index.mjs` |
| Start from project root | `node .output/server/index.mjs` |

The existing Vite configuration already supports NITRO_PRESET auto-targeting through its configured wrapper. No Vite plugin replacement or hard-pinned hosting target is needed; Lovable retains its managed build target.

## Verification and limits

- Exact committed manifest, lockfile and .npmrc installed in a disposable folder: `npm ci` exit 0, 1,360 packages.
- Clean complete dependency tree: `npm ls --all` exit 0, no invalid or missing dependencies.
- Customer API authorization/rollback tests: 22 passed. Auth navigation-cache tests: 6 passed.
- Automatic Lovable build: build OK after changes. This is not a Hostinger Node production artifact verification.
- The Hostinger `npm run build`, actual `.output/server/index.mjs` artifact, server startup, authentication and live CRM operations remain unverified. No Hostinger deployment was performed. Expected output and entry above follow the installed Nitro configuration; they are not a claim that an artifact was produced here.
- Existing Lovable Cloud private credentials are not available to Hostinger. Do not add fabricated service-role keys. Customer creation uses the prepared authenticated Cloud Master API; deployment of that API and actual Hostinger acceptance remain separate blockers. Other privileged workflows need their existing Cloud-hosted server boundary before they can be claimed operational on Hostinger.
- Post-change vulnerability scan read bun.lock, not the npm lock; it still reports existing advisories, including xlsx and Zod. Those are not fixed by this installation-only change and were not addressed through unrelated upgrades.
- No database, policies, customer records, credentials, URLs or license statuses changed. Nothing published.