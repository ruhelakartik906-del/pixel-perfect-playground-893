import { createFileRoute } from '@tanstack/react-router';
import { SupportPage, supportQuery } from '@/components/support/SupportPage';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';
export const Route = createFileRoute('/_authenticated/support')({
  head: () => ({ meta: [ { title: 'My Support Tickets — Routiva CRM' }, { name: 'description', content: 'Your private support tickets and conversations with Routiva Support.' }, { property: 'og:title', content: 'My Support Tickets — Routiva CRM' }, { property: 'og:description', content: 'Your private support tickets and conversations with Routiva Support.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' } ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(supportQuery(false)),
  component: UserSupport,
});
function UserSupport() { return <UserWorkspace support><SupportPage /></UserWorkspace>; }
