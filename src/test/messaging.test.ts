import { describe,it,expect } from 'vitest';
import { chatText,templateDraft,editableTemplate,filledTemplate,templateVariables,unreadDirect } from '@/lib/messaging';
import { validateSupportFile } from '@/lib/support-model';
const draft={company_id:null,name:'appointment',category:'UTILITY',language:'en',header_type:'none',header:'',body:'Hi {{1}}, meeting {{2}}',footer:'',buttons:[],samples:{'1':'Riya','2':'Monday'}};
describe('Phase 3 messaging safeguards',()=>{
 it('accepts nonempty text and rejects messages over 4000 characters',()=>{expect(chatText.parse(' Hello ')).toBe('Hello');expect(chatText.safeParse(' ').success).toBe(false);expect(chatText.safeParse('a'.repeat(4001)).success).toBe(false);});
 it('counts only unread incoming direct messages for this recipient',()=>{expect(unreadDirect([{sender_id:'a',recipient_id:'me',read_at:null,group_id:null},{sender_id:'a',recipient_id:'other',read_at:null,group_id:null},{sender_id:'a',recipient_id:'me',read_at:'now',group_id:null},{sender_id:'a',recipient_id:'me',read_at:null,group_id:'g'}],'me','a')).toBe(1);});
 it('never treats approved or submitted templates as editable drafts',()=>{expect(editableTemplate({status:'draft',sync_status:'not_synced'})).toBe(true);expect(editableTemplate({status:'approved',sync_status:'synced'})).toBe(false);expect(editableTemplate({status:'draft',sync_status:'pending'})).toBe(false);});
 it('requires sequential variables',()=>{expect(templateVariables('Hi {{2}} {{1}} {{1}}')).toEqual([1,2]);expect(templateDraft.safeParse({...draft,body:'Hi {{2}}'}).success).toBe(false);});
 it('personalizes preview without sending',()=>{expect(filledTemplate(draft.body,draft.samples)).toBe('Hi Riya, meeting Monday');expect(filledTemplate('Hi {{3}}',{})).toBe('Hi {{3}}');});
 it('strips client supplied provider approval state',()=>{const parsed=templateDraft.parse({...draft,status:'approved',sync_status:'synced'});expect(parsed).not.toHaveProperty('status');expect(parsed).not.toHaveProperty('sync_status');});
 it('rejects unsafe URLs and invalid names',()=>{expect(templateDraft.safeParse({...draft,name:'Bad Name'}).success).toBe(false);expect(templateDraft.safeParse({...draft,buttons:[{type:'URL',text:'Open',value:'javascript:alert(1)'}]}).success).toBe(false);});
 it('requires real permitted attachment bytes and the 5MB maximum',()=>{expect(()=>validateSupportFile(new Uint8Array([1,2]),'image/png')).toThrow();expect(()=>validateSupportFile(new Uint8Array(5242881),'application/pdf')).toThrow();expect(()=>validateSupportFile(new Uint8Array([37,80,68,70,45]),'application/pdf')).not.toThrow();});
});
