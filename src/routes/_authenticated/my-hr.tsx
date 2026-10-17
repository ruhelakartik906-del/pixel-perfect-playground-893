import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {getHrmWorkspace} from '@/lib/hrm.functions';
import {createFileRoute,Link} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';
import {HrmPage} from '@/components/admin/hrm/HrmPage';
import {adminHead} from '@/lib/admin-head';
import type {HrModule} from '@/lib/hrm-model';
export const Route=createFileRoute('/_authenticated/my-hr')({head:()=>adminHead('My HR','Your authorized attendance, leave, documents, meetings and announcements.'),component:MyHr});
function MyHr(){const [module,setModule]=useState<HrModule>('attendance');const [management,setManagement]=useState(false);const fetch=useServerFn(getHrmWorkspace);const permissions=useQuery({queryKey:['hr-portal-permissions'],queryFn:()=>fetch({data:{module:'attendance'}})});const manageable=permissions.data?.manageable||[];const modules=management?manageable:(['attendance','leave','document','meeting','announcement'] as HrModule[]);return <main className="min-h-screen bg-admin-bg p-4 lg:p-8"><div className="mb-6 flex flex-wrap items-center gap-2"><Link to="/dashboard" className="mr-auto text-xl font-bold">Routiva CRM</Link>{manageable.length>0&&<Button variant="outline" onClick={()=>{setManagement(!management);setModule(management?'attendance':manageable[0]);}}>{management?'My HR':'HR Administration'}</Button>}{modules.map(m=><Button key={m} variant={module===m?'default':'outline'} onClick={()=>setModule(m)}>{m.charAt(0).toUpperCase()+m.slice(1)}</Button>)}</div><HrmPage key={`${module}-${management}`} module={module} self={!management}/></main>}
