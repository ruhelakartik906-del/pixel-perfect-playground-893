import Decimal from 'decimal.js';
import type { Database } from '@/integrations/supabase/types';
import { invoiceBalance, sumMoney } from './sales-finance';
type Tables = Database['public']['Tables'];
export type ReportData = { invoices: Tables['invoices']['Row'][]; payments: Tables['payments']['Row'][]; credits: Tables['credit_notes']['Row'][]; customers: Pick<Tables['sales_customers']['Row'], 'id' | 'name'>[] };
export type ReportSearch = { period: string; from: string; to: string; currency: string; section: string; q: string; status: string; customer: string; sort: number; desc: boolean; page: number; size: number };
export function reportSearch(s: Record<string, unknown>): ReportSearch {
  return { period: ['today','7','30','90','year','custom'].includes(String(s.period)) ? String(s.period) : '30', from: String(s.from ?? ''), to: String(s.to ?? ''), currency: String(s.currency ?? ''), section: ['invoices','payments','customers','products','credits'].includes(String(s.section)) ? String(s.section) : 'invoices', q: String(s.q ?? ''), status: String(s.status ?? ''), customer: String(s.customer ?? ''), sort: Math.max(0, Number(s.sort) || 0), desc: s.desc === true || s.desc === 'true', page: Math.max(1, Math.floor(Number(s.page) || 1)), size: [10,25,50].includes(Number(s.size)) ? Number(s.size) : 10 };
}
export function salesToday() { const parts=new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-'); }
export function salesWindow(period: string, today: string, from = '', to = '') {
  if (period === 'custom') return { from, to };
  const start = new Date(`${today}T12:00:00Z`);
  if (period === '7' || period === '30') start.setUTCDate(start.getUTCDate() - (Number(period)-1));
  if (period === '90') { const day=start.getUTCDate(); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth()-3); const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate(); start.setUTCDate(Math.min(day,last)); }
  if (period === 'year') start.setUTCMonth(0,1);
  return {from:start.toISOString().slice(0,10),to:today};
}
export function previousWindow(from: string, to: string) { const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1; return {from:new Date(Date.parse(from)-days*86400000).toISOString().slice(0,10),to:new Date(Date.parse(from)-86400000).toISOString().slice(0,10)}; }
export function reportMoney(value: number, currency: string) { try { return new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(value); } catch { return `${currency} ${value.toFixed(2)}`; } }
export function buildSalesReport(data: ReportData, from: string, to: string, currency: string) {
  const inRange = (date:string) => date >= from && date <= to;
  const byId = new Map(data.invoices.map(i=>[i.id,i]));
  const name = (i: ReportData['invoices'][number]) => { const billing=i.billing_details; return billing && typeof billing==='object' && !Array.isArray(billing) && typeof billing.name==='string' ? billing.name : data.customers.find(c=>c.id===i.customer_id)?.name ?? 'Unknown customer'; };
  const active = (i: ReportData['invoices'][number]) => !['draft','cancelled'].includes(i.status);
  const payments = data.payments.flatMap(p=>{const i=byId.get(p.invoice_id); return i && active(i) && i.currency===currency && inRange(p.payment_date) ? [{...p,customer:name(i),customerId:i.customer_id,invoice:i.number}] : [];});
  const invoices = data.invoices.filter(i=>i.currency===currency&&inRange(i.issue_date)).map(i=>{
    const paid = sumMoney(data.payments.filter(p=>p.invoice_id===i.id&&p.payment_date<=to).map(p=>p.amount));
    const credited = sumMoney(data.credits.filter(c=>c.invoice_id===i.id&&c.status==='issued'&&c.issue_date<=to).map(c=>c.amount));
    const outstanding = active(i) ? invoiceBalance(i.total,paid,credited).outstanding : 0;
    const status = !active(i) ? i.status : outstanding===0 ? 'paid' : i.due_date<to ? 'overdue' : paid>0 ? 'partially paid' : 'unpaid';
    return {...i,customer:name(i),paid,credited,outstanding,reportStatus:status};
  });
  const issued=invoices.filter(active);
  const credits=data.credits.flatMap(c=>{const i=byId.get(c.invoice_id);return i&&i.currency===currency&&inRange(c.issue_date)?[{...c,customer:name(i),customerId:i.customer_id,invoice:i.number}]:[];});
  const customerIds=new Set([...issued.map(i=>i.customer_id),...payments.map(p=>p.customerId)]);
  const customers=[...customerIds].map(id=>{const inv=issued.filter(i=>i.customer_id===id),pay=payments.filter(p=>p.customerId===id);return {id,name:inv[0]?.customer??pay[0]?.customer??'Unknown customer',count:inv.length,total:sumMoney(inv.map(i=>i.total)),collected:sumMoney(pay.map(p=>p.amount)),outstanding:sumMoney(inv.map(i=>i.outstanding))};});
  const productMap=new Map<string,{name:string;quantity:number;net:number;ids:Set<string>}>();
  for(const i of issued) for(const item of Array.isArray(i.items)?i.items:[]) {
    if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.name!=='string')continue;
    const key=String(item.product_id||item.name), old=productMap.get(key)??{name:item.name,quantity:0,net:0,ids:new Set<string>()};
    const quantity=Number(item.quantity)||0;
    const net=new Decimal(quantity).mul(Number(item.unit_price)||0).mul(new Decimal(1).minus(new Decimal(Number(item.discount_percent)||0).div(100))).toDecimalPlaces(2).toNumber();
    old.quantity=new Decimal(old.quantity).plus(quantity).toNumber();old.net=sumMoney([old.net,net]);old.ids.add(i.id);productMap.set(key,old);
  }
  const products=[...productMap.values()].map(p=>({name:p.name,quantity:p.quantity,net:p.net,count:p.ids.size}));
  const monthly=new Map<string,{name:string;invoiced:number;collected:number}>();
  const bucket=(day:string)=>{const key=day.slice(0,7),row=monthly.get(key)??{name:key,invoiced:0,collected:0};monthly.set(key,row);return row;};
  issued.forEach(i=>{const r=bucket(i.issue_date);r.invoiced=sumMoney([r.invoiced,i.total]);});payments.forEach(p=>{const r=bucket(p.payment_date);r.collected=sumMoney([r.collected,p.amount]);});
  const trend=[...new Set(payments.map(p=>p.payment_date))].sort().map(day=>({name:day,collected:sumMoney(payments.filter(p=>p.payment_date===day).map(p=>p.amount))}));
  const distribution=[...new Set(invoices.map(i=>i.reportStatus))].map(status=>({name:status,value:invoices.filter(i=>i.reportStatus===status).length}));
  const total=sumMoney(issued.map(i=>i.total));
  return {invoices,issued,payments,credits,customers,products,monthly:[...monthly.values()].sort((a,b)=>a.name.localeCompare(b.name)),trend,distribution,metrics:{count:invoices.length,invoiced:total,collected:sumMoney(payments.map(p=>p.amount)),outstanding:sumMoney(issued.map(i=>i.outstanding)),overdue:sumMoney(issued.filter(i=>i.reportStatus==='overdue').map(i=>i.outstanding)),credits:sumMoney(credits.filter(c=>c.status==='issued').map(c=>c.amount)),customers:customers.length,average:issued.length?new Decimal(total).div(issued.length).toDecimalPlaces(2).toNumber():0}};
}
export function sortReportRows(rows: (string|number)[][], column: number, desc: boolean) { return [...rows].sort((a,b)=>{const x=a[column]??'',y=b[column]??'';return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y)))*(desc?-1:1);}); }