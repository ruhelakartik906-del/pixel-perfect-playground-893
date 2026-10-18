import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { z } from "zod";

import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { resolveAuthAccess } from "@/lib/auth-access.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — Routiva CRM" },
      { name: "description", content: "Sign in to the Routiva CRM management dashboard." },
      { property: "og:title", content: "Admin Login — Routiva CRM" },
      { property: "og:description", content: "Sign in to the Routiva CRM management dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

const schema = z.object({
  email: z.string().trim().min(1, "Enter your admin email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

function AdminLogin() {
  const navigate = useNavigate();
  const resolveAccess = useServerFn(resolveAuthAccess);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string | undefined; password?: string | undefined; form?: string | undefined }>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      setLoading(false);
      setErrors({ form: "Invalid email or password." });
      return;
    }
    try {
      const access = await resolveAccess();
      await navigate({ to: access.destination, replace: true });
    } catch { setErrors({ form: "Signed in, but account access could not be verified. Please try again." }); }
    finally { setLoading(false); }
  };

  return (
    <section className="grid min-h-screen place-items-center bg-hero px-5 py-16">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-float sm:p-8">
        <Logo />
        <h1 className="mt-6 text-3xl font-extrabold text-foreground">Admin Login</h1>
        <p className="mt-2 text-muted-foreground">Sign in to your management dashboard</p>
        <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
          {errors.form && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.form}</p>}
          <div>
            <Label htmlFor="admin-email" className="text-sm font-semibold">Admin Email</Label>
            <Input id="admin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} className="mt-1.5 h-11 rounded-xl" />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>
          <div>
            <Label htmlFor="admin-password" className="text-sm font-semibold">Password</Label>
            <div className="relative mt-1.5">
              <Input id="admin-password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} className="h-11 rounded-xl pr-11" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9 rounded-full" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>
          <Button type="submit" variant="hero" size="xl" disabled={loading}>
            {loading ? <><Loader2 className="animate-spin" /> Signing in…</> : <><LockKeyhole /> Sign In</>}
          </Button>
        </form>
      </div>
    </section>
  );
}
