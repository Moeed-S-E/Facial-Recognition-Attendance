import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AttendanceContext } from "./AttendanceContext";
import { requestJson } from "../lib/api";
import { createClientRequestId, readOfflineLeaveQueue, readWorkspaceCache, writeOfflineLeaveQueue, writeWorkspaceCache } from "../lib/offlineStore";
import { useAuthStore } from "../store/useAuthStore";

function configuredApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.trim() || "";
}

const APP_TIMEZONE = "Asia/Karachi";

function parseApiTimestamp(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return new Date(value);
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
}

function displayTime(date) {
  return new Intl.DateTimeFormat(undefined, { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(date);
}

function displayDate(date) {
  return new Intl.DateTimeFormat(undefined, { timeZone: APP_TIMEZONE, weekday: "long", month: "short", day: "numeric" }).format(date);
}

function localDateKey(value = new Date()) {
  const date = parseApiTimestamp(value);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayFromEntries(history) {
  const today = history
    .filter((entry) => entry.date === localDateKey())
    .sort((left, right) => (right.checkInAt?.getTime() ?? 0) - (left.checkInAt?.getTime() ?? 0))[0];
  return { checkInAt: today?.checkInAt ?? null, checkOutAt: today?.checkOutAt ?? null };
}

function calculateWorkedDuration(start, end) {
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function statusForCheckIn(date, fallback = "Present", startMinutes = 9 * 60) {
  if (fallback !== "Present") return fallback;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return Number(values.hour) * 60 + Number(values.minute) >= startMinutes ? "Late" : "Present";
}

function initialsFor(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function previousWorkday(offset) {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return date;
}

function seedHistory() {
  const dates = [previousWorkday(1), previousWorkday(2), previousWorkday(3), previousWorkday(4), previousWorkday(5)];
  return dates.map((date, index) => ({
    id: `seed-${index}`,
    date: date.toISOString().slice(0, 10),
    label: displayDate(date),
    checkIn: index === 1 ? "9:14 AM" : index === 4 ? "9:06 AM" : "8:57 AM",
    checkOut: index === 2 ? "—" : index === 1 ? "5:31 PM" : "5:24 PM",
    duration: index === 2 ? "In progress" : index === 1 ? "8h 17m" : "8h 27m",
    status: index === 1 || index === 4 ? "Late" : index === 2 ? "Missing checkout" : "Present",
  }));
}

const emptyOrganization = {
  id: "",
  name: "Your organization",
  workspace: "Organization workspace",
  employees: 0,
  locations: 0,
  activeToday: 0,
  dataSource: "database",
};

const seedOrganization = {
  id: "local-organization",
  name: "Northstar Labs",
  workspace: "Northstar Labs · Global",
  employees: 4,
  locations: 1,
  attendanceRate: 100,
  verificationRate: 98.2,
  avgCheckIn: "8:58 AM",
  activeToday: 1,
  dataSource: "local-fallback",
};

const roleOptions = [
  { id: "enterprise_admin", label: "Organization owner", description: "Manage the attendance workspace" },
  { id: "hr", label: "HR", description: "Create accounts and manage the directory" },
  { id: "manager", label: "Manager", description: "Manage an assigned team" },
  { id: "employee", label: "Employee", description: "Only your attendance and leave" },
];

const fallbackRoleIdentities = {
  enterprise_admin: { id: "organization-account", name: "Avery Morgan", initials: "AM", email: "owner@northstarlabs.com", role: "enterprise_admin", teamId: null },
  hr: { id: "team-3", name: "Maya Chen", initials: "MC", email: "maya.chen@northstarlabs.com", role: "hr", teamId: "team-people" },
  manager: { id: "team-2", name: "Jordan Bell", initials: "JB", email: "jordan.bell@northstarlabs.com", role: "manager", teamId: "team-customer-success" },
  employee: { id: "team-4", name: "Noah Williams", initials: "NW", email: "noah.williams@northstarlabs.com", role: "employee", teamId: "team-engineering" },
};

const permissions = {
  enterprise_admin: ["view_overview", "view_attendance", "view_people", "view_insights", "view_all_attendance", "enroll_self", "capture_self_attendance", "view_self_attendance", "view_self_history", "request_leave", "review_leave", "view_exceptions", "manage_attendance_policy", "manage_leave_policy"],
  hr: ["view_overview", "view_attendance", "view_people", "view_insights", "create_account", "assign_team", "view_all_attendance", "review_leave", "view_exceptions", "manage_attendance_policy", "manage_leave_policy"],
  manager: ["view_overview", "view_attendance", "view_people", "view_insights", "assign_team", "view_team_attendance", "review_leave", "view_exceptions", "manage_attendance_policy"],
  employee: ["view_self_attendance", "view_self_history", "enroll_self", "capture_self_attendance", "request_leave", "view_profile", "view_exceptions"],
};

const fallbackTeams = [
  { id: "team-operations", name: "Operations", manager: "Elena Vasquez" },
  { id: "team-customer-success", name: "Customer Success", manager: "Jordan Bell" },
  { id: "team-people", name: "People & HR", manager: "Maya Chen" },
  { id: "team-engineering", name: "Engineering", manager: "Noah Williams" },
  { id: "team-design", name: "Design", manager: "Riley Kim" },
];

const fallbackDirectory = [
  { id: "team-1", name: "Elena Vasquez", email: "elena.vasquez@northstarlabs.com", initials: "EV", department: "Operations", role: "manager", teamId: "team-operations", accountStatus: "active", recognitionStatus: "enrolled", status: "Present", confidence: 98, lastSeen: "2 min ago", detail: "Checked in 8:54 AM" },
  { id: "team-2", name: "Jordan Bell", email: "jordan.bell@northstarlabs.com", initials: "JB", department: "Customer Success", role: "manager", teamId: "team-customer-success", accountStatus: "active", recognitionStatus: "enrolled", status: "Late", confidence: 94, lastSeen: "18 min ago", detail: "Checked in 9:17 AM" },
  { id: "team-3", name: "Maya Chen", email: "maya.chen@northstarlabs.com", initials: "MC", department: "People & HR", role: "hr", teamId: "team-people", accountStatus: "active", recognitionStatus: "enrolled", status: "On leave", confidence: 97, lastSeen: "Yesterday", detail: "Approved leave" },
  { id: "team-4", name: "Noah Williams", email: "noah.williams@northstarlabs.com", initials: "NW", department: "Engineering", role: "employee", teamId: "team-engineering", accountStatus: "active", recognitionStatus: "enrolled", status: "Present", confidence: 99, lastSeen: "4 min ago", detail: "Checked in 8:49 AM" },
];

const seedRiskSignals = [
  { id: "risk-1", name: "Jordan Bell", initials: "JB", reason: "3 late arrivals in the last 7 days", score: 78, severity: "High", action: "Review pattern" },
  { id: "risk-2", name: "Avery Shah", initials: "AS", reason: "No check-in recorded by 10:00 AM", score: 64, severity: "Medium", action: "Send reminder" },
  { id: "risk-3", name: "Northstar Labs", initials: "NL", reason: "Attendance coverage dipped 8% week over week", score: 41, severity: "Watch", action: "View insight" },
];

function frontendRoleFor(role) {
  return role === "super_admin" ? "enterprise_admin" : role;
}

function formatAttendanceEntry(record, startMinutes = 9 * 60) {
  const checkIn = parseApiTimestamp(record.check_in);
  const checkOut = record.check_out ? parseApiTimestamp(record.check_out) : null;
  return {
    id: record.id,
    date: localDateKey(checkIn),
    label: localDateKey(checkIn) === localDateKey() ? "Today" : displayDate(checkIn),
    checkIn: displayTime(checkIn),
    checkOut: checkOut ? displayTime(checkOut) : "—",
    checkInAt: checkIn,
    checkOutAt: checkOut,
    duration: checkOut ? calculateWorkedDuration(checkIn, checkOut) : localDateKey(checkIn) === localDateKey() ? "In progress" : "Missing checkout",
    status: checkOut || localDateKey(checkIn) === localDateKey() ? statusForCheckIn(checkIn, record.status, startMinutes) : "Missing checkout",
  };
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function leaveDates(request) {
  const dates = [];
  const cursor = dateFromKey(request.startDate);
  const end = dateFromKey(request.endDate);
  while (cursor <= end) {
    dates.push(localDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function approvedLeaveRequests(requests) {
  return requests.filter((request) => request.status === "Approved");
}

function mergeApprovedLeaveEntries(history, requests) {
  const attendanceDates = new Set(history.filter((entry) => entry.checkInAt).map((entry) => entry.date));
  const leaveEntries = approvedLeaveRequests(requests).flatMap((request) => leaveDates(request).filter((date) => !attendanceDates.has(date)).map((date) => {
    const leaveDate = dateFromKey(date);
    return {
      id: `leave-${request.id}-${date}`,
      date,
      label: date === localDateKey() ? "Today" : displayDate(leaveDate),
      checkIn: "—",
      checkOut: "—",
      checkInAt: null,
      checkOutAt: null,
      duration: "—",
      status: "On leave",
    };
  }));
  return [...history.filter((entry) => entry.status !== "On leave"), ...leaveEntries].sort((left, right) => right.date.localeCompare(left.date));
}

function applyApprovedLeaveToDirectory(users, requests) {
  const today = localDateKey();
  const onLeaveIds = new Set(approvedLeaveRequests(requests).filter((request) => leaveDates(request).includes(today)).map((request) => request.requesterId));
  return users.map((user) => onLeaveIds.has(user.id) ? { ...user, status: "On leave", lastSeen: "Today", detail: "Approved leave" } : user);
}

function formatApiHistory(records, userId, startMinutes = 9 * 60) {
  return records.filter((record) => record.user_id === userId).map((record) => formatAttendanceEntry(record, startMinutes));
}

function formatLeaveRequest(record) {
  const start = new Date(`${record.start_date}T00:00:00`);
  const end = new Date(`${record.end_date}T00:00:00`);
  const status = record.status === "approved" ? "Approved" : record.status === "rejected" ? "Declined" : "Pending";
  const dates = record.start_date === record.end_date ? displayDate(start) : `${displayDate(start)} – ${displayDate(end)}`;
  return {
    id: record.id,
    requesterId: record.requester_id,
    type: record.leave_type,
    startDate: record.start_date,
    endDate: record.end_date,
    dates,
    note: record.note || "",
    status,
    employee: record.requester_name,
    initials: initialsFor(record.requester_name),
    submitted: displayDate(parseApiTimestamp(record.created_at)),
  };
}

function serializeAttendanceEntry(entry) {
  if (!entry) return null;
  return {
    ...entry,
    checkInAt: entry.checkInAt?.toISOString?.() || null,
    checkOutAt: entry.checkOutAt?.toISOString?.() || null,
  };
}

function restoreAttendanceEntry(entry) {
  if (!entry) return null;
  return {
    ...entry,
    checkInAt: entry.checkInAt ? new Date(entry.checkInAt) : null,
    checkOutAt: entry.checkOutAt ? new Date(entry.checkOutAt) : null,
  };
}

function serializeWorkspace(workspace) {
  return {
    organization: workspace.organization,
    directoryUsers: workspace.directoryUsers,
    teams: workspace.teams,
    roleIdentitiesByRole: workspace.roleIdentitiesByRole,
    entries: workspace.entries.map(serializeAttendanceEntry),
    selfAttendance: serializeAttendanceEntry(workspace.selfAttendance),
    openAttendance: serializeAttendanceEntry(workspace.openAttendance),
    attendancePolicy: workspace.attendancePolicy,
    leavePolicy: workspace.leavePolicy,
  };
}

function restoreWorkspace(workspace) {
  if (!workspace?.organization || !Array.isArray(workspace.entries)) return null;
  return {
    ...workspace,
    entries: workspace.entries.map(restoreAttendanceEntry),
    selfAttendance: restoreAttendanceEntry(workspace.selfAttendance),
    openAttendance: restoreAttendanceEntry(workspace.openAttendance),
  };
}

function queuedLeaveDraft(item) {
  const payload = item?.payload;
  if (!payload) return null;
  return {
    id: item.localId,
    clientRequestId: payload.client_request_id,
    type: payload.leave_type,
    dates: `${payload.start_date} – ${payload.end_date}`,
    note: payload.note || "",
    status: "Pending sync",
    pendingSync: true,
  };
}

function formatApiDirectory(payload, userId) {
  const attendancePolicy = {
    startMinutes: Number(payload.attendance_policy?.start_minutes ?? 9 * 60),
    startTime: payload.attendance_policy?.start_time || "09:00",
    timezone: payload.attendance_policy?.timezone || APP_TIMEZONE,
  };
  const leavePolicy = {
    annualDays: Number(payload.leave_policy?.annual_days ?? 12),
    medicalDays: Number(payload.leave_policy?.medical_days ?? 8),
  };
  const teamMap = new Map(payload.teams.map((team) => [team.id, team]));
  const latestByUser = new Map();
  payload.attendance.forEach((record) => {
    if (!latestByUser.has(record.user_id)) latestByUser.set(record.user_id, record);
  });

  const directoryUsers = payload.accounts.map((account) => {
    const team = account.team_id ? teamMap.get(account.team_id) : null;
    const latest = latestByUser.get(account.id);
    const latestCheckIn = latest ? parseApiTimestamp(latest.check_in) : null;
    const hasCheckout = Boolean(latest?.check_out);
    const status = latest ? (hasCheckout ? "Checked out" : latest.status || statusForCheckIn(latestCheckIn, "Present", attendancePolicy.startMinutes)) : account.recognition_status === "enrolled" ? "Not checked in" : "Unverified";
    return {
      id: account.id,
      name: account.name,
      email: account.email,
      employeeId: account.employee_id || "",
      initials: initialsFor(account.name),
      department: team?.name || "Unassigned",
      role: frontendRoleFor(account.role),
      teamId: account.team_id,
      accountStatus: account.account_status,
      recognitionStatus: account.recognition_status,
      profileImageUrl: account.profile_image_url || null,
      status,
      confidence: account.recognition_status === "enrolled" ? 98 : 0,
      lastSeen: latestCheckIn ? displayTime(latestCheckIn) : "Not seen today",
      detail: latestCheckIn ? `${hasCheckout ? "Checked out" : "Checked in"} ${displayTime(latestCheckIn)}` : "Attendance photo required",
    };
  });

  const activeToday = directoryUsers.filter((user) => ["Present", "Late", "Checked out"].includes(user.status)).length;
  const attendanceRate = directoryUsers.length ? Math.round((activeToday / directoryUsers.length) * 1000) / 10 : 0;
  const owner = payload.organization;
  return {
    organization: {
      id: owner.id,
      name: owner.name,
      workspace: `${owner.name} · Global`,
      employees: owner.users_count,
      locations: 1,
      attendanceRate,
      verificationRate: directoryUsers.length ? Math.round((directoryUsers.filter((user) => user.recognitionStatus === "enrolled").length / directoryUsers.length) * 1000) / 10 : 0,
      avgCheckIn: payload.attendance.length ? displayTime(parseApiTimestamp(payload.attendance[0].check_in)) : "—",
      activeToday,
      accountOwnerId: owner.account_owner_id,
      accountOwnerName: owner.account_owner_name,
      accountOwnerEmail: owner.account_owner_email,
      dataSource: "database",
    },
    directoryUsers,
    teams: payload.teams.map((team) => ({ id: team.id, name: team.name, manager: team.manager_name || "Unassigned" })),
    entries: formatApiHistory(payload.attendance, userId || payload.accounts.find((account) => account.role === "employee")?.id, attendancePolicy.startMinutes),
    selfAttendance: payload.self_attendance ? formatAttendanceEntry(payload.self_attendance, attendancePolicy.startMinutes) : null,
    openAttendance: payload.open_attendance ? formatAttendanceEntry(payload.open_attendance, attendancePolicy.startMinutes) : null,
    attendancePolicy,
    leavePolicy,
    roleIdentities: Object.fromEntries(payload.accounts.map((account) => [frontendRoleFor(account.role), {
      id: account.id,
      name: account.name,
      initials: initialsFor(account.name),
      email: account.email,
      role: frontendRoleFor(account.role),
      teamId: account.team_id,
      profileImageUrl: account.profile_image_url || null,
    }])),
  };
}

export function AttendanceProvider({ children, initialRole = "enterprise_admin" }) {
  const authToken = useAuthStore((state) => state.token);
  const authUser = useAuthStore((state) => state.user);
  const isDemoMode = !authToken;
  const [isLoading, setIsLoading] = useState(true);
  const [day, setDay] = useState({ checkInAt: null, checkOutAt: null });
  const [entries, setEntries] = useState(() => (isDemoMode ? seedHistory() : []));
  const [activeRole, setActiveRole] = useState(() => (authToken && authUser?.role ? frontendRoleFor(authUser.role) : initialRole));
  const [organization, setOrganization] = useState(() => (isDemoMode ? seedOrganization : emptyOrganization));
  const [directoryUsers, setDirectoryUsers] = useState(() => (isDemoMode ? fallbackDirectory : []));
  const [teams, setTeams] = useState(() => (isDemoMode ? fallbackTeams : []));
  const [roleIdentitiesByRole, setRoleIdentitiesByRole] = useState(() => (isDemoMode ? fallbackRoleIdentities : {}));
  const [dataSource, setDataSource] = useState("loading");
  const [dataError, setDataError] = useState("");
  const [attendancePolicy, setAttendancePolicy] = useState(() => ({ startMinutes: 9 * 60, startTime: "09:00", timezone: APP_TIMEZONE }));
  const [leavePolicy, setLeavePolicy] = useState(() => ({ annualDays: 12, medicalDays: 8 }));
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [offlineQueueError, setOfflineQueueError] = useState("");
  const offlineLeaveQueueRef = useRef([]);
  const flushingOfflineQueueRef = useRef(false);

  const [leaveRequests, setLeaveRequests] = useState(() => (isDemoMode ? [
    { id: "leave-1", type: "Annual leave", dates: "Sep 18 – Sep 20", note: "Family commitment", status: "Approved" },
  ] : []));
  const [managerLeaveRequests, setManagerLeaveRequests] = useState(() => (isDemoMode ? [
    { id: "manager-leave-1", employee: "Elena Vasquez", initials: "EV", type: "Annual leave", dates: "Aug 21 – Aug 22", submitted: "Today", status: "Pending" },
    { id: "manager-leave-2", employee: "Jordan Bell", initials: "JB", type: "Medical leave", dates: "Aug 19", submitted: "Yesterday", status: "Pending" },
    { id: "manager-leave-3", employee: "Maya Chen", initials: "MC", type: "Personal leave", dates: "Aug 25", submitted: "Aug 12", status: "Approved" },
  ] : []));
  const [teamRequests, setTeamRequests] = useState([]);
  const [exceptions, setExceptions] = useState([]);

  useEffect(() => {
    if (authToken && authUser?.role) setActiveRole(frontendRoleFor(authUser.role));
    else if (!authToken) setActiveRole(initialRole);
  }, [authToken, authUser?.role, initialRole]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const queue = authToken && authUser?.id ? readOfflineLeaveQueue(authUser.id) : [];
    offlineLeaveQueueRef.current = queue;
    setOfflineQueueCount(queue.length);
    setOfflineQueueError("");
    const drafts = queue.map(queuedLeaveDraft).filter(Boolean);
    if (drafts.length) setLeaveRequests((current) => [...drafts, ...current.filter((item) => !drafts.some((draft) => draft.id === item.id))]);
  }, [authToken, authUser?.id]);

  useEffect(() => {
    let mounted = true;
    async function loadDirectory() {
      const apiBaseUrl = configuredApiBaseUrl();
      if (!apiBaseUrl) {
        if (mounted) {
          setDataSource("local-fallback");
          setDataError("The API base URL is not configured.");
          setIsLoading(false);
        }
        return;
      }
      try {
        const endpoint = authToken ? "/v1/organization/directory" : "/v1/demo/directory";
        const options = authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined;
        const payload = await requestJson(`${apiBaseUrl}${endpoint}`, options, "The directory API returned an invalid response.");
        if (!mounted) return;
        const formatted = formatApiDirectory(payload, authUser?.id);
        if (authUser?.id) writeWorkspaceCache(authUser.id, serializeWorkspace(formatted));
        setOrganization(formatted.organization);
        setAttendancePolicy(formatted.attendancePolicy);
        setLeavePolicy(formatted.leavePolicy);
        setDirectoryUsers(formatted.directoryUsers);
        setTeams(formatted.teams);
        setRoleIdentitiesByRole(isDemoMode ? { ...fallbackRoleIdentities, ...formatted.roleIdentities } : formatted.roleIdentities);
        setEntries(formatted.entries);
        const actionAttendance = formatted.selfAttendance ?? formatted.openAttendance;
        setDay(actionAttendance ? { checkInAt: actionAttendance.checkInAt, checkOutAt: actionAttendance.checkOutAt } : dayFromEntries(formatted.entries));
        setDataSource("database");
        setDataError("");
      } catch (error) {
        if (!mounted) return;
        const cached = !isDemoMode && authUser?.id ? readWorkspaceCache(authUser.id) : null;
        const restored = restoreWorkspace(cached?.workspace);
        if (restored) {
          setOrganization(restored.organization);
          setAttendancePolicy(restored.attendancePolicy || { startMinutes: 9 * 60, startTime: "09:00", timezone: APP_TIMEZONE });
          setLeavePolicy(restored.leavePolicy || { annualDays: 12, medicalDays: 8 });
          setDirectoryUsers(restored.directoryUsers || []);
          setTeams(restored.teams || []);
          setRoleIdentitiesByRole(restored.roleIdentitiesByRole || {});
          setEntries(restored.entries || []);
          const actionAttendance = restored.selfAttendance || restored.openAttendance;
          setDay(actionAttendance ? { checkInAt: actionAttendance.checkInAt, checkOutAt: actionAttendance.checkOutAt } : dayFromEntries(restored.entries || []));
          setDataSource("offline-cache");
          setDataError("Showing the last synchronized workspace. Changes will sync when you reconnect.");
        } else {
          if (!isDemoMode) {
            setOrganization(emptyOrganization);
            setDirectoryUsers([]);
            setTeams([]);
            setRoleIdentitiesByRole({});
            setEntries([]);
          }
          setDataSource(isDemoMode ? "local-fallback" : "unavailable");
          setDataError(error instanceof Error ? error.message : "The directory API is unavailable.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadDirectory();
    return () => { mounted = false; };
  }, [authToken, authUser?.id]);

  useEffect(() => {
    if (!authToken) return;
    let mounted = true;
    requestJson(`${configuredApiBaseUrl()}/v1/organization/leave-requests`, { headers: { Authorization: `Bearer ${authToken}` } }, "Unable to load leave requests.")
      .then((items) => {
        if (!mounted) return;
        const formatted = items.map(formatLeaveRequest);
        const selfRequests = formatted.filter((item) => item.requesterId === authUser?.id);
        setLeaveRequests(activeRole === "employee" ? selfRequests : formatted);
        setManagerLeaveRequests(formatted);
        setDirectoryUsers((current) => applyApprovedLeaveToDirectory(current, formatted));
        if (authUser?.id) setEntries((current) => mergeApprovedLeaveEntries(current, selfRequests));
      })
      .catch(() => {
        if (!mounted) return;
        const drafts = offlineLeaveQueueRef.current.map(queuedLeaveDraft).filter(Boolean);
        setLeaveRequests((current) => drafts.length ? [...drafts, ...current.filter((item) => !drafts.some((draft) => draft.id === item.id))] : current);
        if (activeRole !== "employee") setManagerLeaveRequests((current) => drafts.length ? [...drafts, ...current] : current);
      });
    return () => { mounted = false; };
  }, [activeRole, authToken, authUser?.id, authUser?.name]);

  useEffect(() => {
    const authenticatedRole = authUser?.role ? frontendRoleFor(authUser.role) : null;
    if (!authToken || !authenticatedRole || !["enterprise_admin", "hr", "manager"].includes(authenticatedRole)) return;
    let mounted = true;
    requestJson(`${configuredApiBaseUrl()}/v1/organization/team-requests`, { headers: { Authorization: `Bearer ${authToken}` } }, "Unable to load team requests.")
      .then((items) => { if (mounted) setTeamRequests(items); })
      .catch(() => { if (mounted) setTeamRequests([]); });
    return () => { mounted = false; };
  }, [authToken, authUser?.role]);

  const loadExceptions = useCallback(async (statusFilter = "") => {
    if (!authToken || !["enterprise_admin", "hr", "manager", "employee"].includes(activeRole)) {
      setExceptions([]);
      return [];
    }
    const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    try {
      const items = await requestJson(`${configuredApiBaseUrl()}/v1/organization/exceptions${query}`, { headers: { Authorization: `Bearer ${authToken}` } }, "Unable to load attendance exceptions.");
      setExceptions(Array.isArray(items) ? items : []);
      return items;
    } catch {
      setExceptions([]);
      return [];
    }
  }, [activeRole, authToken]);

  useEffect(() => {
    if (!authToken || !["enterprise_admin", "hr", "manager", "employee"].includes(activeRole)) {
      setExceptions([]);
      return undefined;
    }
    let mounted = true;
    loadExceptions();
    return () => { mounted = false; };
  }, [activeRole, authToken, loadExceptions]);

  const applyExceptionUpdate = useCallback(() => loadExceptions(), [loadExceptions]);

  const directoryCurrentUser = authUser?.id ? directoryUsers.find((user) => user.id === authUser.id) : null;
  const currentUser = authToken && authUser ? {
    id: authUser.id,
    name: authUser.name || directoryCurrentUser?.name || "Organization member",
    initials: initialsFor(authUser.name || directoryCurrentUser?.name || "Organization member"),
    email: authUser.email || directoryCurrentUser?.email || "",
    role: frontendRoleFor(authUser.role || activeRole),
    teamId: directoryCurrentUser?.teamId ?? null,
  } : roleIdentitiesByRole[activeRole] ?? (isDemoMode ? fallbackRoleIdentities[activeRole] : { id: "", name: "Organization member", initials: "OM", email: "", role: activeRole, teamId: null });
  const activeRoleMeta = roleOptions.find((role) => role.id === activeRole) ?? roleOptions[0];
  const currentUserRecord = directoryUsers.find((user) => user.id === currentUser.id) ?? null;

  const can = useCallback((permission) => {
    const rolePermissions = permissions[activeRole] ?? [];
    const isEmployeeAccount = currentUserRecord && ["enterprise_admin", "hr", "manager", "employee"].includes(currentUserRecord.role);
    const selfServicePermissions = ["view_self_attendance", "view_self_history", "enroll_self", "capture_self_attendance", "request_leave", "view_profile"];
    return rolePermissions.includes(permission) || (isEmployeeAccount && selfServicePermissions.includes(permission));
  }, [activeRole, currentUserRecord]);

  const updateAttendancePolicy = useCallback(async (startTime) => {
    if (!authToken || !can("manage_attendance_policy")) {
      return { ok: false, error: "Only management roles can change attendance time." };
    }
    try {
      const result = await requestJson(
        `${configuredApiBaseUrl()}/v1/organization/attendance-policy`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ start_time: startTime }),
        },
        "Unable to update attendance policy.",
      );
      const nextPolicy = {
        startMinutes: result.start_minutes,
        startTime: result.start_time,
        timezone: result.timezone,
      };
      setAttendancePolicy(nextPolicy);
      return { ok: true, policy: nextPolicy };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to update attendance policy." };
    }
  }, [authToken, can]);

  const updateLeavePolicy = useCallback(async (annualDays, medicalDays) => {
    if (!authToken || !can("manage_leave_policy")) {
      return { ok: false, error: "Only the organization owner or HR can change leave allowances." };
    }
    try {
      const result = await requestJson(
        `${configuredApiBaseUrl()}/v1/organization/leave-policy`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ annual_days: Number(annualDays), medical_days: Number(medicalDays) }),
        },
        "Unable to update leave allowances.",
      );
      const nextPolicy = { annualDays: Number(result.annual_days), medicalDays: Number(result.medical_days) };
      setLeavePolicy(nextPolicy);
      return { ok: true, policy: nextPolicy };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to update leave allowances." };
    }
  }, [authToken, can]);
  const applyVerifiedAttendance = useCallback((payload) => {
    const record = payload?.data ?? payload;
    if (!record || record.user_id !== currentUser.id || !record.check_in || !record.attendance_id) return;
    const entry = formatAttendanceEntry({
      id: record.attendance_id,
      check_in: record.check_in,
      check_out: record.check_out,
      status: statusForCheckIn(parseApiTimestamp(record.check_in), record.attendance_status || "Present", attendancePolicy.startMinutes),
    });
    setEntries((current) => [entry, ...current.filter((candidate) => candidate.id !== entry.id && !(entry.date === localDateKey() && candidate.date === entry.date))]);
    if (entry.date === localDateKey()) setDay({ checkInAt: entry.checkInAt, checkOutAt: entry.checkOutAt });
  }, [attendancePolicy.startMinutes, currentUser.id]);

  const applyRealtimeAttendance = useCallback((payload) => {
    applyVerifiedAttendance(payload);
  }, [applyVerifiedAttendance]);

  const todayComplete = Boolean(
    day.checkInAt &&
    day.checkOutAt &&
    localDateKey(day.checkInAt) === localDateKey() &&
    localDateKey(day.checkOutAt) === localDateKey(),
  );

  const recordAttendance = useCallback((action) => {
    if (todayComplete) return { ok: false, error: "Attendance is already recorded for today." };
    if (!can("capture_self_attendance")) return { ok: false, error: "Your organization account is not enabled for personal attendance." };
    const now = new Date();
    let updatedEntry;
    if (action === "check-in") {
      updatedEntry = { id: `today-${now.getTime()}`, date: localDateKey(now), label: "Today", checkIn: displayTime(now), checkOut: "—", checkInAt: now, checkOutAt: null, duration: "In progress", status: statusForCheckIn(now, "Present", attendancePolicy.startMinutes) };
      setDay({ checkInAt: now, checkOutAt: null });
    } else {
      const start = day.checkInAt ?? now;
      updatedEntry = { id: `today-${now.getTime()}`, date: localDateKey(now), label: "Today", checkIn: displayTime(start), checkOut: displayTime(now), checkInAt: start, checkOutAt: now, duration: calculateWorkedDuration(start, now), status: statusForCheckIn(start, "Present", attendancePolicy.startMinutes) };
      setDay({ checkInAt: start, checkOutAt: now });
    }
    setEntries((current) => [updatedEntry, ...current.filter((entry) => entry.label !== "Today")]);
    return { ok: true, entry: updatedEntry };
  }, [attendancePolicy.startMinutes, can, day.checkInAt, todayComplete]);

  const createEmployeeAccount = useCallback(async (input) => {
    if (!authToken || !["enterprise_admin", "hr"].includes(activeRole)) return { ok: false, error: "Only the organization owner or HR can create accounts." };
    const apiBaseUrl = configuredApiBaseUrl();
    try {
      const payload = { name: input.name?.trim(), email: input.email?.trim().toLowerCase(), password: input.password, role: ["employee", "manager", "hr"].includes(input.role) ? input.role : "employee", employee_id: input.employee_id?.trim() || null, department: input.department?.trim() || null };
      const account = await requestJson(`${apiBaseUrl}/v1/organization/accounts`, { method: "POST", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }, "Unable to create the account.");
      const formatted = formatApiDirectory({ organization, accounts: [account], teams, attendance: [] });
      setDirectoryUsers((current) => [...current, formatted.directoryUsers[0]]);
      return { ok: true, user: formatted.directoryUsers[0] };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to create the account." };
    }
  }, [activeRole, authToken, organization, teams]);

  const changeAccountRole = useCallback(async (userId, role) => {
    if (!authToken || activeRole !== "enterprise_admin") return { ok: false, error: "Only the organization owner can change roles." };
    try {
      const account = await requestJson(`${configuredApiBaseUrl()}/v1/organization/accounts/${userId}/role`, { method: "PATCH", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ role }) }, "Unable to change the account role.");
      setDirectoryUsers((current) => current.map((candidate) => candidate.id === userId ? { ...candidate, role: frontendRoleFor(account.role), roleLabel: account.role_label, teamId: account.team_id } : candidate));
      return { ok: true, account };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to change the account role." }; }
  }, [activeRole, authToken]);

  const removeAccount = useCallback(async (userId) => {
    if (!authToken || activeRole !== "enterprise_admin") return { ok: false, error: "Only the organization owner can remove people." };
    try {
      await requestJson(`${configuredApiBaseUrl()}/v1/organization/accounts/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } }, "Unable to remove the account.");
      setDirectoryUsers((current) => current.filter((candidate) => candidate.id !== userId));
      return { ok: true };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to remove the account." }; }
  }, [activeRole, authToken]);

  const assignEmployeeToTeam = useCallback(async (userId, requestedTeamId) => {
    if (!authToken) return { ok: false, error: "Sign in to manage team membership." };
    const apiBaseUrl = configuredApiBaseUrl();
    try {
      if (activeRole === "manager") {
        const employee = directoryUsers.find((candidate) => candidate.id === userId);
        const result = await requestJson(`${apiBaseUrl}/v1/organization/team-requests`, { method: "POST", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ employee_query: employee?.employeeId || employee?.email || employee?.name, team_id: currentUser.teamId }) }, "Unable to submit the team request.");
        setTeamRequests((current) => [result, ...current.filter((item) => item.id !== result.id)]);
        return { ok: true, teamId: result.team_id, requested: true };
      }
      const account = await requestJson(`${apiBaseUrl}/v1/organization/accounts/${userId}/team`, { method: "POST", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ team_id: requestedTeamId }) }, "Unable to assign the employee.");
      setDirectoryUsers((current) => current.map((candidate) => candidate.id === userId ? { ...candidate, teamId: account.team_id } : candidate));
      return { ok: true, teamId: account.team_id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to update team membership." };
    }
  }, [activeRole, authToken, currentUser.teamId, directoryUsers]);

  const reviewTeamRequest = useCallback(async (requestId, decision) => {
    if (!authToken || !["enterprise_admin", "hr"].includes(activeRole)) return { ok: false, error: "Only the organization owner or HR can review requests." };
    try {
      const result = await requestJson(`${configuredApiBaseUrl()}/v1/organization/team-requests/${requestId}/${decision}`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } }, "Unable to review the team request.");
      setTeamRequests((current) => current.map((item) => item.id === requestId ? result : item));
      if (decision === "approve") setDirectoryUsers((current) => current.map((user) => user.id === result.employee_id ? { ...user, teamId: result.team_id } : user));
      return { ok: true, request: result };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to review the team request." };
    }
  }, [activeRole, authToken]);

  const markRecognitionEnrolled = useCallback((userId) => {
    setDirectoryUsers((current) => current.map((user) => user.id === userId ? { ...user, recognitionStatus: "enrolled", detail: "Attendance photo enrolled", confidence: 98 } : user));
  }, []);

  const enrollRecognition = useCallback((userId) => {
    if (!can("enroll_self") || userId !== currentUser.id) return { ok: false, error: "Only the signed-in employee can enroll their attendance photo." };
    setDirectoryUsers((current) => current.map((user) => user.id === userId ? { ...user, recognitionStatus: "enrolled", detail: "Attendance photo enrolled", confidence: 98 } : user));
    return { ok: true };
  }, [can, currentUser.id]);

  const flushOfflineLeaveQueue = useCallback(async () => {
    if (!authToken || !authUser?.id || !isOnline || flushingOfflineQueueRef.current) return;
    const queue = offlineLeaveQueueRef.current;
    if (!queue.length) return;
    flushingOfflineQueueRef.current = true;
    const remaining = [];
    setOfflineQueueError("");
    try {
      for (const item of queue) {
        try {
          const result = await requestJson(
            `${configuredApiBaseUrl()}/v1/organization/leave-requests`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
              body: JSON.stringify(item.payload),
            },
            "Unable to sync the leave request.",
          );
          const request = formatLeaveRequest(result);
          setLeaveRequests((current) => [request, ...current.filter((candidate) => candidate.clientRequestId !== item.payload.client_request_id && candidate.id !== item.localId)]);
        } catch (error) {
          remaining.push(item);
          setOfflineQueueError(error instanceof Error ? error.message : "Some offline changes still need a connection.");
        }
      }
    } finally {
      offlineLeaveQueueRef.current = remaining;
      writeOfflineLeaveQueue(authUser.id, remaining);
      setOfflineQueueCount(remaining.length);
      flushingOfflineQueueRef.current = false;
    }
  }, [authToken, authUser?.id, isOnline]);

  useEffect(() => {
    if (isOnline) flushOfflineLeaveQueue();
  }, [flushOfflineLeaveQueue, isOnline]);

  const submitLeave = useCallback(async (input) => {
    if (!can("request_leave")) return { ok: false, error: "Your role cannot submit a leave request." };
    if (!authToken) {
      const request = { ...input, id: `leave-${Date.now()}`, status: "Pending" };
      setLeaveRequests((current) => [request, ...current]);
      return { ok: true, request };
    }
    const payload = {
      leave_type: input.type,
      start_date: input.startDate,
      end_date: input.endDate,
      note: input.note || null,
      client_request_id: createClientRequestId(),
    };
    const queueOfflineRequest = () => {
      const request = {
        ...input,
        id: `offline-${payload.client_request_id}`,
        clientRequestId: payload.client_request_id,
        status: "Pending sync",
        pendingSync: true,
      };
      const nextQueue = [...offlineLeaveQueueRef.current, { localId: request.id, payload }];
      offlineLeaveQueueRef.current = nextQueue;
      writeOfflineLeaveQueue(authUser.id, nextQueue);
      setOfflineQueueCount(nextQueue.length);
      setLeaveRequests((current) => [request, ...current]);
      return { ok: true, queued: true, request };
    };
    if (!isOnline || (typeof navigator !== "undefined" && navigator.onLine === false)) return queueOfflineRequest();
    try {
      const result = await requestJson(`${configuredApiBaseUrl()}/v1/organization/leave-requests`, { method: "POST", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }, "Unable to submit the leave request.");
      const request = formatLeaveRequest(result);
      setLeaveRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      return { ok: true, request };
    } catch (error) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return queueOfflineRequest();
      return { ok: false, error: error instanceof Error ? error.message : "Unable to submit the leave request." };
    }
  }, [authToken, authUser?.id, can, isOnline]);

  const reviewException = useCallback(async (id, status) => {
    if (!authToken || !["enterprise_admin", "hr", "manager"].includes(activeRole)) return { ok: false, error: "This role cannot review attendance exceptions." };
    try {
      const result = await requestJson(`${configuredApiBaseUrl()}/v1/organization/exceptions/${id}/review`, { method: "POST", headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status }) }, "Unable to review the attendance exception.");
      setExceptions((current) => current.map((item) => item.id === id ? result : item));
      return { ok: true, exception: result };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to review the attendance exception." };
    }
  }, [activeRole, authToken]);

  const reviewManagerLeave = useCallback(async (id, status) => {
    if (!can("review_leave")) return { ok: false, error: "This role cannot review leave." };
    if (!authToken) {
      setManagerLeaveRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request));
      return { ok: true };
    }
    try {
      const decision = status === "Approved" ? "approve" : "reject";
      const result = await requestJson(`${configuredApiBaseUrl()}/v1/organization/leave-requests/${id}/${decision}`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } }, "Unable to review the leave request.");
      const request = formatLeaveRequest(result);
      setManagerLeaveRequests((current) => current.map((item) => item.id === id ? request : item));
      setLeaveRequests((current) => current.map((item) => item.id === id ? request : item));
      setDirectoryUsers((current) => applyApprovedLeaveToDirectory(current, [request]));
      if (request.requesterId === authUser?.id) setEntries((current) => mergeApprovedLeaveEntries(current, [request]));
      return { ok: true, request };
    } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Unable to review the leave request." }; }
  }, [authToken, authUser?.id, can]);

  const value = useMemo(() => ({
    isLoading,
    day,
    entries,
    leaveRequests,
    managerLeaveRequests,
    teamAttendance: directoryUsers.map((user) => ({ ...user, lastActivity: user.lastSeen })),
    directoryUsers,
    teamRequests,
    exceptions,
    teams,
    riskSignals: isDemoMode ? seedRiskSignals : [],
    isDemoMode,
    organization,
    roleOptions,
    activeRole,
    activeRoleMeta,
    currentUser,
    currentUserRecord,
    dataSource,
    dataError,
    isOnline,
    offlineQueueCount,
    offlineQueueError,
    apiBaseUrl: configuredApiBaseUrl(),
    can,
    setActiveRole,
    recordAttendance,
    applyRealtimeAttendance,
    applyVerifiedAttendance,
    applyExceptionUpdate,
    loadExceptions,
    todayComplete,
    attendancePolicy,
    updateAttendancePolicy,
    leavePolicy,
    updateLeavePolicy,
    createEmployeeAccount,
    changeAccountRole,
    removeAccount,
    assignEmployeeToTeam,
    markRecognitionEnrolled,
    enrollRecognition,
    submitLeave,
    flushOfflineLeaveQueue,
    reviewManagerLeave,
    reviewTeamRequest,
    reviewException,
  }), [    isLoading, day, entries, leaveRequests, managerLeaveRequests, teamRequests, exceptions, directoryUsers, teams, organization, activeRole, activeRoleMeta, currentUser, currentUserRecord, dataSource, dataError, isOnline, offlineQueueCount, offlineQueueError, isDemoMode, can, recordAttendance, applyRealtimeAttendance, applyVerifiedAttendance, applyExceptionUpdate, loadExceptions, todayComplete, attendancePolicy, updateAttendancePolicy, leavePolicy, updateLeavePolicy, createEmployeeAccount, changeAccountRole, removeAccount, assignEmployeeToTeam, enrollRecognition, submitLeave, flushOfflineLeaveQueue, reviewManagerLeave, reviewTeamRequest, reviewException, markRecognitionEnrolled]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}
