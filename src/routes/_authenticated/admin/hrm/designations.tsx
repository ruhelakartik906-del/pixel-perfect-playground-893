import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/designations')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/designation',replace:true})}});
