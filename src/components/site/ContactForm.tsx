import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "./SectionHeading";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  company: z.string().trim().min(1, "Please enter your company name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{5,19}$/, "Please enter a valid phone number"),
  message: z.string().trim().min(10, "Message should be at least 10 characters").max(2000),
});
type Form = z.infer<typeof schema>;
const empty: Form = { name: "", company: "", email: "", phone: "", message: "" };

export function ContactSection() {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      const errs: typeof errors = {};
      r.error.issues.forEach((i) => { errs[i.path[0] as keyof Form] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setState("sending");
    const { error } = await supabase.from("contact_submissions").insert(r.data);
    if (error) {
      setState("idle");
      toast.error("We couldn't send your message. Please try again.");
      return;
    }
    setState("done");
    setForm(empty);
    toast.success("Thanks! Your message has been sent.");
  };

  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={k} className="text-sm font-semibold">{label}</Label>
      <Input id={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} aria-invalid={!!errors[k]} className="mt-1.5 h-11 rounded-xl" {...props} />
      {errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <section id="contact" className="bg-surface py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.2fr] lg:px-8">
        <div>
          <SectionHeading className="mx-0 text-left" eyebrow="Get started" title="Talk to our team" desc="Tell us about your business and how you run Meta ads today. We'll reply by email to set up your workspace." />
          <ul className="mt-8 space-y-3 text-[15px] text-muted-foreground">
            {["Walkthrough of routing rules for your ads", "Help connecting Make.com", "Team and role setup"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" /> {t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border bg-card p-7 shadow-float">
          {state === "done" ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto size-14 text-success" />
              <h3 className="mt-4 text-2xl font-bold">Message received</h3>
              <p className="mt-2 text-muted-foreground">We'll get back to you by email shortly.</p>
              <Button variant="pill" size="xl" className="mt-6" onClick={() => setState("idle")}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {field("name", "Name", { autoComplete: "name" })}
                {field("company", "Company Name", { autoComplete: "organization" })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("email", "Email", { type: "email", autoComplete: "email" })}
                {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
              </div>
              <div>
                <Label htmlFor="message" className="text-sm font-semibold">Message</Label>
                <Textarea id="message" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} aria-invalid={!!errors.message} className="mt-1.5 rounded-xl" />
                {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
              </div>
              <Button type="submit" variant="hero" size="xl" disabled={state === "sending"}>
                {state === "sending" ? <><Loader2 className="animate-spin" /> Sending…</> : "Send message"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
