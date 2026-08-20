import { useEffect, useState } from "react";
import { FrostedCard, PageTitle, PrimaryButton, StatusPill, Skeleton } from "../components/ui/app-ui";
import { palette } from "../constants";
import { IconSymbol } from "../components/ui/icon-symbol";
import { useAttendance } from "../context/AttendanceContext";

export default function Leave() {
  const { isLoading, leaveRequests, managerLeaveRequests, submitLeave, reviewManagerLeave, activeRole, leavePolicy, updateLeavePolicy, isOnline, offlineQueueCount } = useAttendance();
  const isOrganizationOwner = activeRole === "enterprise_admin";
  const canManageLeavePolicy = ["enterprise_admin", "hr"].includes(activeRole);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("Annual leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [annualDays, setAnnualDays] = useState(String(leavePolicy.annualDays));
  const [medicalDays, setMedicalDays] = useState(String(leavePolicy.medicalDays));
  const [policyMessage, setPolicyMessage] = useState("");
  const [policyError, setPolicyError] = useState("");
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [reviewingLeaveId, setReviewingLeaveId] = useState(null);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    setAnnualDays(String(leavePolicy.annualDays));
    setMedicalDays(String(leavePolicy.medicalDays));
  }, [leavePolicy.annualDays, leavePolicy.medicalDays]);

  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    setPolicyMessage("");
    setPolicyError("");
    const annual = Number(annualDays);
    const medical = Number(medicalDays);
    if (!Number.isInteger(annual) || !Number.isInteger(medical) || annual < 0 || annual > 365 || medical < 0 || medical > 365) {
      setPolicyError("Use whole-day allowances between 0 and 365.");
      return;
    }
    setIsSavingPolicy(true);
    const result = await updateLeavePolicy(annual, medical);
    setIsSavingPolicy(false);
    if (!result.ok) {
      setPolicyError(result.error);
      return;
    }
    setPolicyMessage("Leave allowances updated.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!startDate || !endDate || endDate < startDate) {
      setError("Choose a valid start and end date.");
      return;
    }
    const result = await submitLeave({ type, startDate, endDate, note });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setShowForm(false);
    setNote("");
    setMessage(result.queued ? "Saved on this device. It will sync automatically when you reconnect." : "Leave request submitted.");
  };

  const handleReview = async (id, decision) => {
    setReviewingLeaveId(id);
    setReviewError("");
    const result = await reviewManagerLeave(id, decision);
    setReviewingLeaveId(null);
    if (!result.ok) setReviewError(result.error);
  };

  const canReviewLeave = ["enterprise_admin", "hr", "manager"].includes(activeRole);

  return (
    <div className="flex flex-col p-6 md:p-8 bg-canvas min-h-full max-w-6xl mx-auto pb-safe">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <PageTitle eyebrow={isOrganizationOwner ? "Organization time off" : "Time Off"} title={isOrganizationOwner ? "Leave management" : "Leave"} />
        {!showForm && (
          <PrimaryButton
            label="Request leave"
            icon="plus"
            onPress={() => setShowForm(true)}
            className="md:min-w-[200px]"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Balances (always visible) or Form */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {!showForm ? (
            <>
              <h2 className="text-ink text-[18px] font-bold">{isOrganizationOwner ? "Available leave types" : "Your Balances"}</h2>
              <div className="flex flex-col gap-4">
                {isLoading ? (
                  <>
                    <FrostedCard className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-24 h-4" />
                      </div>
                      <Skeleton className="w-20 h-8 mb-2" />
                      <Skeleton className="w-32 h-3" />
                    </FrostedCard>
                    <FrostedCard className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-24 h-4" />
                      </div>
                      <Skeleton className="w-20 h-8 mb-2" />
                      <Skeleton className="w-32 h-3" />
                    </FrostedCard>
                  </>
                ) : (
                  <>
                    <FrostedCard className="p-5 hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-soft flex items-center justify-center">
                          <IconSymbol name="sun.max.fill" size={16} color={palette.blue} />
                        </div>
                        <p className="text-ink text-[15px] font-bold">Annual leave</p>
                      </div>
                      <><p className="text-ink text-[28px] font-bold tracking-tight">{leavePolicy.annualDays} <span className="text-muted text-[16px] font-semibold">days</span></p><p className="text-muted text-[12px] mt-2">Organization allowance through Dec 31</p></>
                    </FrostedCard>
                    
                    <FrostedCard className="p-5 hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-soft flex items-center justify-center">
                          <IconSymbol name="cross.case.fill" size={16} color={palette.rose} />
                        </div>
                        <p className="text-ink text-[15px] font-bold">Medical leave</p>
                      </div>
                      <><p className="text-ink text-[28px] font-bold tracking-tight">{leavePolicy.medicalDays} <span className="text-muted text-[16px] font-semibold">days</span></p><p className="text-muted text-[12px] mt-2">Organization allowance through Dec 31</p></>
                    </FrostedCard>
                  </>
                )}
              </div>
              {canManageLeavePolicy && (
                <FrostedCard className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-soft flex items-center justify-center">
                      <IconSymbol name="slider.horizontal.3" size={16} color={palette.blue} />
                    </div>
                    <div>
                      <p className="text-ink text-[15px] font-bold">Leave allowances</p>
                      <p className="text-muted text-[12px] mt-1">Set the annual organization allowance.</p>
                    </div>
                  </div>
                  <form onSubmit={handlePolicySubmit} className="flex flex-col gap-3">
                    <label className="text-ink text-[13px] font-bold">Annual leave (days)<input type="number" min="0" max="365" step="1" value={annualDays} onChange={(e) => setAnnualDays(e.target.value)} className="mt-2 w-full h-11 px-3 bg-canvas border border-line rounded-xl text-ink text-[14px] focus:outline-none focus:border-blue" /></label>
                    <label className="text-ink text-[13px] font-bold">Medical leave (days)<input type="number" min="0" max="365" step="1" value={medicalDays} onChange={(e) => setMedicalDays(e.target.value)} className="mt-2 w-full h-11 px-3 bg-canvas border border-line rounded-xl text-ink text-[14px] focus:outline-none focus:border-blue" /></label>
                    {policyError && <p className="text-xs font-semibold text-rose">{policyError}</p>}
                    {policyMessage && <p className="text-xs font-semibold text-mint">{policyMessage}</p>}
                    <PrimaryButton type="submit" label={isSavingPolicy ? "Saving…" : "Save allowances"} icon="checkmark" disabled={isSavingPolicy} className="mt-1" />
                  </form>
                </FrostedCard>
              )}
            </>
          ) : (
            <FrostedCard className="p-6 md:p-8 col-span-1 bg-white/95">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-ink text-[20px] font-bold">New Request</h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center bg-line/50 rounded-full hover:bg-line transition-colors">
                  <IconSymbol name="xmark" size={14} color={palette.ink} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-ink text-[14px] font-bold mb-2">Leave type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full h-[52px] px-4 bg-canvas border border-line rounded-xl text-ink text-[15px] focus:outline-none focus:border-blue transition-colors appearance-none font-medium"
                  >
                    <option value="Annual leave">Annual leave</option>
                    <option value="Medical leave">Medical leave</option>
                    <option value="Personal leave">Personal leave</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-ink text-[14px] font-bold">Start date<input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-2 w-full h-[52px] px-4 bg-canvas border border-line rounded-xl text-ink text-[15px] focus:outline-none focus:border-blue" /></label>
                  <label className="block text-ink text-[14px] font-bold">End date<input required type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-2 w-full h-[52px] px-4 bg-canvas border border-line rounded-xl text-ink text-[15px] focus:outline-none focus:border-blue" /></label>
                </div>

                <div>
                  <label className="block text-ink text-[14px] font-bold mb-2">Note (optional)</label>
                    <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add any relevant details..."
                    maxLength={1000}
                    className="w-full min-h-[100px] p-4 bg-canvas border border-line rounded-xl text-ink text-[15px] focus:outline-none focus:border-blue transition-colors resize-none placeholder:text-muted"
                  />
                </div>

                {error && <p className="text-sm font-semibold text-rose">{error}</p>}
                <div className="mt-4 flex flex-col gap-3">
                  <PrimaryButton type="submit" label="Submit request" />
                  <button type="button" onClick={() => setShowForm(false)} className="h-[54px] rounded-xl text-ink font-bold hover:bg-line/50 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </FrostedCard>
          )}
        </div>

        {/* Right Column: Past Requests */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-ink text-[18px] font-bold mb-2">{isOrganizationOwner ? "Organization requests" : "Your Requests"}</h2>
          {canReviewLeave && (
            <FrostedCard className="p-5 md:p-6 mb-2">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-ink text-[16px] font-bold">Leave approvals</p>
                  <p className="text-muted text-[12px] mt-1">Review requests within your organization or managed team.</p>
                </div>
                <IconSymbol name="checkmark.seal.fill" size={20} color={palette.blue} />
              </div>
              {reviewError && <p className="mb-3 rounded-xl border border-rose/20 bg-rose-soft px-3 py-2 text-xs font-semibold text-rose">{reviewError}</p>}
              {managerLeaveRequests.length === 0 ? (
                <p className="text-muted text-[13px]">No leave requests to review.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {managerLeaveRequests.map((req) => {
                    const pending = req.status === "Pending";
                    const busy = reviewingLeaveId === req.id;
                    return (
                      <div key={req.id} className="rounded-2xl border border-line bg-canvas/70 p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <p className="text-ink text-[14px] font-bold">{req.employee || "Employee"}</p>
                            <p className="text-ink text-[13px] mt-1">{req.type} · {req.dates}</p>
                            {req.note && <p className="text-muted text-[12px] mt-2 italic">“{req.note}”</p>}
                            {req.submitted && <p className="text-muted text-[11px] mt-2">Submitted {req.submitted}</p>}
                          </div>
                          <StatusPill label={req.status} tone={req.status === "Approved" ? "mint" : req.status === "Declined" ? "rose" : "blue"} />
                        </div>
                        {pending && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            <button type="button" disabled={busy} onClick={() => handleReview(req.id, "Approved")} className="flex-1 h-10 rounded-xl bg-mint-soft text-mint text-[13px] font-bold hover:opacity-80 disabled:opacity-50">{busy ? "Saving…" : "Approve"}</button>
                            <button type="button" disabled={busy} onClick={() => handleReview(req.id, "Declined")} className="flex-1 h-10 rounded-xl bg-rose-soft text-rose text-[13px] font-bold hover:opacity-80 disabled:opacity-50">Reject</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </FrostedCard>
          )}
          {message && <p className="rounded-xl border border-mint/30 bg-mint/10 px-3 py-2 text-xs font-semibold text-mint">{message}</p>}
          {(!isOnline || offlineQueueCount > 0) && <p className="rounded-xl border border-amber-200 bg-vanilla-soft px-3 py-2 text-xs font-semibold text-[#735C00]">{isOnline ? `${offlineQueueCount} leave change${offlineQueueCount === 1 ? "" : "s"} waiting to sync.` : "You are offline. New leave requests will be saved locally and synced when you reconnect."}</p>}
          <div className="flex flex-col gap-4">
            {isLoading ? (
              [...Array(2)].map((_, i) => (
                <FrostedCard key={i} className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                      <div>
                        <Skeleton className="w-32 h-5 mb-2" />
                        <Skeleton className="w-24 h-4 mb-2" />
                        <Skeleton className="w-48 h-3" />
                      </div>
                    </div>
                    <Skeleton className="w-20 h-6 rounded-full self-end md:self-auto" />
                  </div>
                </FrostedCard>
              ))
            ) : leaveRequests.length === 0 ? (
              <FrostedCard className="flex flex-col items-center justify-center p-12 text-center">
                <IconSymbol name="tray.fill" size={32} color={palette.muted} />
                <p className="text-ink text-[16px] font-bold mt-4">No leave requests</p>
                <p className="text-muted text-[14px] mt-2">When you request time off, it will appear here.</p>
              </FrostedCard>
            ) : (
              leaveRequests.map((req) => (
                <FrostedCard key={req.id} className="p-5 md:p-6 transition-shadow hover:shadow-lg">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${req.status === "Approved" ? "bg-mint-soft" : req.status === "Declined" ? "bg-rose-soft" : "bg-[#F1F3F8]"}`}>
                        <IconSymbol
                          name={req.status === "Approved" ? "checkmark" : req.status === "Declined" ? "xmark" : "hourglass"}
                          size={20}
                          color={req.status === "Approved" ? palette.mint : req.status === "Declined" ? palette.rose : palette.muted}
                        />
                      </div>
                      <div>
                        <p className="text-ink text-[16px] font-bold">{req.type}</p>
                        <p className="text-muted text-[14px] mt-1">{req.dates}</p>
                        {req.note && <p className="text-muted text-[13px] mt-2 italic">“{req.note}”</p>}
                      </div>
                    </div>
                    
                    <div className="self-end md:self-auto">
                      <StatusPill
                        label={req.status}
                        tone={req.status === "Approved" ? "mint" : req.status === "Declined" ? "rose" : "blue"}
                      />
                    </div>
                  </div>
                </FrostedCard>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
