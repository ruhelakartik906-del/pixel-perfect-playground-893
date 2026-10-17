import { createFileRoute } from '@tanstack/react-router';
import { AdminAccountSettings } from '@/components/admin/AdminAccountSettings';
import { accountSettingsQuery } from '@/lib/settings-data';
import { adminHead } from '@/lib/admin-head';
export const Route = createFileRoute('/_authenticated/admin/settings/admin-account-security')({
  head: () => adminHead('Admin Account & Security', 'Manage your Routiva Super Admin profile and secure login credentials.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(accountSettingsQuery),
  component: AdminAccountSettings,
});