import {describe,it,expect} from 'vitest';
import {boardStageId,canMoveStatus,boardDateMatches,boardMoveSchema,statusActionSchema,type BoardStage} from '@/lib/leads-board';
const stages:BoardStage[]=[{id:'a',name:'New',board_label:'All Leads',color:'',pipeline_id:'p',is_active:true,position:0,board_initial:true},{id:'b',name:'Interested',color:'',pipeline_id:'p',is_active:true,position:1},{id:'c',name:'Deal Closed',color:'',pipeline_id:'p',is_active:true,position:2,board_closed:true}];
describe('Canonical lead board rules',()=>{
 it('keeps Won within Deal Closed',()=>expect(boardStageId({pipeline_id:'p',stage_id:'b',status:'won'},stages)).toBe('c'));
 it('keeps Lost within the same Deal Closed column',()=>expect(boardStageId({pipeline_id:'p',stage_id:'b',status:'lost'},stages)).toBe('c'));
 it('places unstaged open leads in the initial stage',()=>expect(boardStageId({pipeline_id:'p',stage_id:null,status:'open'},stages)).toBe('a'));
 it('does not borrow another pipeline’s initial stage',()=>expect(boardStageId({pipeline_id:'other',stage_id:null,status:'open'},stages)).toBeNull());
 it('protects the initial stage from being moved',()=>expect(canMoveStatus(stages,0,1)).toBe(false));
 it('prevents another stage moving ahead of the initial',()=>expect(canMoveStatus(stages,1,-1)).toBe(false));
 it('allows later custom stage ordering',()=>expect(canMoveStatus(stages,1,1)).toBe(true));
 it('filters date bounds in Asia/Kolkata',()=>{expect(boardDateMatches('2026-10-20T19:00:00Z','2026-10-21','2026-10-21')).toBe(true);expect(boardDateMatches('2026-10-20T18:00:00Z','2026-10-21','2026-10-21')).toBe(false);});
 it('rejects fabricated outcomes',()=>expect(boardMoveSchema.safeParse({id:'11111111-1111-4111-8111-111111111111',updated_at:'2026-10-21T00:00:00Z',stage_id:'22222222-2222-4222-8222-222222222222',outcome:'converted'}).success).toBe(false));
 it('requires valid stage color',()=>expect(statusActionSchema.safeParse({action:'create',pipeline_id:'11111111-1111-4111-8111-111111111111',name:'Custom',color:'not-a-color'}).success).toBe(false));
});