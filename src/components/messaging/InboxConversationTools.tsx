import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Hand,StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inboxAction,inboxNotes } from '@/lib/whatsapp-inbox.functions';
import { suggestWhatsAppReply } from '@/lib/whatsapp-ai.functions';
export function InboxConversationTools({id,status,takeover}:{id:string;status:string;takeover:boolean}){
  const action=useServerFn(inboxAction),suggest=useServerFn(suggestWhatsAppReply),qc=useQueryClient();const [note,setNote]=useState(''),[suggestion,setSuggestion]=useState(''),[thinking,setThinking]=useState(false);
  const notes=useQuery({queryKey:['wa-inbox-notes',id],queryFn:()=>inboxNotes({data:{id}})});
  const run=async(kind:'status'|'note'|'takeover',payload:Record<string,string>)=>{try{await action({data:{id,action:kind,payload}});await qc.invalidateQueries({queryKey:['user-whatsapp']});await qc.invalidateQueries({queryKey:['wa-inbox-notes',id]});setNote('');}catch(e){toast.error(e instanceof Error?e.message:'Action failed');}};
  return <section className="mb-3 space-y-3 border-y py-3"><div className="flex flex-wrap items-center gap-2"><select aria-label="Conversation status" className="rounded-md border bg-card px-3 py-2" value={status} onChange={e=>run('status',{status:e.target.value})}>{['open','pending','resolved'].map(s=><option key={s} value={s}>{s}</option>)}</select><Button variant="outline" onClick={()=>run('takeover',{})} disabled={takeover}><Hand className="size-4" />{takeover?'Human takeover active':'Take over'}</Button><Button variant="outline" disabled={thinking} onClick={async()=>{setThinking(true);try{setSuggestion((await suggest({data:{id}})).text);}catch(e){toast.error(e instanceof Error?e.message:'AI suggestion failed');}finally{setThinking(false);}}}>{thinking?'Drafting…':'Suggest reply'}</Button></div>{suggestion&&<div className="rounded-lg border bg-card p-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">AI suggestion · not sent</p><p className="whitespace-pre-wrap text-sm">{suggestion}</p></div>}<form className="flex gap-2" onSubmit={e=>{e.preventDefault();void run('note',{body:note});}}><Input aria-label="Internal note" placeholder="Internal note" value={note} onChange={e=>setNote(e.target.value)} maxLength={4000}/><Button type="submit" variant="outline" disabled={!note.trim()}><StickyNote className="size-4" />Save note</Button></form>{notes.error&&<p className="text-sm text-destructive">{notes.error.message}</p>}{notes.data?.map(n=><p key={n.id} className="text-sm text-muted-foreground">{n.body}</p>)}</section>;
}