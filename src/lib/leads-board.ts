import { z } from 'zod';
import { localDay } from '@/lib/crm-work';
export type BoardStage = { id: string; name: string; board_label?: string | null; color: string; position: number; pipeline_id: string; is_active: boolean; board_initial?: boolean; board_closed?: boolean };
export const stageLabel = (s: BoardStage) => s.board_label || s.name;
export function boardStageId(lead: {stage_id: string | null; status: string; pipeline_id: string | null}, stages: BoardStage[]) {
  const own = stages.filter(s => s.pipeline_id === lead.pipeline_id);
  if (['won','lost'].includes(lead.status)) return own.find(s => s.board_closed)?.id ?? lead.stage_id;
  return lead.stage_id || own.find(s => s.board_initial)?.id || null;
}
export function canMoveStatus(stages: BoardStage[], index: number, delta: -1 | 1) {
  const item = stages[index], target = stages[index + delta];
  return !!item && !!target && !item.board_initial && !target.board_initial;
}
export function boardDateMatches(iso: string, from: string, to: string) {
  const day = localDay(new Date(iso)); return (!from || day >= from) && (!to || day <= to);
}
export const boardMoveSchema = z.object({id:z.string().uuid(), updated_at:z.string().datetime({offset:true}), stage_id:z.string().uuid(), outcome:z.enum(['won','lost']).nullable().default(null)}).strict();
export const statusActionSchema = z.discriminatedUnion('action',[
  z.object({action:z.literal('create'),pipeline_id:z.string().uuid(),name:z.string().trim().min(1).max(80),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict(),
  z.object({action:z.literal('edit'),pipeline_id:z.string().uuid(),id:z.string().uuid(),name:z.string().trim().min(1).max(80),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict(),
  z.object({action:z.literal('delete'),pipeline_id:z.string().uuid(),id:z.string().uuid()}).strict(),
  z.object({action:z.literal('reorder'),pipeline_id:z.string().uuid(),ids:z.array(z.string().uuid()).min(1)}).strict(),
]);
export const leadCacheKeys = [['admin-leads'],['user-crm'],['lead-status'],['crm-setup'],['admin-pipeline-preview']];