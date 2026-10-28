# Customer installation licensing — setup

## How it works
- Master CRM (this project) is the license authority. Register an installation in **Create CRM Admin**; it starts **Pending** (no validity yet). A one-time credential is shown once; only its SHA-256 hash is stored.
- Activate / Suspend / Resume / Renew (1 or 2 calendar years, Kolkata time) / Rotate credential from **Sold CRM Admins**. Every change is audited.
- Customer copies call `POST https://<master>/api/public/license/verify` with `Authorization: Bearer <credential>` and `{"installation_id": "RCRM-..."}`. Response: status, expiry, server time, installation ID only. 10 invalid attempts / 10 min per installation → rate limited.

## Per customer project (each a separate Remix with its own Lovable Cloud backend)
Add these **private server secrets** (never VITE_ variables):
- `LICENSE_MODE=customer`
- `LICENSE_INSTALLATION_ID=RCRM-...`
- `LICENSE_CREDENTIAL=rlic_...`
- `LICENSE_MASTER_URL=https://<published Master CRM URL>`
Then publish the customer CRM. Remixing does NOT copy these values.

Confirm: open `https://<customer>/api/public/license/status` → `allowed: true` after activation; Sold CRM Admins shows "Last Verified".

## Enforcement limits (honest)
- Covered: every server function in the customer CRM (blocked with LICENSE_INACTIVE; mutations re-verify each time; active answers cached ≤ 60 s; network failure = blocked).
- Max suspension/expiry delay: 60 seconds.
- NOT covered yet: pages that read/write the customer database directly from the browser (RLS does not know the license state), and sign-in itself. A customer-side protected license table + RLS condition is needed to close this.

## Lifecycle test (needs one disposable customer project)
Pending → blocked; Activate → allowed; Suspend → blocked within 60 s; Resume → allowed; expire (renew test) → blocked; Rotate → blocked until new credential configured.
