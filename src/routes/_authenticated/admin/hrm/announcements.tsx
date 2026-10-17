import {createFileRoute,redirect} from '@tanstack/react-router';
export const Route=createFileRoute('/_authenticated/admin/hrm/announcements')({beforeLoad:()=>{throw redirect({to:'/admin/hrm/announcement',replace:true})}});
