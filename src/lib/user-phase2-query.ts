import { queryOptions } from '@tanstack/react-query';
import { loadUserPhase2 } from './user-phase2.functions';
export const phase2Query=queryOptions({queryKey:['user-phase2'],queryFn:()=>loadUserPhase2()});
