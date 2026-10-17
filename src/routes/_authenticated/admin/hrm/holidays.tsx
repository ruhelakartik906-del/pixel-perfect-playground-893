import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/holidays')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/holiday',replace:true})}});
