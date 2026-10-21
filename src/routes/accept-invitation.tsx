import { createFileRoute } from '@tanstack/react-router';
import { AuthCard } from '@/components/auth/AuthCard';
import { InvitationPasswordForm } from '@/components/auth/AuthForms';

export const Route = createFileRoute('/accept-invitation')({
  head: () => ({ meta: [
    { title: 'Accept Employee Invitation — Routiva CRM' },
    { name: 'description', content: 'Securely set your password and accept your Routiva CRM employee invitation.' },
    { property: 'og:title', content: 'Accept Employee Invitation — Routiva CRM' },
    { property: 'og:description', content: 'Securely accept your Routiva CRM employee invitation.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: () => <AuthCard compact title="Accept invitation" desc="Set your password to join Routiva CRM."><InvitationPasswordForm verifySession /></AuthCard>,
});