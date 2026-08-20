import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Camera, Check, ChevronRight, Clock3, Fingerprint, MoreHorizontal, ScanFace, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAttendance } from "../context/AttendanceContext";
import { formatPakistanDate } from "../lib/time";

const statusStyles = {
  Present: "bg-mint-soft text-mint",
  "Checked out": "bg-blue-soft text-blue",
  Late: "bg-amber-soft text-amber",
  "Missing checkout": "bg-amber-soft text-amber",
  "On leave": "bg-[#EAF3F9] text-[#5AA9E6]",
  Unverified: "bg-rose-soft text-rose",
};

function MetricCard({ icon: Icon, label, value, helper, trend, tone = "blue" }) {
  const tones = { blue: "bg-blue-soft text-blue", mint: "bg-mint-soft text-mint", amber: "bg-amber-soft text-amber", ink: "bg-ink text-white" };
  return (
    <div className="rounded-[22px] border border-line bg-white p-5 shadow-[0_8px_26px_rgba(23,50,77,0.045)] transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3"><div className={`flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={19} /></div>{trend && <span className="rounded-full bg-mint-soft px-2 py-1 text-[10px] font-bold text-mint">{trend}</span>}</div>
      <p className="mt-5 text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[26px] font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{helper}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[status] ?? "bg-canvas text-muted"}`}>{status}</span>;
}

function leaveDayCount(requests) {
  return requests.reduce((total, request) => {
    const start = new Date(`${request.startDate}T00:00:00`);
    const end = new Date(`${request.endDate}T00:00:00`);
    return total + Math.max(1, Math.round((end - start) / 86400000) + 1);
  }, 0);
}

function LeaveOverview({ requests, isLoading, navigate }) {
  const types = [
    { label: "Annual leave", icon: CalendarDays, surface: "bg-blue-soft", color: "text-blue", type: "Annual leave" },
    { label: "Medical leave", icon: ShieldCheck, surface: "bg-rose-soft", color: "text-rose", type: "Medical leave" },
  ];

  return (
    <section className="rounded-[24px] border border-line bg-white p-5 shadow-[0_8px_26px_rgba(23,50,77,0.045)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue">Time off</p><h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-ink">Leave overview</h2><p className="mt-1 text-xs text-muted">Approved leave across the people in your current workspace.</p></div>
        <button onClick={() => navigate("/app/leave")} className="flex items-center gap-1 self-start rounded-xl border border-line px-3 py-2 text-xs font-bold text-blue transition-colors hover:bg-blue-soft" aria-label="Open leave management">Manage leave <ChevronRight size={14} /></button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {isLoading ? types.map(({ label }) => <div key={label} className="h-28 animate-pulse rounded-2xl bg-canvas" />) : types.map(({ label, icon: Icon, surface, color, type }) => {
          const approved = requests.filter((request) => request.status === "Approved" && request.type === type);
          const days = leaveDayCount(approved);
          return <button key={type} onClick={() => navigate("/app/leave")} className="group rounded-2xl border border-line bg-canvas/45 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-blue/25 hover:bg-blue-soft/35"><div className="flex items-start justify-between gap-3"><div className={`flex size-10 items-center justify-center rounded-xl ${surface} ${color}`}><Icon size={18} /></div><ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" /></div><p className="mt-4 text-sm font-bold text-ink">{label}</p><p className="mt-1 text-[26px] font-bold tracking-tight text-ink">{days} <span className="text-sm font-semibold text-muted">approved day{days === 1 ? "" : "s"}</span></p><p className="mt-1 text-[11px] text-muted">{approved.length ? `${approved.length} request${approved.length === 1 ? "" : "s"} approved` : "No approved requests yet"}</p></button>;
        })}
      </div>
    </section>
  );
}

function EmployeeHome({ navigate, dateLabel, currentUser, currentUserRecord, day, entries, todayComplete, isLoading, dataSource }) {
  if (isLoading) {
    return (
      <div className="mx-auto max-w-[980px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 motion-enter" aria-busy="true" aria-label="Loading attendance workspace">
        <section><div className="mb-3 h-3 w-40 animate-pulse rounded-full bg-line" /><div className="h-10 w-72 animate-pulse rounded-xl bg-line" /><div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded-full bg-line" /></section>
        <section className="grid gap-5 md:grid-cols-[1.25fr_0.75fr]">
          <div className="min-h-[286px] rounded-[28px] bg-ink p-6 shadow-[0_14px_38px_rgba(23,50,77,0.12)] sm:p-8"><div className="h-3 w-32 animate-pulse rounded-full bg-white/15" /><div className="mt-5 h-10 w-64 animate-pulse rounded-xl bg-white/15" /><div className="mt-4 h-4 w-full max-w-md animate-pulse rounded-full bg-white/10" /><div className="mt-7 h-11 w-32 animate-pulse rounded-xl bg-white/15" /></div>
          <div className="min-h-[286px] rounded-[28px] border border-line bg-white p-6 shadow-[0_8px_26px_rgba(23,50,77,0.045)] sm:p-8"><div className="h-3 w-32 animate-pulse rounded-full bg-line" /><div className="mt-5 h-7 w-40 animate-pulse rounded-lg bg-line" /><div className="mt-3 h-4 w-full animate-pulse rounded-full bg-line" /><div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-line" /></div>
        </section>
      </div>
    );
  }

  if (!currentUserRecord && dataSource === "unavailable") {
    return (
      <div className="mx-auto max-w-[980px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 motion-enter">
        <section><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted"><span className="size-1.5 rounded-full bg-amber" />{dateLabel}</div><h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink sm:text-[38px]">Good morning, {currentUser.name.split(" ")[0]}</h1></section>
        <section className="rounded-[28px] border border-amber/20 bg-amber-soft/35 p-6 shadow-[0_14px_38px_rgba(23,50,77,0.05)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber">Attendance unavailable</p><h2 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-ink">Reconnect to load your workspace</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted">Your attendance profile is not available yet. We will not show an enrollment prompt until the account data is synchronized.</p></section>
      </div>
    );
  }

  const isEnrolled = currentUserRecord?.recognitionStatus === "enrolled";
  const hasCheckedIn = Boolean(day.checkInAt) && !day.checkOutAt;
  const today = entries.find((entry) => entry.label === "Today") ?? { checkIn: "—", checkOut: "—", duration: "—", status: "Present" };
  const isOnLeave = today.status === "On leave";
  const hasTodayCheckIn = Boolean(today.checkInAt) && hasCheckedIn;
  const hasPreviousOpenEntry = hasCheckedIn && !hasTodayCheckIn;

  return (
    <div className="mx-auto max-w-[980px] space-y-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 motion-enter">
      <section><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted"><span className="size-1.5 rounded-full bg-mint" />{dateLabel}</div><h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink sm:text-[38px]">Good morning, {currentUser.name.split(" ")[0]}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Your attendance stays simple: enroll one photo first, then take a quick picture whenever you check in or out.</p></section>
      {!isEnrolled ? <section className="overflow-hidden rounded-[28px] border border-blue/15 bg-white shadow-[0_14px_38px_rgba(23,50,77,0.07)] motion-surface"><div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_220px] md:items-center"><div><div className="flex size-12 items-center justify-center rounded-2xl bg-blue-soft text-blue"><ScanFace size={24} /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-blue">First step</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink">Enroll your attendance photo</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted">Take one clear photo to set up your attendance profile. The backend will process the uploaded image according to your organization&apos;s retention policy.</p><button onClick={() => navigate("/verify?mode=enroll")} className="mt-6 flex items-center gap-2 rounded-xl bg-blue px-4 py-3 text-xs font-bold text-white shadow-[0_8px_20px_rgba(90,169,230,0.18)]"><Camera size={17} /> Enroll photo</button></div><div className="flex aspect-square items-center justify-center rounded-[24px] bg-[#EAF3F9]"><div className="flex size-28 items-center justify-center rounded-[34px] border border-blue/15 bg-white text-blue shadow-[0_12px_28px_rgba(90,169,230,0.10)]"><ScanFace size={54} /></div></div></div></section> : <section className="grid gap-5 md:grid-cols-[1.25fr_0.75fr]"><div className="rounded-[28px] bg-ink p-6 text-white shadow-[0_14px_38px_rgba(23,50,77,0.12)] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Today&apos;s attendance</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.03em]">{todayComplete ? "Day completed" : isOnLeave ? "On leave today" : hasTodayCheckIn ? "You are checked in" : hasPreviousOpenEntry ? "Checkout required" : "Ready to check in"}</h2></div><div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-[#BCE1F9]"><Check size={24} /></div></div><p className="mt-3 max-w-md text-sm leading-6 text-white/60">{todayComplete ? `You worked ${today.duration}. Your attendance record is complete.` : isOnLeave ? "An approved leave record covers today. Attendance capture is not required." : hasTodayCheckIn ? `Started at ${today?.checkIn ?? "today"}. Take another photo when you finish.` : hasPreviousOpenEntry ? "You have not checked in today. Check out your previous open attendance record before starting a new day." : "Your attendance photo is enrolled and ready to use."}</p>{todayComplete || isOnLeave ? <div className="mt-7 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white/80"><Check size={17} /> {isOnLeave ? "Approved leave" : "Attendance recorded for today"}</div> : <button onClick={() => navigate(`/verify?mode=${hasCheckedIn ? "check-out" : "check-in"}`)} className="mt-7 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-ink shadow-[0_8px_20px_rgba(0,0,0,0.12)]"><Camera size={17} /> {hasCheckedIn ? "Check out" : "Check in"}</button>}</div><div className="rounded-[28px] border border-line bg-white p-6 shadow-[0_8px_26px_rgba(23,50,77,0.045)]"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue">Attendance profile</p><p className="mt-3 text-lg font-bold text-ink">Photo enrolled</p><p className="mt-1 text-sm leading-6 text-muted">Your next attendance capture can be checked against this profile by the backend.</p><div className="mt-6 flex items-center gap-2 text-xs font-bold text-mint"><Check size={15} /> Ready for attendance</div><button onClick={() => navigate("/verify?mode=enroll")} className="mt-6 text-xs font-bold text-blue">Retake enrollment photo <ArrowUpRight size={13} className="inline" /></button></div></section>}
      <section className="rounded-[24px] border border-line bg-white shadow-[0_8px_26px_rgba(23,50,77,0.045)]"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="text-base font-bold text-ink">Recent attendance</h2><p className="mt-1 text-xs text-muted">Only your own attendance records are visible here.</p></div><button onClick={() => navigate("/app/history")} className="text-xs font-bold text-blue">View history <ChevronRight size={13} className="inline" /></button></div><div className="divide-y divide-line">{entries.slice(0, 3).map((entry) => <div key={entry.id} className="flex items-center justify-between px-5 py-4"><div><p className="text-xs font-bold text-ink">{entry.label}</p><p className="mt-1 text-[11px] text-muted">{entry.checkIn} – {entry.checkOut}</p></div><div className="text-right"><p className="text-xs font-bold text-ink">{entry.duration}</p><StatusBadge status={entry.status} /></div></div>)}</div></section>
      <p className="flex items-center justify-center gap-2 pb-4 text-[11px] text-muted"><ShieldCheck size={14} className="text-mint" /> Attendance records are personal and are not used as automatic employment decisions.</p>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { organization, teamAttendance, riskSignals, activeRoleMeta, activeRole, currentUser, currentUserRecord, day, entries, todayComplete, leaveRequests, isLoading, dataSource, can, isDemoMode } = useAttendance();
  const [range, setRange] = useState("7 days");
  const [showAll, setShowAll] = useState(false);
  const visibleTeam = showAll ? teamAttendance : teamAttendance.slice(0, 5);
  const coverage = useMemo(() => ({
    present: teamAttendance.filter((member) => ["Present", "Checked out"].includes(member.status)).length,
    late: teamAttendance.filter((member) => member.status === "Late").length,
    leave: teamAttendance.filter((member) => member.status === "On leave").length,
    unverified: teamAttendance.filter((member) => ["Unverified", "Not checked in"].includes(member.status)).length,
  }), [teamAttendance]);
  const hasCoverageData = coverage.present + coverage.late + coverage.leave > 0;
  const selfOnLeave = entries.some((entry) => entry.label === "Today" && entry.status === "On leave");
  const showLeaveOverview = ["enterprise_admin", "hr", "manager"].includes(activeRole);
  const needsSelfEnrollment = can("enroll_self") && currentUserRecord?.recognitionStatus !== "enrolled";
  const hasSelfCheckedIn = can("capture_self_attendance") && Boolean(day.checkInAt) && !day.checkOutAt;
  const selfAttendancePath = needsSelfEnrollment ? "/verify?mode=enroll" : hasSelfCheckedIn ? "/verify?mode=check-out" : "/verify?mode=check-in";
  const selfAttendanceLabel = needsSelfEnrollment ? "Enroll attendance photo" : hasSelfCheckedIn ? "Check out" : can("capture_self_attendance") ? "Record my attendance" : "Open attendance";
  const dateLabel = useMemo(() => formatPakistanDate(new Date(), { weekday: "long", month: "long", day: "numeric" }), []);

  if (activeRole === "employee") return <EmployeeHome navigate={navigate} dateLabel={dateLabel} currentUser={currentUser} currentUserRecord={currentUserRecord} day={day} entries={entries} todayComplete={todayComplete} isLoading={isLoading} dataSource={dataSource} />;

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted"><span className="size-1.5 rounded-full bg-mint" />{dateLabel}</div><h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink sm:text-[38px]">Good morning, {currentUser.name.split(" ")[0]}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Here is the health of <span className="font-semibold text-ink">{organization.name}</span>. Your workspace is in <span className="font-semibold text-blue">{activeRoleMeta.label.toLowerCase()} view</span>.</p></div>
        <div className="flex items-center gap-2">{todayComplete ? <div className="flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-2.5 text-xs font-bold text-mint"><Check size={16} /> Attendance recorded for today</div> : selfOnLeave ? <div className="flex items-center gap-2 rounded-xl bg-blue-soft px-4 py-2.5 text-xs font-bold text-blue"><CalendarDays size={16} /> On leave today</div> : <button onClick={() => navigate(selfAttendancePath)} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(23,50,77,0.12)] transition-transform active:scale-[0.98]"><ScanFace size={16} /> {selfAttendanceLabel}</button>}<button onClick={() => navigate("/app/insights")} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-canvas"><ArrowUpRight size={15} /> View insights</button></div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <MetricCard icon={Users} label="Active today" value={organization.activeToday ?? 0} helper={`of ${organization.employees ?? 0} people`} trend={isDemoMode ? "+6.4%" : undefined} tone="blue" />
        <MetricCard icon={CalendarDays} label="Attendance rate" value={`${organization.attendanceRate ?? 0}%`} helper={isDemoMode ? "vs 92.8% last week" : "Based on current records"} trend={isDemoMode ? "+1.8%" : undefined} tone="mint" />
        <MetricCard icon={ScanFace} label="Verified captures" value={`${organization.verificationRate ?? 0}%`} helper={isDemoMode ? "recognition confidence" : "Based on enrolled profiles"} trend={isDemoMode ? "+0.6%" : undefined} tone="ink" />
        <MetricCard icon={Clock3} label="Average check-in" value={isDemoMode ? organization.avgCheckIn : (hasCoverageData ? organization.avgCheckIn : "—")} helper={isDemoMode ? "12 min earlier than last week" : "No attendance time recorded yet"} tone="amber" />
      </section>

      {showLeaveOverview && <LeaveOverview requests={leaveRequests} isLoading={isLoading} navigate={navigate} />}

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-[24px] border border-line bg-white shadow-[0_8px_26px_rgba(23,50,77,0.045)]">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="flex items-center gap-2"><h2 className="text-base font-bold text-ink">Today&apos;s coverage</h2><span className="rounded-full bg-mint-soft px-2 py-1 text-[10px] font-bold text-mint">Live</span></div><p className="mt-1 text-xs text-muted">Recognition events across your organization</p></div><div className="flex items-center gap-2"><div className="flex rounded-xl bg-canvas p-1">{["Today", "7 days", "30 days"].map((item) => <button key={item} onClick={() => setRange(item)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors ${range === item ? "bg-white text-ink shadow-sm" : "text-muted"}`}>{item}</button>)}</div><button className="rounded-xl border border-line p-2 text-muted hover:text-ink" aria-label="More coverage actions"><MoreHorizontal size={16} /></button></div></div>
          <div className="grid grid-cols-2 gap-3 border-b border-line bg-[#EAF3F9] px-5 py-4 sm:grid-cols-4 sm:px-6"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Present</p><p className="mt-1 text-lg font-bold text-ink">{coverage.present}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Late</p><p className="mt-1 text-lg font-bold text-amber">{coverage.late}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">On leave</p><p className="mt-1 text-lg font-bold text-blue">{coverage.leave}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Unverified</p><p className="mt-1 text-lg font-bold text-rose">{coverage.unverified}</p></div></div>
          <div className="divide-y divide-line">
            {isLoading ? [1, 2, 3].map((item) => <div key={item} className="flex items-center gap-3 px-5 py-4 sm:px-6"><div className="size-9 animate-pulse rounded-xl bg-line" /><div className="flex-1 space-y-2"><div className="h-3 w-32 animate-pulse rounded bg-line" /><div className="h-2 w-24 animate-pulse rounded bg-line" /></div></div>) : visibleTeam.length ? visibleTeam.map((member) => <div key={member.id} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-[#EAF3F9] sm:px-6"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-soft text-[11px] font-bold text-blue">{member.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-ink">{member.name}</p><p className="mt-0.5 truncate text-[11px] text-muted">{member.department} · {member.detail}</p></div><div className="hidden items-center gap-2 sm:flex"><span className="text-[10px] font-semibold text-muted">{member.confidence ? `${member.confidence}% match` : "Needs review"}</span><StatusBadge status={member.status} /></div><button onClick={() => navigate("/app/team")} className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label={`Open ${member.name}`}><ChevronRight size={16} /></button></div>) : <div className="px-5 py-10 text-center sm:px-6"><p className="text-sm font-bold text-ink">No attendance activity yet</p><p className="mt-1 text-xs text-muted">Your organization’s people will appear here after accounts are created and attendance is recorded.</p></div>}
          </div>
          <button onClick={() => setShowAll((value) => !value)} className="flex w-full items-center justify-center gap-2 border-t border-line px-5 py-3 text-xs font-bold text-blue hover:bg-blue-soft/40">{showAll ? "Show less" : "View all people"}<ChevronRight size={14} /></button>
        </div>

        <div className="space-y-5">
          <div className="rounded-[24px] border border-line bg-ink p-5 text-white shadow-[0_12px_34px_rgba(23,50,77,0.12)] sm:p-6"><div className="flex items-start justify-between"><div className="flex size-10 items-center justify-center rounded-xl bg-white/10"><Fingerprint size={20} /></div><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[#BCE1F9]">{isDemoMode ? "98.2% reliable" : hasCoverageData ? `${organization.verificationRate ?? 0}% recorded` : "Awaiting data"}</span></div><p className="mt-6 text-xs font-semibold text-white/55">Recognition quality</p><div className="mt-1 flex items-end justify-between gap-4"><p className="text-[30px] font-bold tracking-tight">{isDemoMode ? "Excellent" : hasCoverageData ? "Available" : "Not enough data"}</p><p className="text-right text-[11px] leading-4 text-white/55">{hasCoverageData ? `Based on ${organization.activeToday ?? 0} verified events` : "No verified attendance events"}<br />this {range.toLowerCase()}</p></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-[#BCE1F9] ${isDemoMode ? "w-[86%]" : hasCoverageData ? "w-[40%]" : "w-0"}`} /></div><div className="mt-3 flex items-center gap-2 text-[11px] text-white/60"><ShieldCheck size={14} className="text-[#BCE1F9]" />{isDemoMode ? "Quality checks and fallback paths are active" : "Quality metrics appear after verified attendance"}</div></div>

          <div className="rounded-[24px] border border-line bg-white p-5 shadow-[0_8px_26px_rgba(23,50,77,0.045)]"><div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-ink">Attention needed</h2><p className="mt-1 text-xs text-muted">Signals from your latest model run</p></div><button onClick={() => navigate("/app/insights")} className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label="Open prediction insights"><ArrowUpRight size={16} /></button></div><div className="mt-4 space-y-3">{riskSignals.length ? riskSignals.slice(0, 2).map((signal) => <button key={signal.id} onClick={() => navigate("/app/insights")} className="flex w-full items-center gap-3 rounded-2xl bg-canvas p-3 text-left transition-colors hover:bg-blue-soft/50"><div className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${signal.severity === "High" ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber"}`}>{signal.initials}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-ink">{signal.name}</p><p className="mt-0.5 truncate text-[11px] text-muted">{signal.reason}</p></div><ChevronRight size={15} className="shrink-0 text-muted" /></button>) : <div className="rounded-2xl bg-canvas p-4"><p className="text-sm font-bold text-ink">No signals yet</p><p className="mt-1 text-xs leading-5 text-muted">Risk insights will appear after enough organization attendance history is available.</p></div>}</div><button onClick={() => navigate("/app/insights")} className="mt-4 flex items-center gap-1 text-xs font-bold text-blue">Open risk review <ArrowUpRight size={13} /></button></div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3"><button onClick={() => navigate("/app/team")} className="group flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 text-left shadow-[0_8px_26px_rgba(23,50,77,0.035)] transition-all hover:-translate-y-0.5 hover:border-blue/30"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-soft text-blue"><Users size={18} /></div><div className="flex-1"><p className="text-xs font-bold text-ink">Manage people</p><p className="mt-1 text-[11px] text-muted">Roles, teams, and verification</p></div><ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" /></button><button onClick={() => navigate("/app/leave")} className="group flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 text-left shadow-[0_8px_26px_rgba(23,50,77,0.035)] transition-all hover:-translate-y-0.5 hover:border-blue/30"><div className="flex size-10 items-center justify-center rounded-xl bg-mint-soft text-mint"><CalendarDays size={18} /></div><div className="flex-1"><p className="text-xs font-bold text-ink">Review leave</p><p className="mt-1 text-[11px] text-muted">{leaveRequests.length ? `${leaveRequests.length} request${leaveRequests.length === 1 ? "" : "s"} on file` : "No leave requests yet"}</p></div><ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" /></button><button onClick={() => navigate("/app/insights")} className="group flex items-center gap-3 rounded-[20px] border border-line bg-white p-4 text-left shadow-[0_8px_26px_rgba(23,50,77,0.035)] transition-all hover:-translate-y-0.5 hover:border-blue/30"><div className="flex size-10 items-center justify-center rounded-xl bg-[#EAF3F9] text-[#5AA9E6]"><Fingerprint size={18} /></div><div className="flex-1"><p className="text-xs font-bold text-ink">Review insights</p><p className="mt-1 text-[11px] text-muted">Attendance patterns and signals</p></div><ChevronRight size={16} className="text-muted transition-transform group-hover:translate-x-0.5" /></button></section>

      <p className="flex items-center justify-center gap-2 pb-4 text-[11px] text-muted"><ShieldCheck size={14} className="text-mint" /> Attendance and recognition signals are shown for operational guidance, not automated employment decisions.</p>
    </div>
  );
}
