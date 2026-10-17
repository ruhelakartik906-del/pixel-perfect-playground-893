import {useState} from 'react';
import {createFileRoute,Link} from '@tanstack/react-router';
import {Button} from '@/components/ui/button';
import {HrmPage} from '@/components/admin/hrm/HrmPage';
import {adminHead} from '@/lib/admin-head';
import type {HrModule} from '@/lib/hrm-model';
export const Route=createFileRoute('/_authenticated/my-hr')({head:()=>adminHead('My HR','Your authorized attendance, leave, documents, meetings and announcements.'),component:MyHr});
function MyHr(){const [module,setModule]=useState<HrModule>('attendance');return <main className="min-h-screen bg-admin-bg p-4 lg:p-8"><div className="mb-6 flex flex-wrap items-center gap-2"><Link to="/dashboard" className="mr-auto text-xl font-bold">Routiva CRM</Link>{(['attendance','leave','document','meeting','announcement'] as HrModule[]).map(m=><Button key={m} variant={module===m?'default':'outline'} onClick={()=>setModule(m)}>{m.charAt(0).toUpperCase()+m.slice(1)}</Button>)}</div><HrmPage key={module} module={module} self/></main>}
