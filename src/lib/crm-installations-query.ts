import { queryOptions } from '@tanstack/react-query';
import { listCrmInstallations } from './crm-installations.functions';
export const installationsQuery = queryOptions({ queryKey: ['crm-installations'], queryFn: () => listCrmInstallations(), staleTime: 15000 });