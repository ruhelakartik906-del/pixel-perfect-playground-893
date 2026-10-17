import { createFileRoute } from '@tanstack/react-router';
import { BusinessSettings } from '@/components/admin/BusinessSettings';
import { businessSettingsQuery } from '@/lib/settings-data';
import { adminHead } from '@/lib/admin-head';
export const Route = createFileRoute('/_authenticated/admin/settings/business-settings')({
  head: () => adminHead('Business Settings', 'Manage Routiva business details, currency, tax preferences and invoice defaults.'),
  loader: ({ context }) => context.queryClient.ensureQueryData(businessSettingsQuery),
  component: BusinessSettings,
});