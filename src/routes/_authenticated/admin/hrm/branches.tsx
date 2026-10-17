import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/branches')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/branch',replace:true})}});
