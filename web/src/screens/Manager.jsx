import { FrostedCard, PageTitle, StatusPill, Skeleton } from "../components/ui/app-ui";
import { useEffect, useState } from "react";
import { palette } from "../constants";
import { IconSymbol } from "../components/ui/icon-symbol";
import { useAttendance } from "../context/AttendanceContext";

function statusTone(status) {
  if (status === "Late") return "amber";
  if (status === "On leave") return "blue";
  if (status === "Declined") return "rose";
  return "mint";
}

function Metric({ label, value, color }) {
  return (
    <div className="flex flex-row items-center gap-2 bg-white/50 px-3 py-2 rounded-lg">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-ink text-[16px] font-bold">{value}</span>
      <span className="text-muted text-[13px] font-medium">{label}</span>
    </div>
  );
}

const attendanceStartOptions = Array.from({ length: 13 }, (_, index) => {
  const minutes = 6 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function AttendanceSchedule({ attendancePolicy, updateAttendancePolicy }) {
  const [selectedTime, setSelectedTime] = useState(attendancePolicy.startTime);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setSelectedTime(attendancePolicy.startTime);
  }, [attendancePolicy.startTime]);

  const save = async () => {
    setIsSaving(true);
    setFeedback(null);
    const result = await updateAttendancePolicy(selectedTime);
    setFeedback(result.ok ? { tone: "success", text: "Attendance start time updated." } : { tone: "error", text: result.error });
    setIsSaving(false);
  };

  return (
    <FrostedCard className="mb-8 p-5 lg:p-6 bg-white/95">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-11 h-11 bg-blue-soft rounded-xl shrink-0">
            <IconSymbol name="clock.fill" size={20} color={palette.blue} />
          </div>
          <div>
            <p className="text-ink text-[16px] font-bold">Attendance schedule</p>
            <p className="text-muted text-[13px] mt-1">Late status starts after {attendancePolicy.startTime} ({attendancePolicy.timezone}).</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            aria-label="Attendance start time"
            value={selectedTime}
            onChange={(event) => setSelectedTime(event.target.value)}
            className="min-h-[44px] rounded-xl border border-line bg-canvas px-3 text-ink text-[14px] font-semibold outline-none focus:border-blue"
          >
            {attendanceStartOptions.map((time) => <option key={time} value={time}>{time} PKT</option>)}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={isSaving || selectedTime === attendancePolicy.startTime}
            className="min-h-[44px] rounded-xl bg-ink px-4 text-white text-[14px] font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
      {feedback && <p className={`mt-3 text-[13px] font-semibold ${feedback.tone === "success" ? "text-mint" : "text-rose"}`}>{feedback.text}</p>}
    </FrostedCard>
  );
}

