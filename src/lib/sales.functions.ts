import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getSalesData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await context.supabase.rpc("can_manage_sales");
    if (access.error || !access.data) throw new Error("Active Super Admin authorization is required");
    const results = await Promise.all([
      context.supabase.from("products_services").select("*").order("created_at", { ascending: false }),
      context.supabase.from("sales_customers").select("*").order("created_at", { ascending: false }),
      context.supabase.from("crm_options").select("id,name,is_active").eq("category", "category").order("position"),
      context.supabase.from("leads").select("id,customer_name,email,phone,business_name,region").order("created_at", { ascending: false }),
      context.supabase.from("deals").select("id,title,lead_id,amount,status"),
      context.supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      context.supabase.from("payments").select("*").order("created_at", { ascending: false }),
      context.supabase.from("credit_notes").select("*").order("created_at", { ascending: false }),
      context.supabase.from("revenue_entries").select("*").order("created_at", { ascending: false }),
      context.supabase.from("sales_settings").select("*").maybeSingle(),
      context.supabase.from("financial_audit_logs").select("*").order("created_at", { ascending: false }),
    ]);
    const error = results.find((result) => result.error)?.error;
    if (error) throw new Error(error.message);
    return { products: results[0].data ?? [], customers: results[1].data ?? [], categories: results[2].data ?? [], leads: results[3].data ?? [], deals: results[4].data ?? [], invoices: results[5].data ?? [], payments: results[6].data ?? [], credits: results[7].data ?? [], revenues: results[8].data ?? [], settings: results[9].data, audit: results[10].data ?? [] };
  });

export const salesFinancialAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ action: z.enum(["settings", "invoice", "payment", "credit", "cancel_invoice", "void_credit", "revenue", "void_revenue"]), payload: z.record(z.string(), z.unknown()) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("sales_financial_action", { action: data.action, payload: data.payload as import("@/integrations/supabase/types").Json });
    if (error) throw new Error(error.message);
    return result;
  });