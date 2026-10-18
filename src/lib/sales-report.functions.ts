import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { ReportData } from './sales-report-model';
export const getSalesReportData = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}): Promise<ReportData> => {
  const access=await context.supabase.rpc('can_manage_sales');
  if(access.error || !access.data) throw new Error('Active Super Admin authorization is required');
  async function read<T>(fetchPage:(offset:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>) {
    const rows:T[]=[];
    for(let offset=0;;offset+=1000) {const result=await fetchPage(offset);if(result.error)throw new Error('Could not load authorized Sales records');const page=result.data??[];rows.push(...page);if(page.length<1000)return rows;}
  }
  const [invoices,payments,credits,customers]=await Promise.all([
    read(offset=>context.supabase.from('invoices').select('*').order('id').range(offset,offset+999)),
    read(offset=>context.supabase.from('payments').select('*').order('id').range(offset,offset+999)),
    read(offset=>context.supabase.from('credit_notes').select('*').order('id').range(offset,offset+999)),
    read(offset=>context.supabase.from('sales_customers').select('id,name').order('id').range(offset,offset+999)),
  ]);
  return {invoices,payments,credits,customers};
});