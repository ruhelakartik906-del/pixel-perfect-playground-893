import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowDownUp, CreditCard, Download, FileText, Receipt, Users, Wallet, AlertCircle, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Breadcrumb, EmptyState, KpiCard, SearchInput } from './ui';
import { SalesPagination } from './sales-shared';
import { salesReportQuery } from '@/lib/sales-report-query';
import { buildSalesReport, previousWindow, reportMoney, salesToday, salesWindow, sortReportRows, type ReportSearch } from '@/lib/sales-report-model';
import { exportCsv, exportPdf, exportXlsx } from '@/lib/crm-data';

type Rows=(string|number)[][];
const titles:Record<string,string>={invoices:'Invoice Report',payments:'Payment / Collection Report',customers:'Customer Sales Report',products:'Products & Services Report',credits:'Credit Notes Report'};
const headers:Record<string,string[]>={invoices:['Invoice Number','Customer','Invoice Date','Due Date','Total Amount','Paid Amount','Outstanding Amount','Status'],payments:['Customer','Related Invoice','Payment Date','Payment Amount','Payment Method','Payment Reference'],customers:['Customer Name','Number of Invoices','Total Invoiced','Total Collected','Outstanding Balance'],products:['Product / Service Name','Quantity Sold','Net Sales Value','Related Invoice Count'],credits:['Credit Note Number','Customer','Related Invoice','Amount','Date','Status']};
const palette=['var(--admin-blue)','var(--admin-green)','var(--admin-orange)','var(--admin-red)','var(--admin-purple)','var(--chart-2)'];
export function SalesReporting({analytics,search,update}:{analytics:boolean;search:ReportSearch;update:(patch:Partial<ReportSearch>)=>void}) {
  const {data}=useSuspenseQuery(salesReportQuery);
  const today=salesToday(),win=salesWindow(search.period,today,search.from,search.to);
  const valid=/^\d{4}-\d{2}-\d{2}$/.test(win.from)&&/^\d{4}-\d{2}-\d{2}$/.test(win.to)&&win.from<=win.to&&win.to<=today;
  const currencies=[...new Set(data.invoices.map(i=>i.currency))].sort(),currency=currencies.includes(search.currency)?search.currency:currencies[0]??'INR';
  const scoped=search.customer?{...data,invoices:data.invoices.filter(i=>i.customer_id===search.customer)}:data;
  const r=buildSalesReport(scoped,valid?win.from:'9999',valid?win.to:'0000',currency),m=r.metrics;
  const prev=valid?previousWindow(win.from,win.to):{from:'9999',to:'0000'};
  const prior=buildSalesReport(scoped,prev.from,prev.to,currency).metrics.collected;
  const money=(v:number)=>reportMoney(v,currency);
  const raw:Record<string,Rows>={
    invoices:r.invoices.filter(i=>!search.status||i.reportStatus===search.status).map(i=>[i.number,i.customer,i.issue_date,i.due_date,i.total,i.paid,i.outstanding,i.reportStatus]),
    payments:r.payments.map(p=>[p.customer,p.invoice,p.payment_date,p.amount,p.method,p.reference]),
    customers:r.customers.map(c=>[c.name,c.count,c.total,c.collected,c.outstanding]),
    products:r.products.map(p=>[p.name,p.quantity,p.net,p.count]),
    credits:r.credits.filter(c=>!search.status||c.status===search.status).map(c=>[c.number,c.customer,c.invoice,c.amount,c.issue_date,c.status]),
  };
  const section=search.section,cols=headers[section]??headers.invoices;
  const rows=sortReportRows((raw[section]??[]).filter(row=>row.some(v=>String(v).toLowerCase().includes(search.q.toLowerCase()))),search.sort,search.desc);
  const page=Math.min(search.page,Math.max(1,Math.ceil(rows.length/search.size)));
  const filename=`sales-${section}-${currency}-${win.from}-${win.to}`;
  const exportHeaders=cols.map(h=>/Amount|Value|Invoiced|Collected|Balance/.test(h)?`${h} (${currency})`:h);
  async function download(format:string) {try {if(format==='csv')exportCsv(exportHeaders,rows,filename);if(format==='xlsx')await exportXlsx(exportHeaders,rows,filename);if(format==='pdf')await exportPdf(`${titles[section]} · ${currency} · ${win.from} to ${win.to}`,exportHeaders,rows,filename);}catch{toast.error('Could not export this report');}}
  const metrics=analytics?[['Total Revenue Collected',m.collected,Wallet,'green'],['Total Invoiced Value',m.invoiced,FileText,'blue'],['Outstanding Receivables',m.outstanding,Receipt,'orange'],['Overdue Receivables',m.overdue,AlertCircle,'red'],['Total Customers',m.customers,Users,'purple'],['Average Invoice Value',m.average,CreditCard,'pink']]:[['Total Invoices',m.count,FileText,'blue'],['Issued Invoice Value',m.invoiced,Receipt,'purple'],['Total Payments Received',m.collected,Wallet,'green'],['Outstanding Amount',m.outstanding,CreditCard,'orange'],['Overdue Invoice Amount',m.overdue,AlertCircle,'red'],['Credit Notes Issued',m.credits,Receipt,'pink']];
  const invoiceRows=(list:typeof r.invoices):Rows=>list.map(i=>[i.number,i.customer,i.due_date,money(i.outstanding),i.reportStatus]);
  return <div className="space-y-6">
    <Breadcrumb label={analytics?'Sales Analytics':'Sales Reports'} trail={['Sales']}/>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">{analytics?'Sales Analytics':'Sales Reports'}</h1><p className="mt-1 text-muted-foreground">{analytics?'Analyze revenue, customer sales and invoice performance.':'Track invoices, revenue, payments and customer sales performance.'}</p></div></header>
    <div className="flex flex-wrap items-end gap-3 border-y py-4">
      <label className="grid gap-1 text-sm font-semibold">Date range<select aria-label="Date range" className="h-10 rounded-md border bg-card px-3" value={search.period} onChange={e=>update({period:e.target.value,page:1})}>{[...(!analytics?[['today','Today']]:[]),['7','Last 7 Days'],['30','Last 30 Days'],['90','Last 3 Months'],['year','This Year'],['custom','Custom Date Range']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">From<Input aria-label="From date" type="date" max={today} value={win.from} onChange={e=>update({period:'custom',from:e.target.value,to:win.to,page:1})}/></label>
      <label className="grid gap-1 text-sm font-semibold">To<Input aria-label="To date" type="date" max={today} value={win.to} onChange={e=>update({period:'custom',from:win.from,to:e.target.value,page:1})}/></label>
      <label className="grid gap-1 text-sm font-semibold">Currency<select aria-label="Currency" className="h-10 rounded-md border bg-card px-3" value={currency} onChange={e=>update({currency:e.target.value,page:1})}>{(currencies.length?currencies:['INR']).map(c=><option key={c}>{c}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Customer<select aria-label="Customer filter" className="h-10 max-w-56 rounded-md border bg-card px-3" value={search.customer} onChange={e=>update({customer:e.target.value,page:1})}><option value="">All customers</option>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>
    {!valid?<p role="alert" className="text-destructive">Enter a valid date range ending today or earlier.</p>:<>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label,value,icon,tone])=><KpiCard key={String(label)} label={String(label)} value={String(label)==='Total Invoices'||String(label)==='Total Customers'?Number(value):money(Number(value))} icon={icon as typeof Wallet} tone={tone as 'blue'} note={String(label).includes('Collected')||String(label).includes('Payments')?'Persisted invoice payments':String(label).includes('Outstanding')||String(label).includes('Overdue')?`Selected invoices · balance at ${win.to}`:currency}/>)}</div>
    <p className="text-xs text-muted-foreground">Invoices by issue date · collections by payment date · credits by issue date. Balances include payments and active credits through {win.to}. Product net sales exclude tax; credits are invoice-level. Standalone revenue has no recorded currency and is excluded from collections.</p>
    {analytics?<>
      <div className="flex items-center gap-2 border-b pb-4 text-sm"><RefreshCw className="size-4 text-admin-blue"/><span>Collection growth</span><strong>{prior>0?`${((m.collected-prior)/prior*100).toFixed(1)}%`:'Unavailable — no prior-period collections'}</strong></div>
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <Chart title="Revenue / Collections Trend" empty={!r.trend.length}><LineChart data={r.trend}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="name" fontSize={11}/><YAxis fontSize={11}/><Tooltip formatter={(v:number)=>money(v)}/><Line type="monotone" dataKey="collected" name="Collections" stroke="var(--admin-green)" strokeWidth={3}/></LineChart></Chart>
        <Chart title="Invoiced vs Collected" empty={!r.monthly.length}><BarChart data={r.monthly}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="name" fontSize={11}/><YAxis fontSize={11}/><Tooltip formatter={(v:number)=>money(v)}/><Legend/><Bar dataKey="invoiced" name="Invoiced" fill="var(--admin-blue)" radius={[4,4,0,0]}/><Bar dataKey="collected" name="Collected" fill="var(--admin-green)" radius={[4,4,0,0]}/></BarChart></Chart>
        <Chart title="Invoice Status Distribution" empty={!r.invoices.length}><PieChart><Pie data={r.distribution} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100}>{r.distribution.map((d,i)=><Cell key={d.name} fill={palette[i%palette.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></Chart>
        <Chart title="Monthly Sales Performance" empty={!r.issued.length}><BarChart data={r.monthly}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="name" fontSize={11}/><YAxis fontSize={11}/><Tooltip formatter={(v:number)=>money(v)}/><Bar dataKey="invoiced" name="Invoice value" fill="var(--admin-purple)" radius={[4,4,0,0]}/></BarChart></Chart>
        <Chart title="Top Customers by Sales" empty={!r.customers.length}><BarChart layout="vertical" data={[...r.customers].sort((a,b)=>b.total-a.total).slice(0,8)}><XAxis type="number" fontSize={11}/><YAxis type="category" dataKey="name" width={110} fontSize={11}/><Tooltip formatter={(v:number)=>money(v)}/><Bar dataKey="total" name="Invoiced" fill="var(--admin-blue)" radius={[0,4,4,0]}/></BarChart></Chart>
        <Chart title="Top Products & Services" empty={!r.products.length}><BarChart data={[...r.products].sort((a,b)=>b.net-a.net).slice(0,8)}><XAxis dataKey="name" fontSize={11}/><YAxis fontSize={11}/><Tooltip formatter={(v:number)=>money(v)}/><Bar dataKey="net" name="Net sales" fill="var(--chart-2)" radius={[4,4,0,0]}/></BarChart></Chart>
      </div>
      <SmallTable title="Outstanding Invoices" columns={['Invoice','Customer','Due Date','Outstanding','Status']} rows={invoiceRows(r.issued.filter(i=>i.outstanding>0))}/>
      <SmallTable title="Overdue Invoices" columns={['Invoice','Customer','Due Date','Outstanding','Status']} rows={invoiceRows(r.issued.filter(i=>i.reportStatus==='overdue'))}/>
      <SmallTable title="Customer Sales Breakdown" columns={headers.customers} rows={r.customers.map(c=>[c.name,c.count,money(c.total),money(c.collected),money(c.outstanding)])}/>
      <SmallTable title="Recent Sales Activity" columns={['Date','Activity','Reference','Customer','Amount']} rows={[...r.issued.map(i=>[i.issue_date,'Invoice issued',i.number,i.customer,money(i.total)]),...r.payments.map(p=>[p.payment_date,'Payment received',p.invoice,p.customer,money(p.amount)]),...r.credits.map(c=>[c.issue_date,`Credit ${c.status}`,c.number,c.customer,money(c.amount)])].sort((a,b)=>String(b[0]).localeCompare(String(a[0]))).slice(0,10)}/>
    </>:<>
      <div role="tablist" className="flex flex-wrap gap-2 border-b pb-3">{Object.entries(titles).map(([id,label])=><Button key={id} role="tab" aria-selected={section===id} variant={section===id?'default':'ghost'} onClick={()=>update({section:id,status:'',sort:0,page:1})}>{label}</Button>)}</div>
      <div className="flex flex-wrap items-center gap-3"><SearchInput placeholder="Search report…" value={search.q} onChange={q=>update({q,page:1})}/>{['invoices','credits'].includes(section)&&<select aria-label="Status filter" className="h-10 rounded-md border bg-card px-3" value={search.status} onChange={e=>update({status:e.target.value,page:1})}><option value="">All statuses</option>{(section==='credits'?['issued','void']:['draft','cancelled','unpaid','partially paid','paid','overdue']).map(s=><option key={s}>{s}</option>)}</select>}<div className="ml-auto flex gap-2">{['csv','xlsx','pdf'].map(f=><Button key={f} variant="outline" onClick={()=>void download(f)}><Download className="size-4"/>{f==='xlsx'?'Excel':f.toUpperCase()}</Button>)}</div></div>
      <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-b bg-muted/50"><tr>{cols.map((c,index)=><th key={c} className="px-4 py-2" aria-sort={search.sort===index?search.desc?'descending':'ascending':'none'}><Button variant="ghost" size="sm" onClick={()=>update({sort:index,desc:search.sort===index?!search.desc:false})}>{c}<ArrowDownUp className="size-3"/></Button></th>)}</tr></thead><tbody className="divide-y">{rows.slice((page-1)*search.size,page*search.size).map((row,i)=><tr key={i} className="hover:bg-muted/30">{row.map((v,j)=><td key={j} className="px-4 py-4">{typeof v==='number'&&/Amount|Value|Invoiced|Collected|Balance/.test(cols[j])?money(v):v}</td>)}</tr>)}</tbody></table>{!rows.length&&<EmptyState title="No Sales records in this date range"/>}</div>
      <SalesPagination page={page} size={search.size} total={rows.length} onPage={page=>update({page})} onSize={size=>update({size,page:1})}/>
    </>}
    </>}
  </div>;
}
function Chart({title,empty,children}:{title:string;empty:boolean;children:ReactElement}) {return <section className="min-w-0 border-b pb-6"><h2 className="mb-5 text-lg font-bold">{title}</h2>{empty?<EmptyState title="No financial records in this date range"/>:<div className="h-72 w-full"><ResponsiveContainer>{children}</ResponsiveContainer></div>}</section>;}
function SmallTable({title,columns,rows}:{title:string;columns:string[];rows:Rows}) {return <section><h2 className="mb-4 text-lg font-bold">{title}</h2><div className="max-h-96 overflow-auto rounded-lg border bg-card"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-muted/50"><tr>{columns.map(c=><th className="px-4 py-3" key={c}>{c}</th>)}</tr></thead><tbody className="divide-y">{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j} className="px-4 py-3">{v}</td>)}</tr>)}</tbody></table>{!rows.length&&<EmptyState title="No financial records in this date range"/>}</div></section>;}