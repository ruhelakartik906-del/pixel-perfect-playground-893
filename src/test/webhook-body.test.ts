import {describe,it,expect} from 'vitest';
import {boundedBody} from '@/lib/request-body.server';
describe('signed webhook input boundaries',()=>{
 it('accepts a body within the configured byte limit',async()=>expect(await boundedBody(new Request('https://example.test',{method:'POST',body:'hello'}),5)).toBe('hello'));
 it('rejects bytes beyond the bound before buffering completion',async()=>{await expect(boundedBody(new Request('https://example.test',{method:'POST',body:'123456'}),5)).rejects.toThrow('Body too large');});
 it('counts multibyte text by bytes rather than characters',async()=>{await expect(boundedBody(new Request('https://example.test',{method:'POST',body:'éé'}),3)).rejects.toThrow('Body too large');});
});