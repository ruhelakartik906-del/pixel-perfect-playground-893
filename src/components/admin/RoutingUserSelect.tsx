import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function RoutingUserSelect({ value, onChange, label, disabled, options }: {
  value: string; onChange: (id: string) => void; label: string; disabled: boolean;
  options: { id: string; name: string; email: string; role: string; reason?: string | undefined }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.id === value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
    <Button variant="outline" role="combobox" aria-label={label} aria-expanded={open} disabled={disabled} className="h-10 w-full min-w-0 justify-between bg-card font-normal">
      <span className="truncate">{selected ? `${selected.name} · ${selected.email} · ${selected.role}` : "Select User"}</span><ChevronsUpDown className="size-4 shrink-0" />
    </Button>
  </PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[calc(100vw-3rem)] p-0">
    <Command><CommandInput aria-label={`Search ${label}`} placeholder="Search name, email or role..." /><CommandList><CommandEmpty>No active users found.</CommandEmpty><CommandGroup>
      {options.map(option => <CommandItem key={option.id} value={`${option.name} ${option.email} ${option.role} ${option.id}`} disabled={!!option.reason} onSelect={() => { onChange(option.id); setOpen(false); }}>
        <Check className={value === option.id ? "opacity-100" : "opacity-0"} /><span className="min-w-0 break-words"><span className="block font-semibold">{option.name} · {option.role}</span><span className="block text-xs text-muted-foreground">{option.email}</span>{option.reason && <span className="block text-xs text-destructive">{option.reason}</span>}</span>
      </CommandItem>)}
    </CommandGroup></CommandList></Command>
  </PopoverContent></Popover>;
}