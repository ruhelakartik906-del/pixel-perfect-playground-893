import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    ]);
    const error = results.find((result) => result.error)?.error;
    if (error) throw new Error(error.message);
    return { products: results[0].data ?? [], customers: results[1].data ?? [], categories: results[2].data ?? [], leads: results[3].data ?? [], deals: results[4].data ?? [] };
  });