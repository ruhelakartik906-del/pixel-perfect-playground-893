import { useRef,useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Check,Trash2,Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { EditableGrid,GridCell,GridSettings,gridOptionTone } from './EditableGrid';
import { workColumns,type GridColumn } from '@/lib/work-grid';
import { localDay,scheduleInput,scheduleUtc } from '@/lib/crm-work';
import { userTaskSchema,validateValues } from '@/lib/user-phase2';
import { gridAction,saveSpreadsheetCell,commitSpreadsheet } from '@/lib/spreadsheet.functions';
import { saveUserWork } from '@/lib/user-phase2.functions';
import type { ReactNode } from 'react';

type Work={id:string;kind:string;title:string;notes:string;priority:string;status:string;start_date:string|null;due_date:string|null;scheduled_at:string|null;interaction_type:string|null;assigned_to:string;created_by:string;company_id:string|null;lead_id:string|null;updated_at:string;customer_name?:string;customer_phone?:string};
type Settings={kind:string;settings:unknown;custom_values:unknown;drafts:unknown};
type Person={id:string;full_name:string;account_status:string};
export function WorkSpreadsheet({kind,admin=false,userId,rows,settings,people=[],leads=[],companies=[],eligible=[],roles=[],actions}:{kind:'task'|'follow_up';admin?:boolean;userId:string;rows:Work[];settings:Settings[];people?:Person[];leads?:{id:string;customer_name:string;phone:string;company_id:string|null}[];companies?:{id:string;name:string}[];eligible?:{user_id:string;company_id:string}[];roles?:{user_id:string;role:string}[];actions:(w:Work)=>ReactNode}){
 const page=admin?(kind==='task'?'admin_task':'admin_follow_up'):kind;
 const entry=settings.find(s=>s.kind===page),qc=useQueryClient(),grid=useServerFn(gridAction),cellSave=useServerFn(saveSpreadsheetCell),commit=useServerFn(commitSpreadsheet);
 const [open,setOpen]=useState(false),[userSearch,setUserSearch]=useState('');
 const queue=useRef(Promise.resolve()),[drafts,setDrafts]=useState<Record<string,Record<string,unknown>>>(()=>(entry?.drafts??{}) as Record<string,Record<string,unknown>>);
 const draftsRef=useRef(drafts);draftsRef.current=drafts;
 const [localColumns,setLocalColumns]=useState<GridColumn[]|null>(null);
 const initial=workColumns(kind,entry?.settings);
 const adminFields:[string,string][]=kind==='task'?[['title','Task Name'],['notes','Description'],['assigned_to','Assigned To'],['assigned_id','Assigned User ID'],['priority','Priority'],['status','Status'],['start_date','Start Date'],['due_date','Due Date'],['created_by','Created By'],['updated_at','Updated At'],['actions','Actions']]:[['title','Follow-up Title'],['customer','Customer Name'],['phone','Phone'],['created_by','Created By'],['creator_id','Creator User ID'],['assigned_to','Assigned To'],['interaction_type','Interaction Type'],['priority','Priority'],['status','Status'],['scheduled_date','Scheduled Date'],['scheduled_time','Scheduled Time'],['notes','Notes'],['updated_at','Updated At'],['actions','Actions']];
 const columns:GridColumn[]=(localColumns??(admin&&!((entry?.settings as {columns?:unknown})?.columns)?adminFields.map(([id,name])=>({id,name,width:180,type:'text' as const,custom:false,hidden:false,options:[]})):initial)).map(c=>c.id==='status'&&!c.options.length?{...c,options:(kind==='task'?['not_started','in_progress','completed']:['scheduled','completed','skipped']).map(id=>({id,name:id.replaceAll('_',' '),color:'blue' as const}))}:c);
 const shown=columns.filter(c=>!c.hidden),custom=(entry?.custom_values??{}) as Record<string,Record<string,unknown>>;
 const refresh=()=>Promise.all([qc.invalidateQueries({queryKey:['user-phase2']}),qc.invalidateQueries({queryKey:['crm-work']})]);
 const serialized=<T,>(fn:()=>Promise<T>):Promise<T>=>{const result=queue.current.then(fn);queue.current=result.then(()=>{},()=>{});return result;};
 const persistColumns=(next:GridColumn[])=>serialized(async()=>{await grid({data:{page,action:'columns',value:{columns:next}}});setLocalColumns(next);await refresh();});
 const addColumn=()=>{const next=[...columns,{id:crypto.randomUUID(),name:'New column',type:'text' as const,width:180,custom:true,hidden:false,options:[]}];setLocalColumns(next);void persistColumns(next).catch(e=>toast.error(e.message));};
 const addRow=()=>{const id=crypto.randomUUID(),value={origin:'personal',company_id:'',assigned_to:admin?'':userId,title:'',notes:'',customer_name:'',customer_phone:'',priority:'medium',status:kind==='task'?'not_started':'scheduled',start_date:localDay(),due_date:localDay(),scheduled_date:localDay(),scheduled_time:'10:00',interaction_type:'call'};setDrafts(d=>({...d,[id]:value}));void serialized(async()=>{await grid({data:{page,action:'add',id,value}});}).catch(e=>toast.error(e.message));};
 const deleteDraft=(id:string)=>serialized(async()=>{await grid({data:{page,action:'delete_draft',id}});setDrafts(d=>{const next={...d};delete next[id];return next;});});
 const commitDraft=(id:string)=>serialized(async()=>{const d=draftsRef.current[id];if(!d)return;if(admin&&!d['assigned_to'])throw new Error('Select an eligible active user');const origin=d['company_id']?'company':'personal';const parsed=userTaskSchema.parse({...d,origin,kind,lead_id:d['lead_id']||null,deal_id:null,checklist:[],start_date:kind==='task'?d['start_date']:null,due_date:kind==='task'?d['due_date']:null,scheduled_at:kind==='follow_up'?scheduleUtc(`${d['scheduled_date']}T${d['scheduled_time']}`):null,interaction_type:kind==='follow_up'?d['interaction_type']:null});await commit({data:{page,draft:id,payload:parsed}});setDrafts(all=>{const next={...all};delete next[id];return next;});await refresh();toast.success(admin?'Assignment saved':'Record saved');});
 const name=(id:string)=>people.find(p=>p.id===id)?.full_name||id;
 const render=(w:Work|undefined,id:string,c:GridColumn)=>{
  const draft=drafts[id],isDraft=!w,key=c.id,origin=w?.company_id?'company':'personal',related=leads.find(l=>l.id===w?.lead_id);
  const field=key==='customer'?'customer_name':key==='phone'?'customer_phone':key;
  const value=isDraft?draft?.[field]:c.custom?custom[id]?.[key]:key==='customer'?related?.customer_name??w.customer_name:key==='phone'?related?.phone??w.customer_phone:key==='scheduled_date'?w.scheduled_at?scheduleInput(w.scheduled_at).slice(0,10):'':key==='scheduled_time'?w.scheduled_at?scheduleInput(w.scheduled_at).slice(11,16):'':(w as unknown as Record<string,unknown>)[key];
  const onSave=(v:unknown)=>serialized(async()=>{
   if(c.custom){const err=validateValues([c],{[key]:v});if(err)throw new Error(err);}
   if(isDraft){await grid({data:{page,action:'draft_cell',id,field:c.custom?key:field,value:v}});const next={...draftsRef.current,[id]:{...draftsRef.current[id],[c.custom?key:field]:v}};draftsRef.current=next;setDrafts(next);}
   else if(c.custom){await grid({data:{page,action:'custom',id,field:key,value:v}});await refresh();}
   else {let saveField=field,saveValue=v;if(key==='scheduled_date'||key==='scheduled_time'){const scheduled=w.scheduled_at?scheduleInput(w.scheduled_at):`${localDay()}T10:00`;saveField='scheduled_at';saveValue=scheduleUtc(key==='scheduled_date'?`${v}T${scheduled.slice(11,16)}`:`${scheduled.slice(0,10)}T${v}`);}await cellSave({data:{id,origin,field:saveField,value:saveValue}});await refresh();}
  });
  if(key==='actions')return isDraft?<div className="flex gap-1"><Button variant="outline" size="sm" aria-label={`Commit draft ${id}`} onClick={()=>void commitDraft(id).catch(e=>toast.error(e.message))}><Check/>{admin?'Assign':'Save'}</Button><Button variant="ghost" size="icon" aria-label={`Delete draft ${id}`} onClick={()=>{if(window.confirm('Delete draft?'))void deleteDraft(id).catch(e=>toast.error(e.message));}}><Trash2/></Button></div>:actions(w);
  if(['created_by','assigned_by','creator_id','assigned_id','updated_at'].includes(key))return <span className="block truncate px-3" title={String(value??'')}>{isDraft?'Draft':key==='created_by'||key==='assigned_by'?name(w.created_by):key==='creator_id'?w.created_by:key==='assigned_id'?w.assigned_to:String(value??'')}</span>;
  if(key==='assigned_to'&&!admin)return <span className="px-3">{isDraft?name(userId):name(w.assigned_to)}</span>;
  if((key==='customer'||key==='phone')&&!isDraft&&origin==='company')return <span className="px-3">{String(value??'—')}</span>;
  if(key==='assigned_to'&&admin)return <select aria-label={`Assigned To ${id}`} className={`h-10 w-full bg-transparent px-3 ${gridOptionTone(c.options.find(o=>o.id===value)?.color??'gray')}`} value={String(value??'')} onChange={e=>void onSave(e.target.value).catch(e=>toast.error(e.message))}><option value="">Select user</option>{people.filter(p=>p.account_status==='active'&&(!draft?.['company_id']||eligible.some(m=>m.company_id===draft['company_id']&&m.user_id===p.id))&&`${p.full_name} ${p.id}`.toLowerCase().includes(userSearch.toLowerCase())).map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.id} · {roles.filter(r=>r.user_id===p.id).map(r=>r.role).join(', ')} · {companies.filter(co=>eligible.some(m=>m.user_id===p.id&&m.company_id===co.id)).map(c=>c.name).join(', ')||'Standalone'} · Active</option>)}</select>;
  const choices=c.custom?c.options:key==='status'?c.options:key==='priority'?['low','medium','high','highest'].map(id=>({id,name:id})):key==='interaction_type'?['call','whatsapp','email','meeting'].map(id=>({id,name:id})):null;
  if(choices)return <select aria-label={`${c.name} ${id}`} className={`h-10 w-full bg-transparent px-3 ${gridOptionTone(c.options.find(o=>o.id===value)?.color??'gray')}`} value={String(value??'')} onChange={e=>void onSave(e.target.value).catch(e=>toast.error(e.message))}><option value="">—</option>{choices.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select>;
  if(c.type==='checkbox')return <Checkbox aria-label={`${c.name} ${id}`} checked={value===true} onCheckedChange={v=>void onSave(v===true).catch(e=>toast.error(e.message))}/>;
  return <GridCell label={`${c.name} ${id}`} value={value} type={key==='scheduled_time'?'time':key.endsWith('_date')?'date':c.type} onSave={onSave}/>;
 };
 return <><div className="mb-2 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setOpen(true)}><Settings2/>Columns</Button>{admin&&<Input aria-label="Search registered users" placeholder="Search registered users…" className="w-60" value={userSearch} onChange={e=>setUserSearch(e.target.value)}/>}</div><EditableGrid columns={shown} empty={!rows.length&&!Object.keys(drafts).length} onAdd={addRow} onAddColumn={addColumn} onRename={(id,name)=>persistColumns(columns.map(c=>c.id===id?{...c,name}:c))} onResize={(id,width)=>void persistColumns(columns.map(c=>c.id===id?{...c,width}:c)).catch(e=>toast.error(e.message))}>{rows.map(w=><tr key={w.id}>{shown.map(c=><td key={c.id}>{render(w,w.id,c)}</td>)}</tr>)}{Object.keys(drafts).map(id=><tr key={id}>{shown.map(c=><td key={c.id}>{render(undefined,id,c)}</td>)}</tr>)}</EditableGrid>{open&&<GridSettings columns={columns} onClose={()=>setOpen(false)} onSave={persistColumns}/>}</>;
}