import type { AccountStatus } from '@/lib/account-status';

export type AuthDestination = '/admin/dashboard' | '/dashboard' | '/restricted' | '/pending-approval';

export function authDestination(status: AccountStatus | null | undefined, roles: readonly string[]): AuthDestination {
  if (status === 'blocked') return '/restricted';
  if (status !== 'active') return '/pending-approval';
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.some(role => ['employee', 'manager', 'client'].includes(role))) return '/dashboard';
  return '/pending-approval';
}

const userPaths = ['/dashboard', '/my-leads', '/my-work-table', '/deals', '/tasks', '/follow-ups', '/calendar', '/team-chat', '/whatsapp/chats', '/whatsapp/templates', '/proposals', '/invoices', '/my-reports', '/support', '/settings', '/my-hr'];

export function loginDestination(destination: AuthDestination, requested: string | null): string {
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') || /[\\\s\u0000-\u001f]/.test(requested)) return destination;
  const url = new URL(requested, 'https://routiva.invalid');
  if (url.origin !== 'https://routiva.invalid') return destination;
  if (destination === '/admin/dashboard' && url.pathname.startsWith('/admin/') && url.pathname !== '/admin/login') return url.pathname + url.search + url.hash;
  if (destination === '/dashboard' && userPaths.includes(url.pathname)) return url.pathname + url.search + url.hash;
  return destination;
}