export default function Manager() {
  const { isLoading, managerLeaveRequests, reviewManagerLeave, teamAttendance, can, attendancePolicy, updateAttendancePolicy } = useAttendance();
  const pendingRequests = managerLeaveRequests.filter((request) => request.status === "Pending");
  const presentCount = teamAttendance.filter((member) => member.status === "Present" || member.status === "Checked out").length;
  const lateCount = teamAttendance.filter((member) => member.status === "Late").length;
  const leaveCount = teamAttendance.filter((member) => member.status === "On leave").length;

  const review = (id, status) => {
    reviewManagerLeave(id, status);
  };

  return (
    <div className="flex flex-col p-6 md:p-8 bg-canvas min-h-full max-w-7xl mx-auto pb-safe">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <PageTitle eyebrow="Manager workspace" title="Your Team" />
        <StatusPill label="Local Demo Environment" tone="blue" />
      </div>

      <FrostedCard className="mb-8 p-6 lg:p-8 bg-white/95">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="text-muted text-[11px] font-bold tracking-wider mb-2 uppercase">TODAY’S COVERAGE</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 bg-blue-soft rounded-2xl shrink-0">
                <IconSymbol name="person.3.fill" size={26} color={palette.blue} />
              </div>
              <div>
                {isLoading ? (
                  <>
                    <Skeleton className="w-48 h-8 mb-2" />
                    <Skeleton className="w-64 h-4" />
                  </>
                ) : (
                  <>
                    <p className="text-ink text-[28px] font-bold tracking-tight">{presentCount} active members</p>
                    <p className="text-muted text-[14px] mt-1">Review local attendance and leave decisions below.</p>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-row flex-wrap md:flex-col lg:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
            {isLoading ? (
              <>
                <Skeleton className="w-24 h-10" />
                <Skeleton className="w-24 h-10" />
                <Skeleton className="w-24 h-10" />
              </>
            ) : (
              <>
                <Metric label="Present" value={presentCount} color={palette.mint} />
                <Metric label="Late" value={lateCount} color={palette.amber} />
                <Metric label="On leave" value={leaveCount} color={palette.blue} />
              </>
            )}
          </div>
        </div>
      </FrostedCard>

      {can("manage_attendance_policy") && <AttendanceSchedule attendancePolicy={attendancePolicy} updateAttendancePolicy={updateAttendancePolicy} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Leave Approvals */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-ink text-[20px] font-bold tracking-tight">Leave Approvals</h2>
              {!isLoading && <p className="text-muted text-[14px] mt-1">{pendingRequests.length ? `${pendingRequests.length} awaiting your review` : "All caught up"}</p>}
            </div>
            {!isLoading && pendingRequests.length > 0 && (
              <div className="flex items-center justify-center min-w-[32px] h-[32px] px-2 bg-rose-soft rounded-full">
                <span className="text-rose text-[14px] font-bold">{pendingRequests.length}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {isLoading ? (
              [...Array(2)].map((_, i) => (
                <FrostedCard key={i} className="p-5">
                  <div className="flex items-start">
                    <Skeleton className="w-12 h-12 rounded-xl shrink-0 mr-4" />
                    <div className="flex-1 pr-2">
                      <Skeleton className="w-32 h-5 mb-2" />
                      <Skeleton className="w-48 h-4 mb-2" />
                      <Skeleton className="w-24 h-3" />
                    </div>
                    <Skeleton className="w-16 h-6 rounded-full" />
                  </div>
                  <div className="flex flex-row gap-3 mt-5 pt-4 border-t border-line/60">
                    <Skeleton className="flex-1 h-11 rounded-xl" />
                    <Skeleton className="flex-1 h-11 rounded-xl" />
                  </div>
                </FrostedCard>
              ))
            ) : managerLeaveRequests.length === 0 ? (
              <FrostedCard className="p-8 text-center flex flex-col items-center">
                <IconSymbol name="checkmark.seal.fill" size={32} color={palette.mint} />
                <p className="text-ink font-bold mt-4">No pending requests</p>
              </FrostedCard>
            ) : (
              managerLeaveRequests.map((request) => (
                <FrostedCard key={request.id} className="p-5 transition-shadow hover:shadow-lg">
                  <div className="flex items-start">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-soft rounded-xl shrink-0 mr-4">
                      <span className="text-blue text-[15px] font-bold">{request.initials}</span>
                    </div>
                    <div className="flex-1 pr-2">
                      <p className="text-ink text-[16px] font-bold">{request.employee}</p>
                      <p className="text-muted text-[13px] mt-1">{request.type} · {request.dates}</p>
                      <p className="text-muted text-[12px] mt-1">Submitted {request.submitted}</p>
                    </div>
                    <StatusPill label={request.status} tone={statusTone(request.status)} />
                  </div>
                  
                  {request.status === "Pending" && (
                    <div className="flex flex-row gap-3 mt-5 pt-4 border-t border-line/60">
                      <button
                        onClick={() => review(request.id, "Declined")}
                        className="flex-1 flex items-center justify-center min-h-[44px] bg-rose-soft hover:bg-rose/20 rounded-xl active:scale-95 transition-all"
                      >
                        <span className="text-rose text-[14px] font-bold">Decline</span>
                      </button>
                      <button
                        onClick={() => review(request.id, "Approved")}
                        className="flex-1 flex items-center justify-center gap-2 min-h-[44px] bg-mint hover:bg-mint/90 rounded-xl active:scale-95 transition-all shadow-md shadow-mint/20"
                      >
                        <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                        <span className="text-white text-[14px] font-bold">Approve</span>
                      </button>
                    </div>
                  )}
                </FrostedCard>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Team Attendance */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-ink text-[20px] font-bold tracking-tight">Team Attendance</h2>
              <p className="text-muted text-[14px] mt-1">Today · Local sample records</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-soft flex items-center justify-center">
              <IconSymbol name="chart.bar.fill" size={20} color={palette.blue} />
            </div>
          </div>

          <FrostedCard className="p-2">
            {isLoading ? (
              [...Array(5)].map((_, index) => (
                <div key={index} className={`flex items-center p-4 ${index < 4 ? "border-b border-line/50" : ""}`}>
                  <Skeleton className="w-11 h-11 rounded-xl shrink-0 mr-4" />
                  <div className="flex-1 pr-3">
                    <Skeleton className="w-32 h-4 mb-2" />
                    <Skeleton className="w-24 h-3" />
                  </div>
                  <Skeleton className="w-16 h-6 rounded-full" />
                </div>
              ))
            ) : (
              teamAttendance.map((member, index) => (
                <div key={member.id} className={`flex items-center p-4 hover:bg-black/5 transition-colors rounded-xl ${index < teamAttendance.length - 1 ? "border-b border-line/50" : ""}`}>
                  <div className="flex items-center justify-center w-11 h-11 bg-[#F1F3F8] rounded-xl shrink-0 mr-4">
                    <span className="text-ink text-[14px] font-bold">{member.initials}</span>
                  </div>
                  <div className="flex-1 pr-3">
                    <p className="text-ink text-[15px] font-bold">{member.name}</p>
                    <p className="text-muted text-[13px] mt-1">{member.detail}</p>
                  </div>
                  <StatusPill label={member.status} tone={statusTone(member.status)} />
                </div>
              ))
            )}
          </FrostedCard>
        </div>
      </div>
    </div>
  );
}
