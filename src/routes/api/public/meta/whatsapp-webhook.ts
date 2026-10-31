import { createFileRoute } from "@tanstack/react-router";

// Meta WhatsApp Cloud API webhook for organization-level connections.
// GET: Meta's verification handshake (hub.verify_token). POST: X-Hub-Signature-256 checked
// against META_APP_SECRET over the raw body before anything is stored. Each change is
// routed to exactly one organization by its phone_number_id / WABA ID.

export const Route = createFileRoute("/api/public/meta/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const expected = process.env["META_WEBHOOK_VERIFY_TOKEN"];
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        if (!expected || mode !== "subscribe" || token !== expected || !/^[\w-]{1,200}$/.test(challenge)) {
          return new Response("Forbidden", { status: 403 });
        }
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      },
      POST: async ({ request }) => {
        const secret = process.env["META_APP_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const raw = await request.text();
        if (raw.length > 4 * 1024 * 1024) return new Response("Too large", { status: 413 });
        const { validMetaSignature } = await import("@/lib/whatsapp-meta.server");
        if (!(await validMetaSignature(secret, raw, request.headers.get("x-hub-signature-256")))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let body: any;
        try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
        if (body?.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) return new Response("ok");

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const rows: Record<string, unknown>[] = [];
        for (const entry of body.entry.slice(0, 50)) {
          const wabaId = typeof entry?.id === "string" ? entry.id : null;
          for (const change of (Array.isArray(entry?.changes) ? entry.changes : []).slice(0, 50)) {
            const phoneId = change?.value?.metadata?.phone_number_id ?? null;
            const q = db.from("org_whatsapp_connections").select("id,company_id").in("status", ["pending", "connected", "error", "token_expired"]);
            const match = phoneId ? await q.eq("phone_number_id", String(phoneId)) : wabaId ? await q.eq("waba_id", wabaId) : { data: [], error: null };
            if (match.error) return new Response("Storage error", { status: 500 });
            const owner = match.data?.length === 1 ? match.data[0] : null; // ambiguous => unassigned, never cross-org
            rows.push({
              company_id: owner?.company_id ?? null, connection_id: owner?.id ?? null,
              phone_number_id: phoneId ? String(phoneId) : null, waba_id: wabaId,
              field: typeof change?.field === "string" ? change.field : null, payload: change,
              delivery_key: await (await import('@/lib/integration-marketplace')).nonceDigest(JSON.stringify([wabaId,change])),
            });
          }
        }
        if (rows.length) {
          const ins = await db.from("org_whatsapp_webhook_events").upsert(rows as never,{onConflict:'delivery_key',ignoreDuplicates:true});
          if (ins.error) return new Response("Storage error", { status: 500 });
          try { await (await import('@/lib/whatsapp-events.server')).recoverWhatsAppEvents(); }
          catch { return new Response('Processing error',{status:500}); }
        }
        return new Response("ok");
      },
    },
  },
});
