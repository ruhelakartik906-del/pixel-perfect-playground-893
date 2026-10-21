import { useState } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { UserWorkspace } from './UserWorkspace';
import { LeadDetails } from './LeadDetails';
import { LeadsBoard } from '@/components/pipeline/LeadsBoard';
import { AddLeadDialog } from '@/components/pipeline/AddLeadDialog';
import { useServerFn } from '@tanstack/react-start';
import { deleteUserBoardLead } from '@/lib/leads-board.functions';
import { loadLeadCreateAccess } from '@/lib/lead-create.functions';
import type { BoardStage } from '@/lib/leads-board';
import { userCrmQuery } from '@/lib/user-crm-query';
export function MyLeads() {
  const { data } = useSuspenseQuery(userCrmQuery);
  const [selected,setSelected]=useState<string|null>(null);
  const { data: canCreate } = useQuery({queryKey:['lead-create-access'],queryFn:()=>loadLeadCreateAccess()});
  const [addStage,setAddStage]=useState<BoardStage|null>(null);
  const remove=useServerFn(deleteUserBoardLead);
  const [companyId,setCompanyId]=useState(data.companies[0]?.id||'');
  const stages=data.companyStages.find(c=>c.company_id===companyId)?.stages||data.personalStages;
  const manageable=canCreate&&data.allowed;
  const lead=data.leads.find(l=>l.id===selected);
  const details=lead ? <LeadDetails key={lead.id} lead={lead} data={{...data,stages}} close={()=>setSelected(null)}/> : null;
  return <UserWorkspace><LeadsBoard key={companyId} leads={data.leads.filter(l=>companyId ? l.company_id===companyId && !l.private_owner_id : l.company_id===null || l.private_owner_id===data.userId)} stages={stages} sources={data.sources} onOpen={setSelected} actions={data.companies.length>1 || (data.companies.length>0 && data.leads.some(l=>l.private_owner_id===data.userId))?<select aria-label="Board company" className="inp" value={companyId} onChange={e=>{setCompanyId(e.target.value);setSelected(null);setAddStage(null);}}><option value="">Personal workspace</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:undefined} {...(manageable?{onDelete:async(ids:string[])=>{for(const id of ids){const l=data.leads.find(l=>l.id===id);if(l)await remove({data:{id:l.id,updated_at:l.updated_at}});}}}:{})} {...(manageable?{onAdd:(stage?:BoardStage)=>setAddStage(stage||stages.find(s=>s.is_default)||stages.find(s=>s.board_initial)||null)}:{})}/>{addStage&&<AddLeadDialog stage={addStage} stages={stages} sources={data.sources} companies={data.companies} companyId={companyId} close={()=>setAddStage(null)}/>}{details}</UserWorkspace>;
}
