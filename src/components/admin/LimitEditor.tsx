import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LIMIT_KEYS, LIMIT_LABELS, type OrgLimits } from "@/lib/org-features";
import { changeLimitMode, limitMode, type LimitMode } from "@/lib/plan-limits";

export function LimitEditor({ value, defaults = {}, onChange, disabled = false }: { value: OrgLimits; defaults?: OrgLimits; onChange: (value: OrgLimits) => void; disabled?: boolean }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{LIMIT_KEYS.map(key => {
    const mode = limitMode(value, key);
    return <div key={key} className="min-w-0 space-y-2">
      <Label htmlFor={`mode-${key}`}>{LIMIT_LABELS[key]}</Label>
      <Select value={mode} disabled={disabled} onValueChange={v => onChange(changeLimitMode(value, key, v as LimitMode, defaults[key]))}>
        <SelectTrigger id={`mode-${key}`} aria-label={`${LIMIT_LABELS[key]} mode`}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="custom">Custom</SelectItem><SelectItem value="unlimited">Unlimited</SelectItem></SelectContent>
      </Select>
      {mode === "custom" ? <Input aria-label={LIMIT_LABELS[key]} type="number" min={0} max={2147483647} step={1} disabled={disabled} value={value[key] ?? 0} onChange={e => onChange({ ...value, [key]: Number(e.target.value) })} /> : <p className="min-h-9 py-2 text-sm text-muted-foreground">{mode === "unlimited" ? "Unlimited" : defaults[key] == null ? "Default: Unlimited" : `Default: ${defaults[key]}`}</p>}
    </div>;
  })}</div>;
}