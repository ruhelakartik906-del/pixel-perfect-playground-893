import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, CalendarCheck, ClipboardList, Headphones, LogOut, Megaphone, PhoneCall, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
const nav = [{ label: 'Dashboard', icon: BarChart3 }, { label: 'Leads', icon: Megaphone }, { label: 'Customers', icon: Users }, { label: 'Attendance', icon: CalendarCheck }, { label: 'Reports', icon: ClipboardList }];
export function UserWorkspace({ children, support = false }: { children: ReactNode; support?: boolean }) {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const signOut = async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: '/login', replace: true }); };
  return <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[280px_1fr]">
    <aside className="bg-sidebar px-5 py-6 text-sidebar-foreground lg:min-h-screen">
      <Link to="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheck className="size-5" /></span><span className="text-xl font-bold">Routiva CRM</span></Link>
      <nav className="mt-8 grid gap-1">
        <Link to="/tasks" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold"><ClipboardList className="size-4" />My Tasks</Link>
        <Link to="/follow-ups" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold"><PhoneCall className="size-4" />My Follow-ups</Link>
        <Link to="/my-hr" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold"><CalendarCheck className="size-4" />My HR · Attendance & Leave</Link>
        {nav.map(({ label, icon: Icon }, index) => index === 0 ? <Link to="/dashboard" key={label} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${support ? 'text-sidebar-foreground/75' : 'bg-sidebar-accent text-sidebar-accent-foreground'}`}><Icon className="size-4" />{label}</Link> : <span key={label} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/75"><Icon className="size-4" />{label}</span>)}
        <Link to="/support" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${support ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75'}`}><Headphones className="size-4" />Support</Link>
      </nav>
      <Button variant="ghost" className="mt-8 w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={signOut}><LogOut /> Logout</Button>
    </aside>
    <main className="min-w-0 px-5 py-6 lg:px-8">{children}</main>
  </div>;
}
