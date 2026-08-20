import { useMemo, useState } from "react";
import { FrostedCard, PageTitle, StatusPill, Skeleton } from "../components/ui/app-ui";
import { palette } from "../constants";
import { IconSymbol } from "../components/ui/icon-symbol";
import { useAttendance } from "../context/AttendanceContext";
import { useNotifications } from "../context/useNotifications.js";
import { localDateKey } from "../lib/time";

const dateFilters = ["Last 7 days", "Today", "All dates"];
const statusFilters = ["All", "Present", "Late", "On leave"];

function toneForStatus(status) {
  return status === "Late" ? "amber" : status === "On leave" ? "blue" : "mint";
}

function isWithinDateFilter(entry, filter) {
  if (filter === "All dates") return true;
  const todayKey = localDateKey();
  if (filter === "Today") return entry.date === todayKey;
  const threshold = new Date(`${todayKey}T12:00:00`);
  threshold.setDate(threshold.getDate() - 6);
  return new Date(`${entry.date}T12:00:00`).getTime() >= threshold.getTime();
}

function buildCsv(entries) {
  const lines = ["Date,Check In,Check Out,Duration,Status"];
  for (const entry of entries) {
    lines.push(`"${entry.date}","${entry.checkIn}","${entry.checkOut}","${entry.duration}","${entry.status}"`);
  }
  return lines.join("\n");
}

