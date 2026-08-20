import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAttendance } from "../context/AttendanceContext";
import { formatPakistanDateTime } from "../lib/time";

const statusTabs = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "resolved", label: "Resolved" },
];

const typeLabels = {
  missing_checkout: "Missing checkout",
  face_enrollment_missing: "Face enrollment",
  pin_fallback_used: "PIN fallback",
};

const severityStyles = {
  high: { label: "High", className: "bg-amber-soft text-[#8A6500]", icon: ShieldAlert },
  medium: { label: "Medium", className: "bg-blue-soft text-blue-deep", icon: AlertTriangle },
  low: { label: "Low", className: "bg-mint-soft text-[#167A55]", icon: CheckCircle2 },
};

const statusStyles = {
  open: "bg-vanilla-soft text-[#735C00]",
  acknowledged: "bg-blue-soft text-blue-deep",
  resolved: "bg-mint-soft text-[#167A55]",
};

function formatDate(value) {
  if (!value) return "";
  return formatPakistanDateTime(value);
}

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function Exceptions() {
  const { exceptions, reviewException, can, currentUser } = useAttendance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeStatus, setActiveStatus] = useState(searchParams.get("status") || "all");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const canReview = ["enterprise_admin", "hr", "manager"].includes(currentUser.role) && can("view_exceptions");

  useEffect(() => {
    const status = searchParams.get("status");
    if (statusTabs.some((tab) => tab.id === status)) setActiveStatus(status);
    const exceptionId = searchParams.get("exception");
    if (!exceptionId) return;
    window.requestAnimationFrame(() => document.getElementById(`exception-${exceptionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [searchParams, exceptions.length]);

  const visibleExceptions = useMemo(() => activeStatus === "all" ? exceptions : exceptions.filter((item) => item.status === activeStatus), [activeStatus, exceptions]);
  const openCount = exceptions.filter((item) => item.status === "open").length;

  const selectStatus = (status) => {
    setActiveStatus(status);
    const next = new URLSearchParams(searchParams);
    if (status === "all") next.delete("status");
    else next.set("status", status);
    setSearchParams(next, { replace: true });
  };

  const handleReview = async (id, status) => {
    setBusyId(id);
    setError("");
    const result = await reviewException(id, status);
    if (!result.ok) setError(result.error);
    setBusyId("");
  };

  return <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
    <div className="motion-enter flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-amber-soft text-[#8A6500]"><AlertTriangle size={21} /></div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue">Attendance controls</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-ink sm:text-4xl">Exceptions inbox</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Review the attendance issues that need a human decision. Biometric data never appears in this inbox.</p>
      </div>
      <div className="rounded-2xl border border-line bg-white px-4 py-3 text-left sm:min-w-[150px]"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted">Open now</p><p className="mt-1 text-2xl font-black tracking-tight text-ink">{openCount}</p></div>
    </div>

    <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Exception status filter">
      {statusTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeStatus === tab.id} onClick={() => selectStatus(tab.id)} className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${activeStatus === tab.id ? "bg-ink text-white" : "border border-line bg-white text-muted hover:bg-sky-soft hover:text-ink"}`}>{tab.label}<span className="ml-1.5 opacity-60">{tab.id === "all" ? exceptions.length : exceptions.filter((item) => item.status === tab.id).length}</span></button>)}
    </div>

    {error && <div className="mt-5 rounded-2xl border border-rose/20 bg-rose-soft px-4 py-3 text-sm font-semibold text-[#A63D5A]" role="alert">{error}</div>}

    <div className="mt-6 space-y-3">
      {exceptions.length === 0 && <div className="ui-surface motion-enter px-6 py-14 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-mint-soft text-mint"><Check size={23} /></div><h2 className="mt-4 text-lg font-extrabold text-ink">No attendance exceptions</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">New missing checkouts, enrollment issues, and PIN fallback events will appear here as they happen.</p></div>}
      {exceptions.length > 0 && visibleExceptions.length === 0 && <div className="ui-surface px-6 py-12 text-center"><Clock3 size={23} className="mx-auto text-ice" /><h2 className="mt-4 text-base font-extrabold text-ink">Nothing in this status</h2><p className="mt-2 text-sm text-muted">Choose another filter to view the rest of the inbox.</p></div>}
      {visibleExceptions.map((item) => {
        const severity = severityStyles[item.severity] || severityStyles.medium;
        const SeverityIcon = severity.icon;
        const isBusy = busyId === item.id;
        return <article id={`exception-${item.id}`} key={item.id} className="ui-surface motion-enter scroll-mt-24 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3.5"><div className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${severity.className}`}><SeverityIcon size={18} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${severity.className}`}>{severity.label}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${statusStyles[item.status] || "bg-surface text-muted"}`}>{statusLabel(item.status)}</span></div><h2 className="mt-2 text-base font-extrabold text-ink">{item.title}</h2><p className="mt-1 text-sm leading-6 text-muted">{item.message}</p><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-muted"><span className="text-ink">{item.subject_user_name}</span><span className="text-ice">•</span><span>{typeLabels[item.exception_type] || item.exception_type}</span><span className="text-ice">•</span><span>{formatDate(item.created_at)}</span></div></div></div>
            {canReview && item.status !== "resolved" && <div className="flex shrink-0 gap-2 sm:pt-1"><button type="button" disabled={isBusy} onClick={() => handleReview(item.id, "acknowledged")} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink transition-colors hover:bg-sky-soft disabled:cursor-wait disabled:opacity-50">{isBusy ? "Saving…" : "Acknowledge"}</button><button type="button" disabled={isBusy} onClick={() => handleReview(item.id, "resolved")} className="rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white transition-[background-color,transform] hover:bg-blue-deep active:scale-95 disabled:cursor-wait disabled:opacity-50">Resolve</button></div>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
