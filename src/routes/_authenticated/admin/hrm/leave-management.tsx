import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/leave-management')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/leave',replace:true})}});
