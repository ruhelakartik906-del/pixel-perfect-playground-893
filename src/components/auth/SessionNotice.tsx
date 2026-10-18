import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { resolveAuthAccess } from '@/lib/auth-access.functions';

export function useExistingAccount() {
  const resolve = useServerFn(resolveAuthAccess);
  return useQuery({
    queryKey: ['auth-access'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      return resolve();
    },
    retry: false,
  });
}

export function SessionNotice({ account }: { account: ReturnType<typeof useExistingAccount> }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const switchAccount = async () => {
    setBusy(true);
    await queryClient.cancelQueries();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Could not sign out. Please try again.');
      setBusy(false);
      return;
    }
    await supabase.removeAllChannels();
    queryClient.clear();
    await account.refetch();
    setBusy(false);
  };
  if (account.isError) return <p role="alert" className="text-sm text-destructive">Your existing account access could not be checked. Please refresh and try again.</p>;
  if (!account.data) return null;
  const admin = account.data.destination === '/admin/dashboard';
  return <div className="grid gap-3 rounded-xl border bg-secondary p-4">
    <p className="text-sm text-foreground">{admin ? 'You are already signed in with a Super Admin account.' : 'You are already signed in with an existing account.'}</p>
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="hero"><Link to={account.data.destination}>{admin ? 'Open Admin Panel' : 'Continue to my account'}</Link></Button>
      <Button type="button" variant="outline" disabled={busy} onClick={switchAccount}>Use a different account</Button>
    </div>
  </div>;
}