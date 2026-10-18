import { describe,it,expect } from 'vitest';
import { defaultWorkColumns,workColumns,gridSettingsSchema } from '@/lib/work-grid';
import { workInTab } from '@/lib/crm-work';
describe('Private work grid rules',()=>{
 it('display renaming preserves the canonical task field',()=>{const columns=defaultWorkColumns('task');const changed=columns.map(c=>c.id==='title'?{...c,name:'My Activity'}:c);expect(workColumns('task',{columns:changed}).find(c=>c.name==='My Activity')?.id).toBe('title');});
 it('custom labels preserve completed calculations',()=>{const columns=defaultWorkColumns('follow_up').map(c=>c.id==='status'?{...c,options:[{id:'completed',name:'Done',color:'green'}]}:c);expect(gridSettingsSchema.safeParse({columns}).success).toBe(true);expect(workInTab({kind:'follow_up',status:'completed',due_date:null,scheduled_at:'2026-10-01T10:00:00Z'},'overdue',new Date('2026-10-18T10:00:00Z'))).toBe(false);});
 it('does not truncate practical custom columns',()=>{const columns=Array.from({length:250},(_,i)=>({...defaultWorkColumns('task')[0],id:`custom_${i}`,custom:true}));expect(gridSettingsSchema.parse({columns}).columns).toHaveLength(250);});
});