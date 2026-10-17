import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/documents')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/document',replace:true})}});