export default function History() {
  const { isLoading, entries } = useAttendance();
  const { connectionState } = useNotifications();
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("Last 7 days");

  const filteredEntries = useMemo(
    () => entries.filter((entry) => (statusFilter === "All" || entry.status === statusFilter) && isWithinDateFilter(entry, dateFilter)),
    [dateFilter, entries, statusFilter],
  );

  const exportHistory = () => {
    if (!filteredEntries.length) return;
    const csv = buildCsv(filteredEntries);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secure-attendance-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col p-6 md:p-8 max-w-6xl mx-auto min-h-full pb-safe">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <PageTitle eyebrow="Attendance" title="History" />
        <button
          disabled={!filteredEntries.length || isLoading}
          onClick={exportHistory}
          className={`flex items-center justify-center gap-2 bg-blue-soft rounded-lg min-h-[42px] px-4 ${(!filteredEntries.length || isLoading) ? "opacity-50 cursor-not-allowed" : "hover:bg-[#DBEDF9] active:scale-95 transition-all"}`}
        >
          <IconSymbol name="square.and.arrow.up" size={18} color={palette.blue} />
          <span className="text-blue text-[14px] font-bold">Export CSV</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        <FrostedCard className="flex flex-row items-center gap-4 p-5 flex-1 max-w-sm">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-soft rounded-xl shrink-0">
            <IconSymbol name="chart.bar.fill" size={24} color={palette.blue} />
          </div>
          <div className="flex-1">
            <p className="text-muted text-[11px] font-bold tracking-wider mb-1 uppercase">FILTERED RESULTS</p>
            {isLoading ? (
              <Skeleton className="w-24 h-6 mb-1" />
            ) : (
              <p className="text-ink text-[18px] font-bold">{filteredEntries.length} record{filteredEntries.length === 1 ? "" : "s"}</p>
            )}
            <p className="text-muted text-[13px] mt-1">{dateFilter} · {statusFilter === "All" ? "All statuses" : statusFilter}</p>
          </div>
        </FrostedCard>

        <div className="flex flex-col gap-4 flex-1">
          <div>
            <p className="text-muted text-[11px] font-bold tracking-wider mb-2 uppercase">DATE</p>
            <div className="flex flex-wrap gap-2">
              {dateFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-4 py-2 rounded-lg transition-all text-[13px] font-bold ${dateFilter === filter ? "bg-ink text-white" : "bg-[#EAF3F9] text-muted hover:bg-[#DBEDF9]"}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-muted text-[11px] font-bold tracking-wider mb-2 uppercase">STATUS</p>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-4 py-2 rounded-lg transition-all text-[13px] font-bold ${statusFilter === filter ? "bg-ink text-white" : "bg-[#EAF3F9] text-muted hover:bg-[#DBEDF9]"}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-ink text-[18px] font-bold">Recent activity</h3>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted" title="Attendance history updates from the realtime connection">
            <span className={`size-1.5 rounded-full ${connectionState === "connected" ? "bg-mint" : "bg-ice"}`} />
            {connectionState === "connected" ? "Live" : "Syncing"}
          </span>
        </div>
        {!isLoading && <p className="text-muted text-[13px] font-semibold">{filteredEntries.length} shown</p>}
      </div>

      {isLoading ? (
        <>
          <div className="hidden md:block overflow-hidden bg-white/92 border border-white/90 rounded-2xl shadow-xl shadow-ink/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-canvas border-b border-line">
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Date</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Status</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Check In</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Check Out</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Duration</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(4)].map((_, index) => (
                  <tr key={index} className={`hover:bg-[#EAF3F9] transition-colors ${index !== 3 ? 'border-b border-line/50' : ''}`}>
                    <td className="py-4 px-5"><Skeleton className="w-24 h-5" /></td>
                    <td className="py-4 px-5"><Skeleton className="w-20 h-6 rounded-full" /></td>
                    <td className="py-4 px-5"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-5"><Skeleton className="w-16 h-4" /></td>
                    <td className="py-4 px-5"><Skeleton className="w-20 h-5" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {[...Array(3)].map((_, index) => (
              <FrostedCard key={index} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Skeleton className="w-32 h-5 mb-2" />
                    <Skeleton className="w-40 h-4" />
                  </div>
                  <Skeleton className="w-16 h-6 rounded-full" />
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
                  <Skeleton className="w-16 h-4" />
                  <Skeleton className="w-20 h-3" />
                </div>
              </FrostedCard>
            ))}
          </div>
        </>
      ) : filteredEntries.length === 0 ? (
        <FrostedCard className="flex flex-col items-center justify-center p-10">
          <IconSymbol name="doc.text.fill" size={32} color={palette.muted} />
          <p className="text-ink text-[16px] font-bold mt-4">No records match</p>
          <p className="text-muted text-[14px] text-center mt-2 max-w-sm">Adjust a date or status filter to see more attendance history.</p>
        </FrostedCard>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden bg-white/92 border border-white/90 rounded-2xl shadow-xl shadow-ink/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-canvas border-b border-line">
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Date</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Status</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Check In</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Check Out</th>
                  <th className="py-3 px-5 text-muted text-[11px] font-bold tracking-wider uppercase">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((item, index) => (
                  <tr key={item.id} className={`hover:bg-[#EAF3F9] transition-colors ${index !== filteredEntries.length - 1 ? 'border-b border-line/50' : ''}`}>
                    <td className="py-4 px-5 text-ink text-[14px] font-bold">{item.label}</td>
                    <td className="py-4 px-5">
                      <StatusPill label={item.status} tone={toneForStatus(item.status)} />
                    </td>
                    <td className="py-4 px-5 text-muted text-[14px]">{item.checkIn}</td>
                    <td className="py-4 px-5 text-muted text-[14px]">{item.checkOut}</td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <IconSymbol name="clock.fill" size={14} color={palette.muted} />
                        <span className="text-ink text-[14px] font-semibold">{item.duration}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredEntries.map((item) => (
              <FrostedCard key={item.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-ink text-[16px] font-bold">{item.label}</p>
                    <p className="text-muted text-[13px] mt-1">{item.checkIn}  →  {item.checkOut}</p>
                  </div>
                  <StatusPill label={item.status} tone={toneForStatus(item.status)} />
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
                  <div className="flex items-center gap-1.5">
                    <IconSymbol name="clock.fill" size={14} color={palette.muted} />
                    <p className="text-ink text-[13px] font-bold">{item.duration}</p>
                  </div>
                  <p className="text-muted text-[12px] font-semibold">Local record</p>
                </div>
              </FrostedCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
