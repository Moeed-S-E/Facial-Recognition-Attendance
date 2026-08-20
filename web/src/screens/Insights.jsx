import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, ChevronRight, Info, RefreshCw, Sparkles, Target, TrendingUp } from "lucide-react";
import { useAttendance } from "../context/AttendanceContext";

const severityStyles = {
  High: "bg-rose-soft text-rose",
  Medium: "bg-amber-soft text-amber",
  Watch: "bg-blue-soft text-blue",
};

function ProgressBar({ value, color = "bg-blue" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#EEF1F5]">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function EmptyInsightState({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-canvas/60 p-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-blue-soft text-blue"><Info size={18} /></div>
      <h3 className="mt-3 text-sm font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted">{children}</p>
    </div>
  );
}

function MetricCard({ icon, iconClass, label, value, badge, detail }) {
  return (
    <div className="rounded-[22px] border border-line bg-white p-5 shadow-[0_8px_26px_rgba(23,50,77,0.045)]">
      <div className="flex items-center justify-between">
        <div className={`flex size-10 items-center justify-center rounded-xl ${iconClass}`}>{icon}</div>
        <span className="text-[10px] font-bold text-blue">{badge}</span>
      </div>
      <p className="mt-5 text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-bold text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{detail}</p>
    </div>
  );
}

function TrajectoryCard({ weekly, window, setWindow }) {
  return (
    <div className="rounded-[24px] border border-line bg-white p-5 shadow-[0_8px_26px_rgba(23,50,77,0.045)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-base font-bold text-ink">Attendance trajectory</h2><p className="mt-1 text-xs text-muted">Actual coverage with a short-range forecast</p></div>
        <div className="flex rounded-xl bg-canvas p-1">
          {["7 days", "30 days", "Quarter"].map((item) => <button key={item} onClick={() => setWindow(item)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${window === item ? "bg-white text-ink shadow-sm" : "text-muted"}`}>{item}</button>)}
        </div>
      </div>
      {weekly.length ? (
        <>
          <div className="mt-8 flex h-[210px] items-end gap-2 sm:gap-4">
            {weekly.map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-[170px] w-full items-end justify-center">
                  <div className={`w-full max-w-[38px] rounded-t-xl ${index > 4 ? "bg-blue/40" : "bg-blue"}`} style={{ height: `${Math.max(8, value * 1.55)}px` }} />
                  <span className="absolute -top-5 text-[10px] font-bold text-muted">{value}%</span>
                </div>
                <span className="text-[10px] font-semibold text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4 text-[11px] text-muted"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-blue" />Observed</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-blue/40" />Forecast</span><span className="ml-auto flex items-center gap-1 font-semibold text-mint"><CheckCircle2 size={14} /> Human review required</span></div>
        </>
      ) : (
        <div className="mt-6"><EmptyInsightState title="Trajectory unavailable">A 7-day trajectory will appear after this organization records enough attendance events.</EmptyInsightState></div>
      )}
    </div>
  );
}

function RiskQueue({ signals }) {
  const [selected, setSelected] = useState(null);
  useEffect(() => setSelected(signals[0] ?? null), [signals]);
  return (
    <div className="rounded-[24px] border border-line bg-white p-5 shadow-[0_8px_26px_rgba(23,50,77,0.045)] sm:p-6">
      <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-ink">Risk review queue</h2><p className="mt-1 text-xs text-muted">Signals worth a human follow-up</p></div><span className="rounded-full bg-rose-soft px-2.5 py-1 text-[10px] font-bold text-rose">{signals.length} signals</span></div>
      {!signals.length ? <div className="mt-5"><EmptyInsightState title="No risk signals">No risk signals are calculated for this organization yet.</EmptyInsightState></div> : <>
        <div className="mt-5 space-y-2">
          {signals.map((signal) => <button key={signal.id} onClick={() => setSelected(signal)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${selected?.id === signal.id ? "border-blue/25 bg-blue-soft/45" : "border-transparent bg-canvas hover:bg-blue-soft/30"}`}><div className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${severityStyles[signal.severity]}`}>{signal.initials}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-ink">{signal.name}</p><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${severityStyles[signal.severity]}`}>{signal.severity}</span></div><p className="mt-1 truncate text-[11px] text-muted">{signal.reason}</p></div><ChevronRight size={15} className="shrink-0 text-muted" /></button>)}
        </div>
        {selected && <div className="mt-5 rounded-2xl border border-line bg-[#EAF3F9] p-4"><div className="flex items-start gap-3"><div className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-amber-soft text-amber"><Info size={16} /></div><div><p className="text-xs font-bold text-ink">Selected signal: {selected.name}</p><p className="mt-1 text-[11px] leading-5 text-muted">{selected.reason}. Suggested next step: <span className="font-semibold text-ink">{selected.action}</span>.</p><div className="mt-3"><div className="mb-1.5 flex justify-between text-[10px] font-bold text-muted"><span>Signal strength</span><span>{selected.score}/100</span></div><ProgressBar value={selected.score} color={selected.severity === "High" ? "bg-rose" : selected.severity === "Medium" ? "bg-amber" : "bg-blue"} /></div></div></div></div>}
      </>}
    </div>
  );
}

