import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, type ForgotPasswordForm, type LoginForm, type RegisterForm, type ResetPasswordForm } from "@/lib/auth-validation";
import { workspacePathForStatus } from "@/lib/account-status";

function collectErrors<T extends Record<string, unknown>>(result: z.SafeParseReturnType<T, T>) {
  const errors: Partial<Record<keyof T, string>> = {};
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const key = issue.path[0] as keyof T;
      errors[key] = issue.message;
    });
  }
  return errors;
}

async function statusPathForCurrentUser() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return "/login";
  const { data, error } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  return workspacePathForStatus(data?.account_status);
}

function PasswordInput({ id, value, onChange, autoComplete, error }: { id: string; value: string; onChange: (value: string) => void; autoComplete: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold">Password</Label>
      <div className="relative mt-1.5">
        <Input id={id} type={visible ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={!!error} className="h-11 rounded-xl pr-11" />
        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9 rounded-full" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TextField<T extends Record<string, string>>({ form, setForm, errors, name, label, type = "text", autoComplete }: { form: T; setForm: (form: T) => void; errors: Partial<Record<keyof T, string>>; name: keyof T; label: string; type?: string; autoComplete?: string }) {
  return (
    <div>
      <Label htmlFor={String(name)} className="text-sm font-semibold">{label}</Label>
      <Input id={String(name)} type={type} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} autoComplete={autoComplete} aria-invalid={!!errors[name]} className="mt-1.5 h-11 rounded-xl" />
      {errors[name] && <p className="mt-1 text-xs text-destructive">{errors[name]}</p>}
    </div>
  );
}

export function LoginForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginForm>({ email: "", password: "", remember: true });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const [loading, setLoading] = useState<"email" | "google" | "lovable" | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = loginSchema.safeParse(form);
    if (!result.success) {
      setErrors(collectErrors(result));
      return;
    }
    setErrors({});
    setLoading("email");
    const { error } = await supabase.auth.signInWithPassword({ email: result.data.email, password: result.data.password });
    if (error) {
      setLoading(null);
      toast.error("We couldn't sign you in. Check your email and password.");
      return;
    }
    try {
      navigate({ to: await statusPathForCurrentUser(), replace: true });
    } catch {
      setLoading(null);
      toast.error("Signed in, but your account status could not be loaded.");
    }
  };

  const social = async (provider: "google" | "lovable") => {
    setLoading(provider);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) {
      setLoading(null);
      toast.error("This sign-in method is not available right now.");
      return;
    }
    if (!result.redirected) navigate({ to: await statusPathForCurrentUser(), replace: true });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <TextField form={{ email: form.email }} setForm={(next) => setForm({ ...form, email: next.email })} errors={errors as Partial<Record<"email", string>>} name="email" label="Email" type="email" autoComplete="email" />
      <PasswordInput id="password" value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="current-password" error={errors.password} />
      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          <Checkbox checked={form.remember} onCheckedChange={(checked) => setForm({ ...form, remember: checked === true })} />
          Remember me
        </label>
        <Link to="/forgot-password" className="font-semibold text-primary hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" variant="hero" size="xl" disabled={loading !== null}>
        {loading === "email" ? <><Loader2 className="animate-spin" /> Signing in…</> : <><LockKeyhole /> Login</>}
      </Button>
      <div className="relative py-1"><Separator /><span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs font-semibold uppercase text-muted-foreground">or</span></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="pill" size="xl" disabled={loading !== null} onClick={() => social("google")}>{loading === "google" ? <Loader2 className="animate-spin" /> : <Mail />} Google</Button>
        <Button type="button" variant="pill" size="xl" disabled={loading !== null} onClick={() => social("lovable")}>{loading === "lovable" ? <Loader2 className="animate-spin" /> : <LockKeyhole />} Lovable</Button>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const [form, setForm] = useState<RegisterForm>({ fullName: "", companyName: "", email: "", phone: "", password: "", confirmPassword: "", terms: false });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});
  const [state, setState] = useState<"idle" | "submitting" | "sent">("idle");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = registerSchema.safeParse(form);
    if (!result.success) {
      setErrors(collectErrors(result));
      return;
    }
    setErrors({});
    setState("submitting");
    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: result.data.fullName, company_name: result.data.companyName, phone: result.data.phone },
      },
    });
    if (error) {
      setState("idle");
      toast.error(error.message || "We couldn't create your account.");
      return;
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div className="py-8 text-center">
        <Mail className="mx-auto size-12 text-primary" />
        <h2 className="mt-4 text-2xl font-bold">Check your email</h2>
        <p className="mt-2 text-muted-foreground">Confirm your email address first. After approval, your CRM access opens automatically.</p>
        <Button asChild variant="pill" size="xl" className="mt-6"><Link to="/login">Go to login</Link></Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={{ fullName: form.fullName }} setForm={(next) => setForm({ ...form, fullName: next.fullName })} errors={errors as Partial<Record<"fullName", string>>} name="fullName" label="Full name" autoComplete="name" />
        <TextField form={{ companyName: form.companyName }} setForm={(next) => setForm({ ...form, companyName: next.companyName })} errors={errors as Partial<Record<"companyName", string>>} name="companyName" label="Company" autoComplete="organization" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField form={{ email: form.email }} setForm={(next) => setForm({ ...form, email: next.email })} errors={errors as Partial<Record<"email", string>>} name="email" label="Email" type="email" autoComplete="email" />
        <TextField form={{ phone: form.phone }} setForm={(next) => setForm({ ...form, phone: next.phone })} errors={errors as Partial<Record<"phone", string>>} name="phone" label="Phone" type="tel" autoComplete="tel" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordInput id="new-password" value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="new-password" error={errors.password} />
        <PasswordInput id="confirm-password" value={form.confirmPassword} onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} autoComplete="new-password" error={errors.confirmPassword} />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <Checkbox checked={form.terms} onCheckedChange={(checked) => setForm({ ...form, terms: checked === true })} className="mt-0.5" />
          <span>I agree to the <Link to="/terms" className="font-semibold text-primary hover:underline">Terms</Link> and <Link to="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.</span>
        </label>
        {errors.terms && <p className="mt-1 text-xs text-destructive">{errors.terms}</p>}
      </div>
      <Button type="submit" variant="hero" size="xl" disabled={state === "submitting"}>{state === "submitting" ? <><Loader2 className="animate-spin" /> Creating account…</> : <><UserPlus /> Create account</>}</Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [form, setForm] = useState<ForgotPasswordForm>({ email: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ForgotPasswordForm, string>>>({});
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = forgotPasswordSchema.safeParse(form);
    if (!result.success) {
      setErrors(collectErrors(result));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) {
      toast.error("We couldn't send a reset link. Please try again.");
      return;
    }
    setSent(true);
  };
  if (sent) return <div className="py-8 text-center"><Mail className="mx-auto size-12 text-primary" /><h2 className="mt-4 text-2xl font-bold">Reset link sent</h2><p className="mt-2 text-muted-foreground">Check your email for the secure reset link.</p></div>;
  return <form onSubmit={submit} noValidate className="grid gap-4"><TextField form={form} setForm={setForm} errors={errors} name="email" label="Email" type="email" autoComplete="email" /><Button type="submit" variant="hero" size="xl" disabled={loading}>{loading ? <><Loader2 className="animate-spin" /> Sending…</> : "Send reset link"}</Button></form>;
}

export function ResetPasswordForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ResetPasswordForm>({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ResetPasswordForm, string>>>({});
  const [loading, setLoading] = useState(false);
  const recovery = useMemo(() => typeof window !== "undefined" && window.location.hash.includes("type=recovery"), []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = resetPasswordSchema.safeParse(form);
    if (!result.success) {
      setErrors(collectErrors(result));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: result.data.password });
    setLoading(false);
    if (error) {
      toast.error("We couldn't update your password. Please use a fresh reset link.");
      return;
    }
    toast.success("Password updated. Please log in again.");
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {!recovery && <p className="rounded-2xl border bg-secondary p-4 text-sm text-muted-foreground">Open the reset link from your email to set a new password.</p>}
      <PasswordInput id="reset-password" value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="new-password" error={errors.password} />
      <PasswordInput id="reset-confirm-password" value={form.confirmPassword} onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} autoComplete="new-password" error={errors.confirmPassword} />
      <Button type="submit" variant="hero" size="xl" disabled={loading || !recovery}>{loading ? <><Loader2 className="animate-spin" /> Updating…</> : "Update password"}</Button>
    </form>
  );
}
