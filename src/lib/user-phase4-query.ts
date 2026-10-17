import { queryOptions } from '@tanstack/react-query';
import { loadCommercial,loadMyAccount } from './user-phase4.functions';
export const commercialQuery=queryOptions({queryKey:['user-commercial'],queryFn:()=>loadCommercial()});
export const myAccountQuery=queryOptions({queryKey:['my-account'],queryFn:()=>loadMyAccount(),staleTime:30000});
