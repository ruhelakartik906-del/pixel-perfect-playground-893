import { Link, type ErrorComponentProps } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserWorkspace } from '@/components/workspace/UserWorkspace';

// Shown when a company-data page is opened by an account without employee workspace access yet.
export function WorkspaceAccessError({ error }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : "";
  const access = /workspace access|CRM access|Unauthorized/i.test(message);
  return (
    <UserWorkspace>
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border bg-card p-8 text-center shadow-card">
        <ShieldCheck className="mx-auto size-12 text-admin-blue" />
        <h1 className="mt-4 text-2xl font-bold">{access ? 'Workspace access not enabled yet' : 'This page could not load'}</h1>
        <p className="mt-2 text-muted-foreground">
          {access
            ? 'Your account is active, but an administrator has not yet linked you to a company as an employee. Your personal dashboard is still available.'
            : message || 'Please try again.'}
        </p>
        <Button asChild className="mt-6"><Link to="/dashboard">Go to my dashboard</Link></Button>
      </div>
    </UserWorkspace>
  );
}
