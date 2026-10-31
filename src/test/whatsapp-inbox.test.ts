import {describe,it,expect} from 'vitest';
import {withinCustomerWindow,aiMayReply,inboxSendSchema} from '@/lib/whatsapp-inbox';
describe('WhatsApp operational rules',()=>{
 it('24 hour boundary requires a template',()=>{const now=Date.parse('2026-10-31T12:00:00Z');expect(withinCustomerWindow('2026-10-30T12:00:00Z',now)).toBe(false);expect(withinCustomerWindow('2026-10-30T12:00:01Z',now)).toBe(true);});
 it('no inbound message means no free-form window',()=>expect(withinCustomerWindow(null)).toBe(false));
 it('human assignment stops AI',()=>expect(aiMayReply({assigned_to:'human',human_takeover:false,inbox_status:'open'},true)).toBe(false));
 it('takeover stops AI',()=>expect(aiMayReply({assigned_to:null,human_takeover:true,inbox_status:'open'},true)).toBe(false));
 it('disabled AI never replies',()=>expect(aiMayReply({assigned_to:null,human_takeover:false,inbox_status:'open'},false)).toBe(false));
 it('template sends require a template selection',()=>expect(inboxSendSchema.safeParse({id:'11111111-1111-4111-8111-111111111111',client_id:'22222222-2222-4222-8222-222222222222',body:'',type:'template'}).success).toBe(false));
});