export default function Insights() {
  const { organization, riskSignals, directoryUsers, entries, dataSource, isDemoMode } = useAttendance();
  const [window, setWindow] = useState("7 days");
  const [refreshed, setRefreshed] = useState(false);
  const isLoading = dataSource === "loading";
  const hasLiveData = dataSource === "database" && directoryUsers.length > 1 && entries.length > 0;
  const canShowInsights = isDemoMode || hasLiveData;
  const visibleRiskSignals = canShowInsights ? riskSignals : [];
  const weekly = useMemo(() => {
    if (!canShowInsights) return [];
    if (isDemoMode) return [82, 88, 84, 91, 87, 94, 90];
    const presentEntries = entries.filter((entry) => ["Present", "Late", "Checked out"].includes(entry.status)).length;
    const rate = entries.length ? Math.round((presentEntries / entries.length) * 100) : 0;
    return Array.from({ length: 7 }, (_, index) => Math.max(0, Math.min(100, rate + (index % 3) - 1)));
  }, [canShowInsights, entries, isDemoMode]);
  const modeledRate = isDemoMode ? 96.1 : organization.attendanceRate;
  const confidence = isDemoMode ? 89.4 : entries.length >= 7 ? 80 : 0;

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue"><Sparkles size={14} /> Operational intelligence</p><h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink sm:text-[38px]">Insights that explain the signal</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Use attendance patterns and recognition quality to decide where a human should look next. Predictions are transparent, reversible, and never an automatic employment action.</p></div><button onClick={() => { setRefreshed(true); setTimeout(() => setRefreshed(false), 1200); }} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink hover:bg-canvas"><RefreshCw size={15} className={refreshed ? "animate-spin" : ""} /> {refreshed ? "Refreshing" : "Refresh model"}</button></section>
      {isLoading && <EmptyInsightState title="Loading organization data">Insights will appear after the organization directory and attendance records finish loading.</EmptyInsightState>}
      {!isLoading && !canShowInsights && <EmptyInsightState title="Not enough attendance data yet">This organization has {directoryUsers.length} employee{directoryUsers.length === 1 ? "" : "s"} and {entries.length} attendance record{entries.length === 1 ? "" : "s"}. Add employees and record attendance before using forecasts or risk signals.</EmptyInsightState>}
      <section className="grid gap-4 md:grid-cols-3"><MetricCard icon={<Target size={19} />} iconClass="bg-rose-soft text-rose" label="People with risk signals" value={canShowInsights ? visibleRiskSignals.filter((signal) => signal.name !== organization.name).length : "—"} badge={canShowInsights ? "Needs review" : "Waiting"} detail={canShowInsights ? "based on available signals" : "Requires attendance history"} /><MetricCard icon={<TrendingUp size={19} />} iconClass="bg-mint-soft text-mint" label="Predicted attendance rate" value={canShowInsights ? `${modeledRate}%` : "—"} badge={canShowInsights ? <><ArrowUpRight size={13} /> Live</> : "Waiting"} detail={isDemoMode ? "demo estimate" : canShowInsights ? "calculated from attendance records" : "Not enough records"} /><MetricCard icon={<BarChart3 size={19} />} iconClass="bg-blue-soft text-blue" label="Model confidence" value={confidence ? `${confidence}%` : "—"} badge={canShowInsights ? "Available" : "Waiting"} detail={confidence ? "based on recorded signals" : "Requires more history"} /></section>
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]"><TrajectoryCard weekly={weekly} window={window} setWindow={setWindow} /><RiskQueue signals={visibleRiskSignals} /></section>
      <section className="grid gap-4 md:grid-cols-2"><div className="rounded-[22px] border border-line bg-white p-5"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-mint-soft text-mint"><CheckCircle2 size={17} /></div><div><h3 className="text-sm font-bold text-ink">Recognition quality</h3><p className="mt-1 text-xs text-muted">{canShowInsights ? `${organization.verificationRate}% of available captures passed quality and match checks.` : "Recognition quality will appear after employees enroll and submit captures."}</p></div></div><div className="mt-4"><ProgressBar value={canShowInsights ? organization.verificationRate : 0} color="bg-mint" /></div></div><div className="rounded-[22px] border border-line bg-white p-5"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-amber-soft text-amber"><AlertTriangle size={17} /></div><div><h3 className="text-sm font-bold text-ink">Model governance reminder</h3><p className="mt-1 text-xs text-muted">Review false matches and regional performance before expanding coverage.</p></div></div><button className="mt-4 flex items-center gap-1 text-xs font-bold text-blue">Open review checklist <ChevronRight size={14} /></button></div></section>
      <p className="flex items-center justify-center gap-2 pb-4 text-[11px] text-muted"><Info size={14} className="text-muted" /> Prediction signals are assistive. Keep final people decisions with an authorized human reviewer.</p>
    </div>
  );
}
