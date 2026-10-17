import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  Card,
  PageHeader,
  SearchInput,
  StatusBadge,
  EmptyState,
  ToolbarButton,
} from "@/components/admin/ui";
import {
  getHrmWorkspace,
  mutateHrm,
  hrmControlledAction,
  getHrmHistory,
  uploadHrmFile,
  downloadHrmFile,
} from "@/lib/hrm.functions";
import {
  indiaDate,
  indiaTimestamp,
  salaryTotals,
  validateRecord,
  validateFile,
  payrollSchema,
  attendanceSchema,
  leaveSchema,
  type HrModule,
  type HrRow,
} from "@/lib/hrm-model";
import { csvDownload } from "@/lib/hrm-data";
import { initials } from "@/lib/admin-head";
import { hrConfig, human } from "./config";
import { HrmCalendar } from "./HrmCalendar";
import { HrmAttendance } from "./HrmAttendance";
function getValue(row: HrRow, key: string) {
  return key.startsWith("details.") ? row.details?.[key.slice(8)] : row[key];
}
function putValue(row: HrRow, key: string, value: any) {
  return key.startsWith("details.")
    ? { ...row, details: { ...row.details, [key.slice(8)]: value } }
    : { ...row, [key]: value };
}
function formatTime(v: string) {
  return new Date(v).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function HrmPage({ module, self = false }: { module: HrModule; self?: boolean }) {
  const cfg = hrConfig[module];
  const qc = useQueryClient();
  const fetch = useServerFn(getHrmWorkspace),
    mutate = useServerFn(mutateHrm),
    controlled = useServerFn(hrmControlledAction),
    upload = useServerFn(uploadHrmFile),
    download = useServerFn(downloadHrmFile),
    historyFn = useServerFn(getHrmHistory);
  const [month, setMonth] = useState(() => indiaDate().slice(0, 7));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [company, setCompany] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [form, setForm] = useState<HrRow | null>(null);
  const [view, setView] = useState<HrRow | null>(null);
  const [pending, setPending] = useState<{ row: HrRow; action: string } | null>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<HrRow | null>(null);
  const query = useQuery({
    queryKey: ["hr-workspace", module, month],
    queryFn: () => fetch({ data: { module, month } }),
  });
  const data = query.data;
  const hist = useQuery({
    queryKey: ["hr-history", view?.id],
    enabled: !!view?.id,
    queryFn: () => (view?.id ? historyFn({ data: { id: view.id } }) : Promise.resolve([])),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["hr-workspace"] });
    qc.invalidateQueries({ queryKey: ["hrm"] });
    qc.invalidateQueries({ queryKey: ["hr-history"] });
  };
  const name = (id: string) =>
    data?.people.find((p) => p.id === id || p.profile_id === id)?.name ||
    data?.people.find((p) => p.id === id || p.profile_id === id)?.email ||
    "—";
  const companyName = (id: string) => data?.companies.find((p) => p.id === id)?.name || "—";
  const branchName = (id: string) => data?.branches.find((p) => p.id === id)?.name || "—";
  const deptName = (id: string) => data?.departments.find((p) => p.id === id)?.name || "—";
  const me = data?.people.find((p) => p.profile_id === data.userId);
  const people = (data?.people || []).filter(
    (p) =>
      (!self || p.profile_id === data?.userId) &&
      (!company || p.company_id === company) &&
      (!q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase())),
  );
  const rows = (data?.rows || []).filter(
    (r) =>
      (!company || r.company_id === company) &&
      (!status || (r.status || (r.is_active ? "active" : "inactive")) === status) &&
      (!q ||
        `${r.name || r.title || ""} ${name(r.employee_id)} ${r.kind || ""} ${r.details?.description || ""}`
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (module !== "payroll" || r.salary_period?.startsWith(month)) &&
      (module !== "holiday" || r.details?.recurring || r.start_date?.startsWith(month.slice(0, 4))),
  );
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * size, current * size);
  const newForm = () => {
    const r: HrRow = { id: "", details: {}, company_id: company || data?.companies[0]?.id || "" };
    for (const f of cfg.fields) {
      if (f.type === "file") continue;
      let value: any = "";
      if (f.type === "checkbox") value = f.key === "is_active";
      if (f.type === "multiple") value = [];
      if (f.options) value = f.options[0];
      if (f.type === "date") value = indiaDate();
      if (f.type === "month") value = month;
      if (f.type === "number") value = 0;
      if (f.type === "time") value = f.key.startsWith("end") ? "10:00" : "09:00";
      Object.assign(r, putValue(r, f.key, value));
    }
    r.company_id = company || data?.companies[0]?.id || "";
    if (module === "document") r.details.audience = "employees";
    if (module === "attendance") {
      r.date = indiaDate();
      r.status = "present";
    }
    if (self) r.employee_id = me?.id || "";
    return r;
  };
  const openCreate = () => {
    setForm(newForm());
    setFile(null);
    setError("");
  };
  const edit = (r: HrRow) => {
    let v: HrRow = { ...newForm(), ...r, details: { ...r.details } };
    if (module === "payroll") v.salary_period = r.salary_period.slice(0, 7);
    if (["meeting", "calendar"].includes(module)) {
      v.start_time = formatTime(r.start_at);
      v.end_time = formatTime(r.end_at);
    }
    if (module === "attendance") {
      v.date = r.attendance_date;
      v.check_in_time = r.check_in ? formatTime(r.check_in) : "";
      v.check_out_time = r.check_out ? formatTime(r.check_out) : "";
      v.reason = "";
    }
    setForm(v);
    setFile(null);
    setError("");
  };
  const payloadFor = (r: HrRow) => {
    const p: any = {};
    for (const f of cfg.fields) {
      if (["file", "start_time", "end_time", "check_in_time", "check_out_time"].includes(f.key))
        continue;
      const v = getValue(r, f.key);
      if (f.key.startsWith("details.")) p.details = { ...p.details, [f.key.slice(8)]: v };
      else
        p[f.key] =
          f.source && f.type !== "multiple" ? v || null : f.type === "number" ? Number(v) : v;
    }
    if (["meeting", "calendar"].includes(module)) {
      p.start_at = indiaTimestamp(r.start_date, r.start_time);
      p.end_at = indiaTimestamp(r.end_date, r.end_time);
    }
    if (module === "meeting") p.kind = "meeting";
    if (["announcement", "document"].includes(module)) p.end_date = p.end_date || null;
    if (module === "attendance") {
      p.check_in = r.check_in_time ? indiaTimestamp(r.date, r.check_in_time) : null;
      p.check_out = r.check_out_time ? indiaTimestamp(r.date, r.check_out_time) : null;
    }
    if (module === "payroll") {
      p.salary_period = `${r.salary_period}-01`;
      if (r.id) p.id = r.id;
    }
    if (module === "leave") {
      if (r.id) p.id = r.id;
      if (self) {
        p.self = true;
        delete p.employee_id;
      }
    }
    return p;
  };
  const fileUpload = async (id: string, f: File) => {
    validateFile(f.size, f.type);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("File could not be read"));
      reader.readAsDataURL(f);
    });
    await upload({ data: { id, filename: f.name, mime: f.type, base64 } });
  };
  const save = async () => {
    if (!form || busy) return;
    setBusy(true);
    setError("");
    try {
      const p = payloadFor(form);
      if (file) validateFile(file.size, file.type);
      if (module === "document" && !form.id && !file) throw new Error("Select a private file");
      let id: string;
      if (["attendance", "leave", "payroll"].includes(module)) {
        if (module === "attendance") attendanceSchema.parse(p);
        if (module === "leave") leaveSchema.parse(p);
        if (module === "payroll") payrollSchema.parse(p);
        id = await controlled({
          data: {
            module: module as "attendance" | "leave" | "payroll",
            action: module === "attendance" ? "manual" : module === "leave" ? "request" : "save",
            payload: p,
          },
        });
      } else {
        validateRecord(module, p);
        id = await mutate({
          data: { module, action: "save", id: form.id || undefined, payload: p },
        });
      }
      if (module === "document" && file) {
        try {
          await fileUpload(id, file);
        } catch (e) {
          setForm({ ...form, id });
          refresh();
          throw new Error(`Metadata saved; file upload needs retry: ${(e as Error).message}`);
        }
      }
      toast.success(form.id ? "Changes saved" : "Record created");
      setForm(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const ask = (row: HrRow, action: string) => {
    setPending({ row, action });
    setReason("");
    setReference("");
    setConfirmed(false);
    setError("");
  };
  const runAction = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const { row, action } = pending;
      if (action === "delete") await mutate({ data: { module, action: "delete", id: row.id } });
      else if (module === "payroll")
        await controlled({
          data: {
            module: "payroll",
            action,
            payload: { id: row.id, confirmed, ...(action === "paid" ? { reference } : { reason }) },
          },
        });
      else if (module === "leave")
        await controlled({ data: { module: "leave", action, payload: { id: row.id, reason } } });
      else {
        const merged: HrRow = { ...row };
        if (["branch", "designation"].includes(module)) merged.is_active = !row.is_active;
        else merged.status = action;
        const p = payloadFor({
          ...newForm(),
          ...merged,
          details: row.details || {},
          start_time: row.start_at ? formatTime(row.start_at) : "",
          end_time: row.end_at ? formatTime(row.end_at) : "",
        });
        await mutate({ data: { module, action: "save", id: row.id, payload: p } });
      }
      toast.success("Record updated");
      setPending(null);
      setView(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const getDownload = async (r: HrRow, versionId?: string) => {
    try {
      const v = await download({ data: { id: r.id, versionId } });
      const a = document.createElement("a");
      a.href = v.url;
      a.download = v.filename;
      a.rel = "noopener";
      a.click();
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const cells = (r: HrRow): any[] => {
    const created = new Date(r.created_at).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const period = `${r.start_date || ""} — ${r.end_date || r.start_date || ""}`;
    switch (module) {
      case "branch":
        return [
          r.name,
          name(r.manager_id),
          [r.address, r.city].filter(Boolean).join(", ") || "—",
          created,
        ];
      case "designation":
        return [r.name, branchName(r.branch_id), created];
      case "holiday":
        return [r.title, human(r.kind), period];
      case "leave":
        return [
          name(r.employee_id),
          human(r.kind),
          `${period}${r.half_day ? " · Half day" : ""}`,
          human(r.status),
          r.decided_at
            ? `${name(r.approver_id)} · ${new Date(r.decided_at).toLocaleDateString("en-IN")}`
            : "Pending",
        ];
      case "meeting":
        return [
          r.title,
          deptName(r.department_id),
          `${r.start_date} · ${formatTime(r.start_at)} IST`,
          human(r.status),
        ];
      case "announcement":
        return [r.title, name(r.created_by), created];
      case "document":
        return [
          "",
          r.title,
          (r.details?.role_ids || [])
            .map((id: string) => data?.roles.find((role) => role.id === id)?.name || "Role")
            .join(", ") || human(r.details?.audience),
          data?.extra["versions"]?.find((v) => v.document_id === r.id)?.filename || "No file",
          name(r.created_by),
          created,
        ];
      case "payroll":
        return [
          name(r.employee_id),
          r.salary_date,
          `₹${Number(r.net).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          human(r.status),
        ];
      default:
        return [];
    }
  };
  const exportRows = () => {
    if (module === "attendance") {
      const y = Number(month.slice(0, 4)),
        m = Number(month.slice(5));
      const days = new Date(y, m, 0).getDate();
      import("@/lib/hrm-model").then(({ attendanceCell }) =>
        csvDownload(`attendance-${month}.csv`, [
          [
            "Employee",
            ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
          ],
          ...people.map((e) => [
            e.name || e.email,
            ...Array.from(
              { length: days },
              (_, i) =>
                attendanceCell(
                  e,
                  `${month}-${String(i + 1).padStart(2, "0")}`,
                  data?.extra["attendance"] || [],
                  data?.extra["holidays"] || [],
                  data?.extra["leaves"] || [],
                ).status,
            ),
          ]),
        ]),
      );
    } else csvDownload(`${module}.csv`, [cfg.columns.slice(0, -1), ...rows.map(cells)]);
  };
  const badge = (s: string) =>
    s === "paid" || s === "approved" || s === "active"
      ? "green"
      : s === "rejected" || s === "absent" || s === "cancelled"
        ? "red"
        : s === "pending" || s === "unpaid"
          ? "orange"
          : "blue";
  const menu = (r: HrRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${r.name || r.title || name(r.employee_id)}`}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setView(r)}>
          <Eye className="size-4" />
          View
        </DropdownMenuItem>
        {(!self || module === "leave") &&
          !(module === "payroll" && r.status === "paid") &&
          !(module === "leave" && !["pending", "correction"].includes(r.status)) && (
            <DropdownMenuItem onClick={() => edit(r)}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
          )}
        {["branch", "designation"].includes(module) && (
          <DropdownMenuItem onClick={() => ask(r, "toggle")}>
            <Power className="size-4" />
            {r.is_active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        )}
        {module === "leave" && (
          <>
            {!self && r.status === "pending" && (
              <>
                <DropdownMenuItem onClick={() => ask(r, "approve")}>
                  <Check className="size-4" />
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => ask(r, "reject")}>Reject</DropdownMenuItem>
                <DropdownMenuItem onClick={() => ask(r, "correction")}>
                  Request correction
                </DropdownMenuItem>
              </>
            )}
            {!["rejected", "cancelled"].includes(r.status) && (
              <DropdownMenuItem onClick={() => ask(r, "cancel")}>Cancel request</DropdownMenuItem>
            )}
          </>
        )}
        {module === "payroll" && (
          <DropdownMenuItem onClick={() => ask(r, r.status === "paid" ? "correct" : "paid")}>
            {r.status === "paid" ? "Correct paid status" : "Record paid status"}
          </DropdownMenuItem>
        )}
        {module === "meeting" && r.status !== "cancelled" && (
          <DropdownMenuItem onClick={() => ask(r, "cancelled")}>Cancel meeting</DropdownMenuItem>
        )}
        {module === "announcement" && (
          <>
            {r.status === "draft" && (
              <DropdownMenuItem onClick={() => ask(r, "published")}>Publish</DropdownMenuItem>
            )}
            {r.status === "published" && (
              <DropdownMenuItem onClick={() => ask(r, "archived")}>Archive</DropdownMenuItem>
            )}
          </>
        )}
        {module === "document" && (
          <DropdownMenuItem onClick={() => getDownload(r)}>
            <Download className="size-4" />
            Download
          </DropdownMenuItem>
        )}
        {!self &&
          !["attendance", "leave", "payroll", "meeting"].includes(module) &&
          (module !== "announcement" || r.status === "draft") && (
            <DropdownMenuItem className="text-admin-red" onClick={() => ask(r, "delete")}>
              <Trash2 className="size-4" />
              {module === "document" ? "Delete / retain audit" : "Delete"}
            </DropdownMenuItem>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const selfCheck = async (action: string) => {
    setBusy(true);
    try {
      await controlled({ data: { module: "attendance", action, payload: {} } });
      refresh();
      toast.success(action === "check_in" ? "Checked in" : "Checked out");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (query.error)
    return (
      <div className="space-y-4">
        <Breadcrumb trail={["HRM"]} label={cfg.label} />
        <p role="alert" className="text-admin-red">
          {(query.error as Error).message}
        </p>
        <Button onClick={() => query.refetch()}>Retry</Button>
      </div>
    );
  const today = (data?.rows || []).find(
    (r) => r.employee_id === me?.id && r.attendance_date === indiaDate(),
  );
  return (
    <div className="space-y-5">
      <Breadcrumb trail={["HRM"]} label={cfg.label} />
      <PageHeader
        title={
          ["attendance", "calendar", "meeting", "document"].includes(module)
            ? cfg.title
            : `${cfg.title} (${rows.length})`
        }
        subtitle={cfg.subtitle}
      >
        {module !== "calendar" && (
          <>
            <SearchInput
              placeholder={`Search ${module === "payroll" || module === "attendance" ? "employee" : cfg.title.toLowerCase()}...`}
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              className="w-56"
            />
            <ToolbarButton onClick={exportRows}>
              <Download className="size-4" />
              Export
            </ToolbarButton>
          </>
        )}
        {!self || module === "leave" ? (
          <ToolbarButton primary onClick={openCreate}>
            <Plus className="size-4" />
            {cfg.add}
          </ToolbarButton>
        ) : null}
      </PageHeader>
      {self && module === "attendance" && (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <div className="mr-auto">
            <h2 className="font-semibold">Today's Status · {indiaDate()} IST</h2>
            <p className="text-sm text-muted-foreground">
              {today
                ? `${human(today.status)} · ${today.check_in ? formatTime(today.check_in) : "—"}${today.check_out ? ` — ${formatTime(today.check_out)}` : ""}`
                : "Not recorded"}
            </p>
            {today?.check_in && <WorkingDuration start={today.check_in} end={today.check_out} />}
          </div>
          <Button disabled={busy || !!today || !me} onClick={() => selfCheck("check_in")}>
            Check In
          </Button>
          <Button
            variant="outline"
            disabled={busy || !today?.check_in || !!today?.check_out}
            onClick={() => selfCheck("check_out")}
          >
            Check Out
          </Button>
        </Card>
      )}
      {module !== "calendar" && (
        <div className="flex flex-wrap gap-3">
          {!self && (
            <select
              aria-label="Company filter"
              className="inp w-48"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All authorized companies</option>
              {data?.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {module !== "attendance" && (
            <select
              aria-label="Status filter"
              className="inp w-40"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Array.from(
                new Set(
                  (data?.rows || []).map((r) => r.status || (r.is_active ? "active" : "inactive")),
                ),
              ).map((s) => (
                <option key={s} value={s}>
                  {human(s)}
                </option>
              ))}
            </select>
          )}
          {["payroll", "holiday"].includes(module) && (
            <input
              aria-label={module === "payroll" ? "Salary period" : "Holiday year"}
              type={module === "payroll" ? "month" : "number"}
              className="inp w-40"
              value={module === "payroll" ? month : month.slice(0, 4)}
              onChange={(e) =>
                setMonth(module === "payroll" ? e.target.value : `${e.target.value}-01`)
              }
            />
          )}
          {module === "leave" && !self && (
            <Button
              variant="outline"
              onClick={() =>
                setBalance({
                  id: "",
                  employee_id: "",
                  kind: "casual",
                  year: Number(month.slice(0, 4)),
                  entitlement: 0,
                  reason: "",
                })
              }
            >
              Leave Entitlements
            </Button>
          )}
        </div>
      )}
      {query.isLoading ? (
        <Card>
          <EmptyState title="Loading…" />
        </Card>
      ) : module === "attendance" ? (
        <HrmAttendance
          people={people}
          extra={data?.extra || {}}
          month={month}
          setMonth={setMonth}
          onOpen={setView}
        />
      ) : module === "calendar" ? (
        <HrmCalendar extra={data?.extra || {}} month={month} setMonth={setMonth} onOpen={setView} />
      ) : (
        <Card className="min-w-0 p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[15px]">
              <thead>
                <tr className="bg-muted/60">
                  {cfg.columns.map((c, i) => (
                    <th key={`${c}${i}`} className="px-4 py-4 font-semibold">
                      {module === "document" && i === 0 ? (
                        <span className="sr-only">Select</span>
                      ) : (
                        c
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/40">
                    {cells(r).map((c, i) => (
                      <td
                        key={i}
                        className={`px-4 py-4 ${module === "payroll" && i === 2 ? "font-semibold text-success" : ""}`}
                      >
                        {module === "document" && i === 0 ? (
                          <input aria-label={`Select ${r.title}`} type="checkbox" />
                        ) : i === 0 && ["payroll", "leave"].includes(module) ? (
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 place-items-center rounded-full bg-admin-blue/10 text-admin-blue">
                              {initials(String(c))}
                            </span>
                            <span>{c}</span>
                          </div>
                        ) : cfg.columns[i] === "Status" ? (
                          <StatusBadge tone={badge(r.status)}>{c}</StatusBadge>
                        ) : (
                          c
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">{menu(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="mt-3 bg-muted/60">
                <EmptyState />
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 text-sm">
            <span>Total {rows.length} items</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous page"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="grid size-9 place-items-center rounded bg-admin-blue text-primary-foreground">
              {current}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next page"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <select
              aria-label="Rows per page"
              className="inp w-28"
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && !busy && setForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form?.id ? `Edit ${cfg.label}` : cfg.add}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="grid max-h-[72vh] gap-4 overflow-y-auto sm:grid-cols-2"
            >
              {cfg.fields
                .filter((f) => !(self && f.key === "employee_id"))
                .map((f) => {
                  const value = getValue(form, f.key);
                  const opts = f.source
                    ? ((data?.[f.source] || []) as HrRow[]).filter(
                        (o) =>
                          f.source === "companies" ||
                          f.source === "roles" ||
                          !form.company_id ||
                          o.company_id === form.company_id,
                      )
                    : [];
                  return (
                    <label
                      key={f.key}
                      className={`grid gap-1 text-sm font-medium ${["textarea", "file", "multiple"].includes(f.type || "") ? "sm:col-span-2" : ""}`}
                    >
                      {f.label}
                      {f.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          className="size-4 accent-admin-blue"
                          checked={!!value}
                          onChange={(e) => setForm(putValue(form, f.key, e.target.checked))}
                        />
                      ) : f.type === "file" ? (
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx"
                          onChange={(e) => {
                            const chosen = e.target.files?.[0];
                            if (chosen) {
                              try {
                                validateFile(chosen.size, chosen.type);
                                setFile(chosen);
                              } catch (err) {
                                toast.error((err as Error).message);
                                e.target.value = "";
                              }
                            }
                          }}
                        />
                      ) : f.source || f.options ? (
                        <select
                          multiple={f.type === "multiple"}
                          required={f.required}
                          className={
                            f.type === "multiple" ? "min-h-28 rounded-md border bg-card p-2" : "inp"
                          }
                          value={f.type === "multiple" ? value || [] : value || ""}
                          disabled={!!form.id && f.key === "company_id"}
                          onChange={(e) => {
                            let next = putValue(
                              form,
                              f.key,
                              f.type === "multiple"
                                ? Array.from(e.target.selectedOptions).map((o) => o.value)
                                : e.target.value,
                            );
                            if (f.key === "company_id") {
                              for (const key of ["branch_id", "department_id", "manager_id"])
                                if (key in next) next[key] = "";
                              next.details = { ...next.details, employee_ids: [], role_ids: [] };
                            }
                            setForm(next);
                          }}
                        >
                          {f.type !== "multiple" && !f.options && (
                            <option value="">
                              {f.required ? "Select…" : "None / all applicable"}
                            </option>
                          )}
                          {f.options?.map((o) => (
                            <option key={o} value={o}>
                              {human(o)}
                            </option>
                          ))}
                          {opts.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name || o.email}
                            </option>
                          ))}
                        </select>
                      ) : f.type === "textarea" ? (
                        <textarea
                          className="min-h-24 rounded-md border bg-card p-3"
                          required={f.required}
                          maxLength={4000}
                          value={value || ""}
                          onChange={(e) => setForm(putValue(form, f.key, e.target.value))}
                        />
                      ) : (
                        <input
                          className="inp"
                          type={f.type || "text"}
                          required={f.required}
                          min={f.type === "number" ? 0 : undefined}
                          step={f.type === "number" ? "0.01" : undefined}
                          maxLength={f.type === "text" || !f.type ? 160 : undefined}
                          value={value ?? ""}
                          onChange={(e) => setForm(putValue(form, f.key, e.target.value))}
                        />
                      )}
                    </label>
                  );
                })}
              {module === "payroll" && (
                <div className="sm:col-span-2 rounded border bg-muted/50 p-4">
                  {(() => {
                    try {
                      const t = salaryTotals(
                        form.basic,
                        form.allowances,
                        form.bonuses,
                        form.deductions,
                      );
                      const e = data?.people.find((p) => p.id === form.employee_id);
                      return (
                        <>
                          <p className="text-sm">
                            {companyName(e?.company_id)} · {branchName(e?.branch_id)}
                          </p>
                          <div className="mt-2 flex justify-between">
                            <span>
                              Gross Salary <b>₹{t.gross}</b>
                            </span>
                            <span>
                              Net Payable <b className="text-success">₹{t.net}</b>
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Unpaid draft · no money transfer
                          </p>
                        </>
                      );
                    } catch (e) {
                      return <p className="text-admin-red">{(e as Error).message}</p>;
                    }
                  })()}
                </div>
              )}
              {error && (
                <p role="alert" className="text-sm text-admin-red sm:col-span-2">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="sm:col-span-2">
                {busy
                  ? "Saving…"
                  : form.id
                    ? "Save changes"
                    : module === "leave"
                      ? "Submit Request"
                      : "Save"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {view?.name || view?.title || name(view?.employee_id || "") || cfg.label}
            </DialogTitle>
          </DialogHeader>
          {view && (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto text-sm">
              <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
                {Object.entries(view)
                  .filter(([k]) => !["id", "details", "source", "path"].includes(k))
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{human(k)}</dt>
                      <dd className="break-words font-medium">
                        {k === "employee_id" || k === "created_by" || k === "approver_id"
                          ? name(String(v))
                          : k === "company_id"
                            ? companyName(String(v))
                            : k === "branch_id"
                              ? branchName(String(v))
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v ?? "—")}
                      </dd>
                    </div>
                  ))}
              </dl>
              {view.details?.description && (
                <p className="whitespace-pre-wrap">{view.details.description}</p>
              )}
              {view.details?.employee_ids?.length > 0 && (
                <div>
                  <h3 className="font-semibold">Attendees / audience</h3>
                  {view.details.employee_ids.map((id: string) => (
                    <p key={id}>
                      {name(id)} · {view.details.responses?.[id] || "No response"}
                    </p>
                  ))}
                </div>
              )}
              {module === "document" && (
                <div>
                  <h3 className="mb-2 font-semibold">Private file versions</h3>
                  {data?.extra["versions"]
                    ?.filter((v) => v.document_id === view.id)
                    .map((v) => (
                      <Button
                        key={v.id}
                        variant="outline"
                        className="mb-2 w-full justify-start"
                        onClick={() => getDownload(view, v.id)}
                      >
                        <Download className="size-4" />
                        {v.filename} · {new Date(v.created_at).toLocaleDateString("en-IN")}
                      </Button>
                    ))}
                </div>
              )}
              {module === "attendance" && view.id && !self && (
                <Button
                  variant="outline"
                  onClick={() => {
                    edit(view);
                    setView(null);
                  }}
                >
                  <Pencil className="size-4" />
                  Correct Attendance
                </Button>
              )}
              {module === "calendar" && view.source === "calendar" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      edit(view);
                      setView(null);
                    }}
                  >
                    Edit Schedule
                  </Button>
                  <Button variant="destructive" onClick={() => ask(view, "delete")}>
                    Delete Schedule
                  </Button>
                </>
              )}
              {hist.data?.length ? (
                <div>
                  <h3 className="mb-2 font-semibold">Modification History</h3>
                  {hist.data.map((a) => (
                    <p className="border-b py-2" key={a.id}>
                      {human(a.action)} · {name(a.actor_id)} ·{" "}
                      {new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}{" "}
                      IST
                      <br />
                      {a.reason}
                    </p>
                  ))}
                </div>
              ) : null}
              {module === "meeting" &&
                self &&
                ["accepted", "declined", "tentative"].map((response) => (
                  <Button
                    key={response}
                    variant="outline"
                    onClick={async () => {
                      try {
                        await controlled({
                          data: {
                            module: "meeting",
                            action: "respond",
                            payload: { id: view.id, response },
                          },
                        });
                        refresh();
                        toast.success("Response saved");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {human(response)}
                  </Button>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {human(pending?.action)} ·{" "}
              {pending?.row.name || pending?.row.title || name(pending?.row.employee_id || "")}
            </DialogTitle>
          </DialogHeader>
          {pending?.action === "delete" && (
            <p className="text-sm text-muted-foreground">
              Confirm removal. Dependent organization records are protected; documents are archived
              with audit history retained.
            </p>
          )}
          {module === "payroll" && pending?.action === "paid" && (
            <label className="grid gap-1 text-sm">
              Recorded Payment Reference / Evidence
              <input
                className="inp"
                value={reference}
                maxLength={200}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          )}
          {(module === "leave" || pending?.action === "correct") && (
            <label className="grid gap-1 text-sm">
              Decision / Correction Reason
              <textarea
                className="min-h-24 rounded border p-3"
                value={reason}
                maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {module === "payroll" && (
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              {pending?.action === "paid"
                ? "I confirm this payment was already authorized and recorded. No money is transferred here."
                : "I authorize this correction; prior payment evidence and audit history will remain."}
            </label>
          )}
          {error && (
            <p role="alert" className="text-admin-red">
              {error}
            </p>
          )}
          <Button disabled={busy || (module === "payroll" && !confirmed)} onClick={runAction}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!balance} onOpenChange={(o) => !o && setBalance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave Entitlements</DialogTitle>
          </DialogHeader>
          {balance && (
            <div className="grid gap-3">
              <select
                aria-label="Entitlement employee"
                className="inp"
                value={balance.employee_id}
                onChange={(e) => setBalance({ ...balance, employee_id: e.target.value })}
              >
                <option value="">Select employee</option>
                {data?.people
                  .filter((p) => p.company_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.email}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Entitlement type"
                className="inp"
                value={balance.kind}
                onChange={(e) => setBalance({ ...balance, kind: e.target.value })}
              >
                {["casual", "sick", "earned", "other"].map((v) => (
                  <option key={v} value={v}>
                    {human(v)}
                  </option>
                ))}
              </select>
              <label>
                Year
                <input
                  type="number"
                  className="inp"
                  value={balance.year}
                  onChange={(e) => setBalance({ ...balance, year: Number(e.target.value) })}
                />
              </label>
              <label>
                Entitlement (working days)
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="inp"
                  value={balance.entitlement}
                  onChange={(e) => setBalance({ ...balance, entitlement: Number(e.target.value) })}
                />
              </label>
              <label>
                Reason
                <input
                  className="inp"
                  value={balance.reason}
                  onChange={(e) => setBalance({ ...balance, reason: e.target.value })}
                />
              </label>
              {data?.extra["balances"]
                ?.filter((b) => b.employee_id === balance.employee_id)
                .map((b) => (
                  <p key={b.id} className="text-sm">
                    {human(b.kind)} {b.year}: {b.entitlement - b.used} remaining / {b.entitlement}{" "}
                    days
                  </p>
                ))}
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { id, ...p } = balance;
                    await controlled({ data: { module: "leave", action: "balance", payload: p } });
                    toast.success("Entitlement saved");
                    setBalance(null);
                    refresh();
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save Entitlement
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function WorkingDuration({ start, end }: { start: string; end?: string }) {
  const [now, setNow] = useState(Date.now());
  useQuery({
    queryKey: ["attendance-clock"],
    queryFn: () => {
      setNow(Date.now());
      return Date.now();
    },
    refetchInterval: 60000,
  });
  const minutes = Math.max(
    0,
    Math.floor(((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 60000),
  );
  return (
    <p className="text-sm">
      Working duration: {Math.floor(minutes / 60)}h {minutes % 60}m
    </p>
  );
}
