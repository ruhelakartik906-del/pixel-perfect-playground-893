import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { UserWorkspace } from './UserWorkspace';
import { LeadDetails } from './LeadDetails';
import { LeadsBoard } from '@/components/pipeline/LeadsBoard';
import { userCrmQuery } from '@/lib/user-crm-query';
export function MyLeads() {
  const { data } = useSuspenseQuery(userCrmQuery);
  const [selected,setSelected]=useState<string|null>(null);
  const lead=data.leads.find(l=>l.id===selected);
  return <UserWorkspace><LeadsBoard leads={data.leads} stages={data.stages} sources={data.sources} onOpen={setSelected}/>{lead && <LeadDetails key={lead.id} lead={lead} data={data} close={()=>setSelected(null)}/>}</UserWorkspace>;
}
