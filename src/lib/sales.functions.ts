import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { readAllPages } from './backend-read';

export const getSalesData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await context.supabase.rpc("can_manage_sales");
    if (access.error || !access.data) throw new Error("Active Super Admin authorization is required");
    const db=context.supabase;
    // Unique ID tie-breakers keep tied timestamps stable; batches stay within six connections.
    const [products,customers,categories,leads,deals] = await Promise.all([
      readAllPages((o,e)=>db.from('products_services').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('sales_customers').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('crm_options').select('id,name,is_active').eq('category','category').order('position').order('id').range(o,e)),
      readAllPages((o,e)=>db.from('leads').select('id,customer_name,email,phone,business_name,region').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('deals').select('id,title,lead_id,amount,status').is('deleted_at',null).order('id').range(o,e)),
    ]);
    const [invoices,payments,credits,revenues,settings] = await Promise.all([
      readAllPages((o,e)=>db.from('invoices').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('payments').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('credit_notes').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('revenue_entries').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      db.from('sales_settings').select('*').maybeSingle(),
    ]);
    if(settings.error)throw new Error(settings.error.message);
    const [audit,proposals,proposalEvents] = await Promise.all([
      readAllPages((o,e)=>db.from('financial_audit_logs').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('sales_proposals').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
      readAllPages((o,e)=>db.from('proposal_events').select('*').order('created_at',{ascending:false}).order('id').range(o,e)),
    ]);
    return { products,customers,categories,leads,deals,invoices,payments,credits,revenues,settings:settings.data,audit,proposals,proposalEvents };
  });

export const salesFinancialAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ action: z.enum(["settings", "invoice", "payment", "credit", "cancel_invoice", "void_credit", "revenue", "void_revenue"]), payload: z.record(z.string(), z.unknown()) }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("sales_financial_action", { action: data.action, payload: data.payload as import("@/integrations/supabase/types").Json });
    if (error) throw new Error(error.message);
    return result;
  });