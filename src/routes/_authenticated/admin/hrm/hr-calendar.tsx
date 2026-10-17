import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/hr-calendar')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/calendar',replace:true})}});
