import { createFileRoute } from '@tanstack/react-router';
import { SalesReporting } from '@/components/admin/SalesReporting';
import { salesHead } from '@/lib/sales-data';
import { salesReportQuery } from '@/lib/sales-report-query';
import { reportSearch } from '@/lib/sales-report-model';
export const Route=createFileRoute('/_authenticated/admin/sales/analytics')({validateSearch:reportSearch,head:()=>salesHead('Sales Analytics','Currency-separated Sales trends, collections and receivable performance.'),loader:({context})=>context.queryClient.ensureQueryData(salesReportQuery),errorComponent:({error})=><p role="alert">{error instanceof Error?error.message:'Could not load Sales records.'}</p>,notFoundComponent:()=> <p>Sales analytics unavailable.</p>,component:Page});
function Page(){const search=Route.useSearch(),navigate=Route.useNavigate();return <SalesReporting analytics search={search} update={patch=>void navigate({search:prev=>({...prev,...patch})})}/>;}