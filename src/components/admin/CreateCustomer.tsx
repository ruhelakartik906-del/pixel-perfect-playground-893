import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb, Card, PageHeader } from "./ui";
import { createCustomer } from "@/lib/customers.functions";

const schema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(120),
  full_name: z.string().trim().min(1, "Customer name is required").max(120),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

type Form = z.infer<typeof schema>;

export function CreateCustomer() {
  const navigate = useNavigate();
  const create = useServerFn(createCustomer);
  const [form, setForm] = useState<Form>({ company_name: "", full_name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string | undefined>>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({
        company_name: f.company_name?.[0], full_name: f.full_name?.[0],
        email: f.email?.[0], phone: f.phone?.[0], password: f.password?.[0],
      });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await create({ data: parsed.data });
      toast.success(`${parsed.data.company_name} created. The customer can sign in now.`);
      await navigate({ to: "/admin/all-users/$companyId", params: { companyId: result.company_id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Customer could not be created");
    } finally {
      setLoading(false);
    }
  }

  const field = (id: keyof Form, label: string, type = "text", autoComplete = "off") => (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      <Input id={id} type={type} autoComplete={autoComplete} value={form[id] ?? ""} onChange={set(id)}
        aria-invalid={!!errors[id]} className="mt-1.5 h-11 rounded-xl" />
      {errors[id] && <p className="mt-1 text-xs text-destructive">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="grid gap-5">
      <Breadcrumb label="Create Customer" trail={["User Management", "All Users"]} />
      <PageHeader title="Create Customer" subtitle="Create a customer organization and its admin account in one step." />
      <Card className="max-w-2xl p-6">
        <form onSubmit={submit} noValidate className="grid gap-4">
          {field("company_name", "Company Name", "text", "organization")}
          {field("full_name", "Customer / Admin Full Name", "text", "name")}
          {field("email", "Email Address", "email", "email")}
          {field("phone", "Mobile Number", "tel", "tel")}
          {field("password", "Password", "password", "new-password")}
          <p className="text-xs text-muted-foreground">
            The password is handled by the authentication system only and is never stored in plain text.
            A 1-year subscription starts immediately; manage the plan and permissions after creation.
          </p>
          <Button type="submit" variant="hero" size="xl" disabled={loading}>
            {loading ? <><Loader2 className="animate-spin" /> Creating…</> : <><UserPlus /> Create Customer</>}
          </Button>
        </form>
      </Card>
    </div>
  );
}
