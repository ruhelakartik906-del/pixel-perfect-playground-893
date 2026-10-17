import { queryOptions } from '@tanstack/react-query';
import { getAdminAccount, getBusinessSettings } from './settings.functions';
export const accountSettingsQuery = queryOptions({ queryKey: ['admin-account-settings'], queryFn: () => getAdminAccount() });
export const businessSettingsQuery = queryOptions({ queryKey: ['business-settings'], queryFn: () => getBusinessSettings() });