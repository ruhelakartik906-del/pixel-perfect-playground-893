import { describe, expect, it } from 'vitest';
import { managedSourceSchema, selectManagedSource, type ManagedSource } from '@/lib/make-management';
const base: ManagedSource = { id: '00000000-0000-4000-8000-000000000001', name: 'Test', platform: 'Facebook', company_id: '00000000-0000-4000-8000-000000000002', account_id: '1', page_id: '2', form_id: '3', campaign_id: '', ad_id: '', rule_id: null, active: true, archived: false, created_at: '' };
describe('managed Make source rules', () => {
  it('accepts optional campaign and ad mappings', () => { const { archived, created_at, ...source } = base; expect(managedSourceSchema.safeParse(source).success).toBe(true); });
  it.each(['Facebook','Instagram','Website'])('supports %s sources', platform => { const { archived, created_at, ...source } = base; expect(managedSourceSchema.safeParse({ ...source, platform }).success).toBe(true); });
  it('does not authorize another Page or Form', () => { expect(selectManagedSource([base], { page_id: '9', form_id: '3' })).toBeUndefined(); });
  it('uses a more specific ad mapping', () => { const specific = { ...base, id: 'specific', campaign_id: '4', ad_id: '5' }; expect(selectManagedSource([base, specific], { page_id:'2',form_id:'3',campaign_id:'4',ad_id:'5' })?.id).toBe('specific'); });
  it('disabled specific mapping cannot fall back to a broad active source', () => { expect(selectManagedSource([base, { ...base, campaign_id: '4', active: false }], { page_id:'2',form_id:'3',campaign_id:'4' })).toBeUndefined(); });
  it('archived mapping cannot be authorized', () => { expect(selectManagedSource([{ ...base, archived: true }], { page_id:'2',form_id:'3' })).toBeUndefined(); });
  it('ambiguous source mappings fail closed', () => { expect(selectManagedSource([base, { ...base, id:'another' }], { page_id:'2',form_id:'3' })).toBeUndefined(); });
});