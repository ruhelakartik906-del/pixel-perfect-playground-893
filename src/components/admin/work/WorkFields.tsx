import type { ReactNode } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
export function Field({label,children}:{label:string;children:ReactNode}) {return <div className="grid min-w-0 gap-1.5"><span className="text-sm font-semibold">{label}</span>{children}</div>;}
export function Pick({label,value,onChange,options,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];disabled?:boolean}) {return <Select value={value || "none"} onValueChange={v=>onChange(v==="none"?"":v)} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent><SelectItem value="none">Select {label.toLowerCase()}</SelectItem>{options.map(o=><SelectItem value={o.value} key={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;}
export function WorkDate({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) {const date=value?new Date(`${value}T12:00:00`):undefined;return <Popover><PopoverTrigger asChild><Button variant="outline" aria-label={label} className="w-full justify-start font-normal"><CalendarIcon/>{date?format(date,"dd MMM yyyy"):label}</Button></PopoverTrigger><PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={d=>onChange(d?format(d,"yyyy-MM-dd"):"")} className="pointer-events-auto"/></PopoverContent></Popover>;}
