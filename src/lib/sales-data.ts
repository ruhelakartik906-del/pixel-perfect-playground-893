import { queryOptions } from "@tanstack/react-query";
import { getSalesData } from "@/lib/sales.functions";
import type { Database } from "@/integrations/supabase/types";

export const salesQuery = queryOptions({ queryKey: ["admin-sales"], queryFn: () => getSalesData() });
export type Product = Database["public"]["Tables"]["products_services"]["Row"];
export type Customer = Database["public"]["Tables"]["sales_customers"]["Row"];
export const salesMoney = (value: number | string | null) => value === null ? "Not available" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(Number(value));
export function salesHead(title: string, description: string) {
  return { meta: [{ title: `${title} — Routiva CRM Sales` }, { name: "description", content: description }, { property: "og:title", content: `${title} — Routiva CRM Sales` }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
}