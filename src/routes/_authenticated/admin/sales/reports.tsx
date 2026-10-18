import { createFileRoute } from '@tanstack/react-router';
import { SalesReporting } from '@/components/admin/SalesReporting';
import { salesHead } from '@/lib/sales-data';
import { salesReportQuery } from '@/lib/sales-report-query';
import { reportSearch } from '@/lib/sales-report-model';
export const Route=createFileRoute('/_authenticated/admin/sales/reports')({validateSearch:reportSearch,head:()=>salesHead('Sales Reports','Authorized invoice, collection, customer, product and credit reports.'),loader:({context})=>context.queryClient.ensureQueryData(salesReportQuery),errorComponent:({error})=><p role="alert">{error instanceof Error?error.message:'Could not load Sales records.'}</p>,notFoundComponent:()=> <p>Sales report unavailable.</p>,component:Page});
function Page(){const search=Route.useSearch(),navigate=Route.useNavigate();return <SalesReporting analytics={false} search={search} update={patch=>void navigate({search:prev=>({...prev,...patch})})}/>;}