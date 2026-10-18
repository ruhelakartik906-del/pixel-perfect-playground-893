import { z } from 'zod';
import { columnSchema } from './user-phase2';
export const gridColumnSchema=columnSchema.extend({hidden:z.boolean().default(false),width:z.number().min(100).max(700).default(180),custom:z.boolean().default(false)});
export type GridColumn=z.infer<typeof gridColumnSchema>;
export const gridSettingsSchema=z.object({columns:z.array(gridColumnSchema)});
export function defaultWorkColumns(kind:'task'|'follow_up'):GridColumn[]{
 const fields=kind==='task'?[['title','Task Name'],['customer','Related Customer'],['notes','Description'],['priority','Priority'],['status','Status'],['start_date','Start Date'],['due_date','Due Date'],['created_by','Created By'],['assigned_by','Assigned By'],['actions','Actions']]:[['customer','Customer Name'],['phone','Phone'],['title','Follow-up Title'],['interaction_type','Interaction Type'],['priority','Priority'],['status','Status'],['scheduled_date','Scheduled Date'],['scheduled_time','Scheduled Time'],['notes','Notes'],['created_by','Created By'],['actions','Actions']];
 return fields.map(([id,name])=>gridColumnSchema.parse({id,name,type:'text',width:id==='notes'?260:180}));
}
export function workColumns(kind:'task'|'follow_up',raw:unknown){const p=gridSettingsSchema.safeParse(raw);return p.success?p.data.columns:defaultWorkColumns(kind);}