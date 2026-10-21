import { useState } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { UserWorkspace } from './UserWorkspace';
import { LeadDetails } from './LeadDetails';
import { LeadsBoard } from '@/components/pipeline/LeadsBoard';
import { AddLeadDialog } from '@/components/pipeline/AddLeadDialog';
import { loadLeadCreateAccess } from '@/lib/lead-create.functions';
import type { BoardStage } from '@/lib/leads-board';
import { userCrmQuery } from '@/lib/user-crm-query';
export function MyLeads() {
  const { data } = useSuspenseQuery(userCrmQuery);
  const [selected,setSelected]=useState<string|null>(null);
  const { data: canCreate } = useQuery({queryKey:['lead-create-access'],queryFn:()=>loadLeadCreateAccess()});
  const [addStage,setAddStage]=useState<BoardStage|null>(null);
  const lead=data.leads.find(l=>l.id===selected);
  return <UserWorkspace><LeadsBoard leads={data.leads} stages={data.stages} sources={data.sources} onOpen={setSelected} {...(canCreate?{onAdd:(stage?:BoardStage)=>setAddStage(stage||data.stages.find(s=>s.board_initial)||null)}:{})}/>{addStage&&<AddLeadDialog stage={addStage} stages={data.stages} sources={data.sources} companies={data.companies} close={()=>setAddStage(null)}/>}{lead && <LeadDetails key={lead.id} lead={lead} data={data} close={()=>setSelected(null)}/>}</UserWorkspace>;
}
