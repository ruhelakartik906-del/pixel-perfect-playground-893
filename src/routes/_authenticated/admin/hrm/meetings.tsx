import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/meetings')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/meeting',replace:true})}});
