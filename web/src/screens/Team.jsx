import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Download, Eye, EyeOff, Info, MoreHorizontal, Plus, Search, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import AuthenticatedAvatar from "../components/AuthenticatedAvatar";
import { useAttendance } from "../context/AttendanceContext";

const statusStyles = { Present: "bg-mint-soft text-mint", "Checked out": "bg-blue-soft text-blue", Late: "bg-amber-soft text-amber", "On leave": "bg-[#EAF3F9] text-[#5AA9E6]", Unverified: "bg-rose-soft text-rose" };
const roleLabels = { employee: "Employee", manager: "Manager", hr: "HR", enterprise_admin: "Organization admin" };

export default function Team() {
  const navigate = useNavigate();
  const { directoryUsers, teams, teamRequests, activeRole, currentUser, currentUserRecord, can, createEmployeeAccount, changeAccountRole, removeAccount, assignEmployeeToTeam, reviewTeamRequest } = useAttendance();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionUser, setActionUser] = useState(null);
  const [menuUser, setMenuUser] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [roleDraft, setRoleDraft] = useState("employee");
  const [form, setForm] = useState({ name: "", email: "", password: "", employee_id: "", department: "", role: "employee" });
  const [feedback, setFeedback] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!menuUser) return undefined;
    const dismissMenu = (event) => {
      if (menuRef.current?.contains(event.target) || menuButtonRef.current?.contains(event.target)) return;
      setMenuUser(null);
      setMenuPosition(null);
    };
    const dismissOnEscape = (event) => {
      if (event.key === "Escape") dismissMenu(event);
    };
    document.addEventListener("pointerdown", dismissMenu);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissMenu);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [menuUser]);

  const currentTeamId = currentUserRecord?.teamId ?? currentUser.teamId;
  const currentTeam = teams.find((team) => team.id === currentTeamId);
  const people = useMemo(() => directoryUsers.map((member) => ({ ...member, roleLabel: roleLabels[member.role] ?? member.role, teamName: teams.find((team) => team.id === member.teamId)?.name ?? "Unassigned", lastActivity: member.lastSeen })), [directoryUsers, teams]);
  const scopedPeople = activeRole === "manager" ? people.filter((person) => person.role === "employee" && (!person.teamId || person.teamId === currentTeamId)) : people;
  const filtered = scopedPeople.filter((person) => {
    const matchesQuery = `${person.name} ${person.department} ${person.email}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "All statuses" || person.status === status;
    const matchesRole = roleFilter === "All roles" || person.roleLabel === roleFilter;
    return matchesQuery && matchesStatus && matchesRole;
  });

  const handleCreate = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const employeeId = form.employee_id.trim();
    if (name.length < 2) return setFeedback({ tone: "error", text: "Name must contain at least 2 characters." });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setFeedback({ tone: "error", text: "Enter a valid work email." });
    if (form.password.length < 12) return setFeedback({ tone: "error", text: "Temporary password must contain at least 12 characters." });
    if (employeeId && !/^[A-Za-z0-9._:@+-]+$/.test(employeeId)) return setFeedback({ tone: "error", text: "Employee ID may use letters, numbers, dots, underscores, colons, at-signs, plus signs, and hyphens." });
    if (form.department.trim().length > 120) return setFeedback({ tone: "error", text: "Department must be 120 characters or fewer." });
    const result = await createEmployeeAccount({ ...form, name, email, employee_id: employeeId, department: form.department.trim() });
    if (!result.ok) { setFeedback({ tone: "error", text: result.error }); return; }
    setFeedback({ tone: "success", text: `${result.user.name} now has a ${result.user.role} account. They still need to enroll an attendance photo.` });
    setForm({ name: "", email: "", password: "", employee_id: "", department: "", role: "employee" });
    setCreateOpen(false);
  };

  const handleRoleChange = async () => {
    if (!actionUser) return;
    const result = await changeAccountRole(actionUser.id, roleDraft);
    if (!result.ok) { setFeedback({ tone: "error", text: result.error }); return; }
    setFeedback({ tone: "success", text: `${actionUser.name} is now ${result.account.role_label}.` });
    setActionUser(null);
  };

  const handleRemove = async () => {
    if (!actionUser || !window.confirm(`Remove ${actionUser.name} from this organization? Their attendance history will be retained, but they will no longer be able to sign in.`)) return;
    const result = await removeAccount(actionUser.id);
    if (!result.ok) { setFeedback({ tone: "error", text: result.error }); return; }
    setFeedback({ tone: "success", text: `${actionUser.name} was removed from the organization.` });
    setActionUser(null);
  };

  const handleAssign = async (teamId) => {
    if (!selectedUser) return;
    const result = await assignEmployeeToTeam(selectedUser.id, teamId);
    if (!result.ok) { setFeedback({ tone: "error", text: result.error }); return; }
    setFeedback({ tone: "success", text: result.requested ? `Request sent to HR or the organization owner for ${selectedUser.name}.` : `${selectedUser.name} was added to ${teams.find((team) => team.id === result.teamId)?.name ?? "the team"}.` });
    setAssignOpen(false);
    setSelectedUser(null);
  };

  if (!can("view_people")) {
    return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-10"><div className="rounded-[28px] border border-line bg-white p-8 text-center shadow-[0_12px_34px_rgba(23,50,77,0.06)] motion-enter"><ShieldCheck size={28} className="mx-auto text-rose" /><h1 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-ink">People is not part of your access</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Employees do not create accounts or manage other people. Ask HR to create an account, or ask your manager to assign an existing account to their team.</p></div></div>;
  }

  const isOwner = ["enterprise_admin", "super_admin"].includes(activeRole);
  const isHr = activeRole === "hr";
  const isManager = activeRole === "manager";
  const canCreate = isOwner || isHr;
  const canReviewRequests = isOwner || isHr;
  const employeeCount = directoryUsers.filter((person) => person.role === "employee").length;
  const unassignedCount = directoryUsers.filter((person) => person.role === "employee" && !person.teamId).length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 px-4 py-6 sm:px-6 lg:px-10 lg:py-8 motion-enter">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue">{isManager ? "Team access" : "People & access"}</p><h1 className="text-[30px] font-bold tracking-[-0.03em] text-ink sm:text-[38px]">{isManager ? `${currentTeam?.name ?? "Your team"}` : "Organization directory"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{isManager ? "Find an existing employee by name, email, or employee ID and request that HR or the organization owner add them to your team." : "The organization owner and HR provision accounts. The owner assigns HR or manager access; managers never create accounts."}</p></div><div className="flex flex-wrap items-center gap-2"><button className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-canvas"><Download size={15} /> Export directory</button>{canCreate && <button onClick={() => { setFeedback(null); setCreateOpen(true); }} className="flex items-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(90,169,230,0.18)]"><UserPlus size={16} /> Create account</button>}</div></section>

      {feedback && <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm motion-enter ${feedback.tone === "success" ? "border-mint/20 bg-mint-soft text-mint" : "border-rose/20 bg-rose-soft text-rose"}`}><Info size={17} className="mt-0.5 shrink-0" /><p>{feedback.text}</p><button className="ml-auto" onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={16} /></button></div>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 motion-stagger"><div className="motion-surface rounded-[20px] border border-line bg-white p-4"><UsersRound size={18} className="text-blue" /><p className="mt-4 text-[11px] font-semibold text-muted">Employee accounts</p><p className="mt-1 text-2xl font-bold text-ink">{employeeCount}</p></div><div className="motion-surface rounded-[20px] border border-line bg-white p-4"><Check size={18} className="text-mint" /><p className="mt-4 text-[11px] font-semibold text-muted">Attendance enrolled</p><p className="mt-1 text-2xl font-bold text-ink">{directoryUsers.filter((person) => person.recognitionStatus === "enrolled").length}</p></div><div className="motion-surface rounded-[20px] border border-line bg-white p-4"><ShieldCheck size={18} className="text-[#5AA9E6]" /><p className="mt-4 text-[11px] font-semibold text-muted">Active accounts</p><p className="mt-1 text-2xl font-bold text-ink">{directoryUsers.filter((person) => person.accountStatus === "active").length}</p></div><div className="motion-surface rounded-[20px] border border-line bg-white p-4"><UsersRound size={18} className="text-amber" /><p className="mt-4 text-[11px] font-semibold text-muted">Awaiting team</p><p className="mt-1 text-2xl font-bold text-ink">{unassignedCount}</p></div></section>

      {canCreate && <div className="flex items-start gap-3 rounded-2xl border border-blue/15 bg-blue-soft px-4 py-3 text-xs leading-5 text-blue"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><p><strong>{isOwner ? "Organization owner control:" : "HR account gate:"}</strong> {isOwner ? "Create accounts and assign HR or manager roles for this workspace." : "Create employee accounts. Managers can only request existing employees after you provision them."}</p></div>}
      {isManager && <div className="flex items-start gap-3 rounded-2xl border border-amber/15 bg-amber-soft px-4 py-3 text-xs leading-5 text-amber"><UsersRound size={17} className="mt-0.5 shrink-0" /><p><strong>Manager scope:</strong> search existing employee accounts by name, email, or employee ID. Your request is sent to HR or the organization owner for approval.</p></div>}
      {canReviewRequests && teamRequests.filter((item) => item.status === "pending").length > 0 && <section className="rounded-[24px] border border-amber/20 bg-amber-soft p-5"><div className="flex items-center gap-2 text-sm font-bold text-ink"><ShieldCheck size={17} className="text-amber" /> Pending team requests</div><div className="mt-3 space-y-2">{teamRequests.filter((item) => item.status === "pending").map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-ink">{item.employee_name} → {item.team_name}</p><p className="mt-1 text-[11px] text-muted">Requested by {item.requested_by_name} · {item.employee_email}</p></div><div className="flex gap-2"><button onClick={async () => { const result = await reviewTeamRequest(item.id, "reject"); if (!result.ok) setFeedback({ tone: "error", text: result.error }); }} className="rounded-lg border border-line px-3 py-2 text-[10px] font-bold text-muted">Reject</button><button onClick={async () => { const result = await reviewTeamRequest(item.id, "approve"); if (!result.ok) setFeedback({ tone: "error", text: result.error }); }} className="rounded-lg bg-blue px-3 py-2 text-[10px] font-bold text-white">Approve</button></div></div>)}</div></section>}

      <section className="relative rounded-[24px] border border-line bg-white shadow-[0_8px_26px_rgba(23,50,77,0.045)] motion-surface"><div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="relative flex-1 sm:max-w-[330px]"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isManager ? "Search employees" : "Search people or teams"} className="h-10 w-full rounded-xl border border-line bg-canvas pl-9 pr-3 text-xs text-ink outline-none placeholder:text-[#5E7488] focus:border-blue/40 focus:ring-4 focus:ring-blue/5" /></div><div className="flex items-center gap-2"><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-muted outline-none"><option>All roles</option><option>Employee</option><option>Manager</option><option>HR</option></select><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-muted outline-none"><option>All statuses</option><option>Present</option><option>Late</option><option>On leave</option><option>Unverified</option></select><button className="flex size-10 items-center justify-center rounded-xl border border-line text-muted hover:text-ink" aria-label="More people filters"><MoreHorizontal size={16} /></button></div></div><div className="hidden grid-cols-[1.25fr_0.72fr_0.9fr_0.7fr_0.82fr_108px] gap-4 border-b border-line bg-[#EAF3F9] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted md:grid"><span>Person</span><span>Role</span><span>Team</span><span>Status</span><span>Attendance photo</span><span /></div><div className="divide-y divide-line">{filtered.map((person) => <div key={person.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-[#EAF3F9] md:grid-cols-[1.25fr_0.72fr_0.9fr_0.7fr_0.82fr_108px] md:items-center md:gap-4 md:px-5"><div className="flex min-w-0 items-center gap-3"><AuthenticatedAvatar src={person.profileImageUrl} name={person.name} className="size-9 shrink-0 rounded-xl object-cover" fallbackClassName="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-soft text-[11px] font-bold text-blue" /><div className="min-w-0"><p className="truncate text-xs font-bold text-ink">{person.name}</p><p className="mt-0.5 truncate text-[11px] text-muted">{person.email}</p></div></div><div className="text-xs font-semibold text-muted">{person.roleLabel}</div><div className="text-xs text-muted">{person.teamName}</div><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyles[person.status] ?? "bg-canvas text-muted"}`}>{person.status}</span></div><div className="text-xs font-semibold text-ink">{person.recognitionStatus === "enrolled" ? <span className="inline-flex items-center gap-1 text-mint"><Check size={14} /> Enrolled</span> : person.id === currentUser.id ? <button onClick={() => navigate("/verify?mode=enroll")} className="rounded-lg bg-amber-soft px-2.5 py-1 text-[10px] font-bold text-amber hover:bg-amber/15">Needs photo · Enroll</button> : <span className="text-amber">Needs photo</span>}</div><div className="relative">{isManager && person.role === "employee" && !person.teamId ? <button onClick={() => { setSelectedUser(person); setAssignOpen(true); }} className="flex items-center gap-1.5 rounded-lg bg-blue-soft px-2.5 py-2 text-[10px] font-bold text-blue"><Plus size={13} /> Request</button> : isOwner && person.id !== currentUser.id ? <><button ref={menuUser?.id === person.id ? menuButtonRef : null} onClick={(event) => { const current = menuUser?.id === person.id; if (current) { setMenuUser(null); setMenuPosition(null); return; } const rect = event.currentTarget.getBoundingClientRect(); setMenuUser(person); setMenuPosition({ top: Math.max(12, rect.top - 104), left: Math.min(window.innerWidth - 204, Math.max(12, rect.right - 192)) }); }} className={`rounded-lg p-1.5 ${menuUser?.id === person.id ? "bg-blue-soft text-blue" : "text-muted hover:bg-canvas hover:text-ink"}`} aria-label={`Manage ${person.name}`} aria-expanded={menuUser?.id === person.id}><MoreHorizontal size={16} /></button>{menuUser?.id === person.id && createPortal(<div ref={menuRef} role="menu" style={menuPosition || undefined} className="fixed z-[9999] w-48 overflow-hidden rounded-2xl border border-line bg-white p-1.5 text-left shadow-[0_16px_38px_rgba(23,50,77,0.16)]"><button onClick={() => { setActionUser(person); setRoleDraft(person.role); setMenuUser(null); setMenuPosition(null); }} className="flex w-full items-center rounded-xl px-3 py-2.5 text-xs font-semibold text-ink hover:bg-blue-soft">Change role</button><button onClick={() => { setActionUser(person); setMenuUser(null); setMenuPosition(null); }} className="flex w-full items-center rounded-xl px-3 py-2.5 text-xs font-semibold text-rose hover:bg-rose-soft">Remove person</button></div>, document.body)}</> : <span />}</div></div>)}{filtered.length === 0 && <div className="p-12 text-center"><UsersRound size={24} className="mx-auto text-muted" /><p className="mt-3 text-sm font-bold text-ink">No people match those filters</p><p className="mt-1 text-xs text-muted">Try a different name, role, or status.</p></div>}</div><div className="flex items-center justify-between border-t border-line px-5 py-4 text-[11px] text-muted"><span>Showing {filtered.length} of {scopedPeople.length} accessible records</span><span className="flex items-center gap-1 font-semibold text-mint"><ShieldCheck size={14} /> Role-scoped directory</span></div></section>

      {actionUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[24px] border border-line bg-white p-6 shadow-2xl motion-enter"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue">Owner controls</p><h2 className="mt-2 text-xl font-bold text-ink">Manage {actionUser.name}</h2></div><button onClick={() => setActionUser(null)} className="rounded-lg p-1.5 text-muted hover:bg-canvas" aria-label="Close owner controls"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-muted">Only the organization owner can change roles or remove people. Attendance history is retained when an account is removed.</p><label className="mt-5 block text-xs font-bold text-muted">Role<select value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-blue/40"><option value="employee">Employee</option><option value="manager">Manager</option><option value="hr">HR</option></select></label><div className="mt-6 flex gap-2"><button onClick={handleRemove} className="flex-1 rounded-xl border border-rose/20 bg-rose-soft px-4 py-3 text-xs font-bold text-rose">Remove person</button><button onClick={handleRoleChange} className="flex-1 rounded-xl bg-blue px-4 py-3 text-xs font-bold text-white">Save role</button></div></div></div>}
      {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm"><form onSubmit={handleCreate} className="w-full max-w-md rounded-[24px] border border-line bg-white p-6 shadow-2xl motion-enter"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue">{isOwner ? "Owner provisioning" : "HR provisioning"}</p><h2 className="mt-2 text-xl font-bold text-ink">Create account</h2></div><button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-canvas" aria-label="Close account form"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-muted">The employee receives the credentials you set and enrolls their own attendance photo after signing in.</p><div className="mt-5 space-y-3"><input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Full name" className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-blue/40" /><input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="Work email" className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-blue/40" /><div className="relative"><input required type={showPassword ? "text" : "password"} minLength={12} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Temporary password (12+ characters)" className="h-11 w-full rounded-xl border border-line bg-canvas px-3 pr-10 text-sm outline-none focus:border-blue/40" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink focus:outline-none">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><input value={form.employee_id} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} placeholder="Employee ID (optional)" className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-blue/40" /><input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} placeholder="Department (optional)" className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-blue/40" />{isOwner && <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none"><option value="employee">Employee</option><option value="manager">Manager</option><option value="hr">HR</option></select>}</div><div className="mt-6 flex gap-2"><button type="button" onClick={() => setCreateOpen(false)} className="flex-1 rounded-xl border border-line px-4 py-3 text-xs font-bold text-muted">Cancel</button><button type="submit" className="flex-1 rounded-xl bg-blue px-4 py-3 text-xs font-bold text-white">Create account</button></div></form></div>}
      {assignOpen && selectedUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-[24px] border border-line bg-white p-6 shadow-2xl motion-enter"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue">Team assignment</p><h2 className="mt-2 text-xl font-bold text-ink">Add {selectedUser.name}</h2></div><button onClick={() => setAssignOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-canvas" aria-label="Close assignment dialog"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-muted">This employee account already exists. Submit a request to HR or the organization owner; they approve the assignment without changing the person&apos;s role or account ownership.</p><button onClick={() => handleAssign(currentTeamId)} className="mt-6 flex w-full items-center justify-between rounded-2xl bg-blue-soft px-4 py-4 text-left text-sm font-bold text-blue"><span>Request for {currentTeam?.name ?? "your team"}</span><ChevronDown size={17} className="-rotate-90" /></button></div></div>}
    </div>
  );
}
