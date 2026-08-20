import { useMemo, useState } from "react";
import { ArrowRight, Camera, Check, Sparkles, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAttendance } from "../context/AttendanceContext";

const TOUR_KEY = "secure-attendance-empty-workspace-tour";

export default function OnboardingTour({ onComplete, forceTour = false }) {
  const navigate = useNavigate();
  const { organization, directoryUsers, entries, dataSource, isDemoMode, isLoading, activeRole, currentUser } = useAttendance();
  const storageKey = useMemo(() => `${TOUR_KEY}:${organization?.id || "workspace"}`, [organization?.id]);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem(storageKey) === "done");

  const isEmptyWorkspace = !isDemoMode && !isLoading && dataSource === "database" && activeRole !== "employee" && directoryUsers.length <= 1 && entries.length === 0;
  if ((!forceTour && (!isEmptyWorkspace || dismissed)) || !currentUser) return null;

  const steps = [
    { icon: Sparkles, eyebrow: "A clear starting point", title: "Your workspace is ready", body: "This is your private organization workspace. We’ll keep the first setup focused: add people, enroll photos, then watch attendance arrive here." },
    { icon: Users, eyebrow: "Step 1", title: "Create your first account", body: "Owners and HR can create employee accounts. Managers can then assign people who already exist to their teams.", action: "Add a person", path: "/app/team" },
    { icon: Camera, eyebrow: "Step 2", title: "Enroll one clear photo", body: "Each person captures a consented photo once. Future check-ins are uploaded to the backend for real biometric verification.", action: "Open attendance", path: "/verify?mode=enroll" },
  ];
  const current = steps[step];
  const Icon = current.icon;
  const finish = () => { window.localStorage.setItem(storageKey, "done"); setDismissed(true); onComplete?.(); };

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Workspace tour">
    <div className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_24px_80px_rgba(23,50,77,0.2)] motion-enter">
      <div className="flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-7"><div className="flex gap-1.5" aria-label={`Tour step ${step + 1} of ${steps.length}`}>{steps.map((item, index) => <span key={item.title} className={`h-1.5 rounded-full transition-all duration-200 ${index === step ? "w-7 bg-blue" : "w-1.5 bg-line"}`} />)}</div><button type="button" onClick={finish} className="rounded-xl p-2 text-muted transition-colors hover:bg-canvas hover:text-ink" aria-label="Close workspace tour"><X size={18} /></button></div>
      <div className="p-5 sm:p-7"><div className="flex size-14 items-center justify-center rounded-2xl bg-blue-soft text-blue"><Icon size={27} /></div><p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-blue">{current.eyebrow}</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-[28px]">{current.title}</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted">{current.body}</p>{current.action && <button type="button" onClick={() => { finish(); navigate(current.path); }} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue px-4 py-3 text-xs font-bold text-white shadow-[0_8px_20px_rgba(90,169,230,0.18)] transition-transform active:scale-[0.98]">{current.action} <ArrowRight size={15} /></button>}<div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-4"><button type="button" onClick={finish} className="text-xs font-bold text-muted hover:text-ink">Skip for now</button>{step < steps.length - 1 ? <button type="button" onClick={() => setStep((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white transition-transform active:scale-[0.98]">Next <ArrowRight size={14} /></button> : <button type="button" onClick={finish} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white transition-transform active:scale-[0.98]"><Check size={14} /> Done</button>}</div></div>
    </div>
  </div>;
}
