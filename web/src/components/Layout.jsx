import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Building2, CheckCheck, CircleHelp, FileClock, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Settings2, ShieldCheck, Sparkles, UserRound, Users, Wifi, WifiOff, X } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AppMark } from "./ui/app-ui";
import { useAttendance } from "../context/AttendanceContext";
import OnboardingTour from "./OnboardingTour";
import { useNotifications } from "../context/useNotifications.js";
import { formatPakistanDateTime } from "../lib/time";

const iconMap = { AlertTriangle, LayoutDashboard, FileClock, Users, Sparkles, ShieldCheck, Settings2, UserRound };

const navItems = [
  { name: "Overview", personalName: "My attendance", path: "/app", icon: "LayoutDashboard", roles: ["enterprise_admin", "hr", "manager", "employee"] },
  { name: "Attendance", personalName: "History", path: "/app/history", icon: "FileClock", roles: ["enterprise_admin", "hr", "manager", "employee"] },
  { name: "People", path: "/app/team", icon: "Users", roles: ["enterprise_admin", "hr", "manager"] },
  { name: "Insights", path: "/app/insights", icon: "Sparkles", roles: ["enterprise_admin", "hr", "manager"] },
  { name: "Exceptions", path: "/app/exceptions", icon: "AlertTriangle", roles: ["enterprise_admin", "hr", "manager"] },
  { name: "Leave", path: "/app/leave", icon: "ShieldCheck", roles: ["enterprise_admin", "hr", "manager", "employee"] },
  { name: "Profile", path: "/app/profile", icon: "UserRound", roles: ["employee"] },
  { name: "Settings", path: "/app/profile", icon: "Settings2", roles: ["enterprise_admin", "hr", "manager"] },
];

function NavItem({ item, activeRole, onNavigate, collapsed = false }) {
  const Icon = iconMap[item.icon];
  const label = activeRole === "employee" && item.personalName ? item.personalName : item.name;

  return <NavLink
    to={item.path}
    onClick={onNavigate}
    end={item.path === "/app"}
    title={collapsed ? label : undefined}
    className={({ isActive }) => `group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm transition-[background-color,color,transform] duration-180 ease-out ${collapsed ? "justify-center px-2" : ""} ${isActive ? "bg-blue-soft text-blue font-semibold shadow-[0_4px_14px_rgba(90,169,230,0.08)]" : "text-muted hover:bg-white hover:text-ink"}`}
  >
    {({ isActive }) => <><Icon size={18} strokeWidth={isActive ? 2.4 : 2} /><span className={collapsed ? "sr-only" : ""}>{label}</span></>}
  </NavLink>;
}

function WorkspaceIdentity({ collapsed, isOrganizationIdentity, organization, currentUser }) {
  return <div className={`ui-surface mb-5 motion-surface ${collapsed ? "p-2" : "p-3"}`} title={collapsed ? (isOrganizationIdentity ? organization.name : currentUser.name) : undefined}>
    <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink text-xs font-bold text-white">{isOrganizationIdentity ? "NL" : currentUser.initials}</div><div className={`min-w-0 flex-1 ${collapsed ? "hidden" : ""}`}><p className="truncate text-xs font-bold text-ink">{isOrganizationIdentity ? organization.name : currentUser.name}</p><p className="truncate text-[11px] text-muted">{isOrganizationIdentity ? `${organization.locations} locations · ${organization.employees} people` : currentUser.email}</p></div><Building2 size={15} className={collapsed ? "sr-only" : "text-muted"} /></div>
  </div>;
}

function connectionLabel(connectionState) {
  return {
    connected: "Realtime live",
    connecting: "Connecting",
    reconnecting: "Reconnecting",
    error: "Realtime unavailable",
    disabled: "Realtime off",
  }[connectionState] || "Realtime off";
}

function NotificationPanel({ notifications, unreadCount, connectionState, markAllRead, clearNotifications, onClose }) {
  const navigate = useNavigate();
  const live = connectionState === "connected";
  return <div className="ui-surface absolute right-0 top-12 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden motion-enter" role="dialog" aria-label="Notifications">
    <div className="flex items-center justify-between border-b border-line px-4 py-3.5"><div><p className="text-sm font-extrabold text-ink">Notifications</p><p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted">{live ? <Wifi size={12} className="text-mint" /> : <WifiOff size={12} className="text-muted" />}{connectionLabel(connectionState)}</p></div><div className="flex items-center gap-1"><button type="button" onClick={markAllRead} className="rounded-lg p-2 text-muted hover:bg-sky-soft hover:text-ink" aria-label="Mark all notifications as read" title="Mark all as read"><CheckCheck size={16} /></button><button type="button" onClick={clearNotifications} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-muted hover:bg-sky-soft hover:text-ink">Clear</button><button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-sky-soft hover:text-ink" aria-label="Close notifications" title="Close notifications"><X size={16} /></button></div></div>
    <div className="max-h-[340px] overflow-y-auto p-2">{notifications.length === 0 ? <div className="px-4 py-8 text-center"><Bell size={22} className="mx-auto text-ice" /><p className="mt-3 text-sm font-bold text-ink">You’re all caught up</p><p className="mt-1 text-xs leading-5 text-muted">Attendance and workspace updates will appear here in realtime.</p></div> : notifications.map((notification) => <button type="button" key={notification.id} onClick={() => { if (notification.data?.action_url) { navigate(notification.data.action_url); onClose(); } }} className={`block w-full rounded-2xl px-3 py-3 text-left transition-colors ${notification.read ? "bg-white" : "bg-sky-soft"} ${notification.data?.action_url ? "cursor-pointer hover:bg-blue-soft" : "cursor-default"}`}><div className="flex items-start gap-2.5"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read ? "bg-ice" : "bg-blue"}`} /><div className="min-w-0"><p className="text-xs font-bold text-ink">{notification.title || "Workspace update"}</p><p className="mt-1 text-xs leading-5 text-muted">{notification.message || "A new update is available."}</p><p className="mt-1.5 text-[10px] font-semibold text-muted">{notification.timestamp ? formatPakistanDateTime(notification.timestamp) : "Just now"}</p>{notification.data?.action_url && <p className="mt-2 text-[10px] font-bold text-blue">Open details</p>}</div></div></button>)}</div>{unreadCount > 0 && <div className="border-t border-line bg-canvas px-4 py-2.5 text-[11px] font-bold text-blue">{unreadCount} unread update{unreadCount === 1 ? "" : "s"}</div>}
  </div>;
}

export default function Layout({ demoMode = false }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("secure-attendance-sidebar") === "collapsed");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationMenuRef = useRef(null);
  const navigate = useNavigate();
  const { organization, activeRole, activeRoleMeta, currentUser, dataSource, isOnline, offlineQueueCount } = useAttendance();
  const { notifications, unreadCount, connectionState, markAllRead, clearNotifications } = useNotifications();
  const visibleItems = navItems.filter((item) => item.roles.includes(activeRole));
  const isOrganizationIdentity = activeRole === "enterprise_admin";

  useEffect(() => {
    window.localStorage.setItem("secure-attendance-sidebar", desktopCollapsed ? "collapsed" : "expanded");
  }, [desktopCollapsed]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!notificationMenuRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [notificationsOpen]);

  const sidebarLabel = isOrganizationIdentity ? "Organization workspace" : "Employee workspace";
  const sidebar = (collapsed = false, mobile = false) => <aside className={`${mobile ? "relative flex h-full w-[290px] flex-col bg-[#F9F9F9] p-5 shadow-2xl motion-enter" : `hidden shrink-0 flex-col border-r border-line bg-[#F9F9F9] px-3 py-5 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex ${collapsed ? "w-[78px]" : "w-[248px]"}`}`}>
    <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between gap-3"} ${mobile ? "mb-8" : "px-1 pb-7"}`}>
      <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`} title={collapsed ? "Facial Recognition Attendance" : undefined}><AppMark size={mobile ? 36 : collapsed ? 34 : 38} /><div className={collapsed ? "hidden" : "min-w-0"}><p className="truncate text-sm font-bold tracking-tight text-ink">Facial Recognition Attendance</p><p className="text-[11px] font-medium text-muted">{sidebarLabel}</p></div></div>
      {mobile && <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-muted transition-colors hover:bg-white hover:text-ink" aria-label="Close navigation"><X size={19} /></button>}
    </div>

    {!mobile && <WorkspaceIdentity collapsed={collapsed} isOrganizationIdentity={isOrganizationIdentity} organization={organization} currentUser={currentUser} />}
    <nav className={`flex-1 ${collapsed ? "space-y-2" : "space-y-1"}`} aria-label={mobile ? "Mobile navigation" : "Workspace navigation"}><p className={collapsed ? "sr-only" : "px-3.5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5E7488]"}>{isOrganizationIdentity ? "Organization" : "Your workspace"}</p>{visibleItems.map((item) => <NavItem key={`${item.path}-${item.name}`} item={item} activeRole={activeRole} collapsed={collapsed && !mobile} onNavigate={mobile ? () => setMobileOpen(false) : undefined} />)}</nav>

    {mobile ? <div className="mt-auto rounded-2xl bg-blue-soft p-4"><div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-white text-blue"><CircleHelp size={18} /></div><p className="text-sm font-bold text-ink">Need a hand?</p><p className="mt-1 text-xs leading-5 text-muted">Review attendance and access guidance in your profile.</p></div> : <div className={`mt-5 border-t border-line pt-4 ${collapsed ? "px-0" : ""}`}><NavLink to="/app/profile" className={`flex w-full items-center rounded-2xl p-2 text-left transition-[background-color,transform] duration-150 hover:bg-white ${collapsed ? "justify-center" : "gap-3"}`} title={collapsed ? "Open profile" : undefined}><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-soft text-xs font-bold text-blue">{currentUser.initials}</div><div className={`min-w-0 flex-1 ${collapsed ? "hidden" : ""}`}><p className="truncate text-xs font-bold text-ink">{currentUser.name}</p><p className="truncate text-[11px] text-muted">{activeRoleMeta.label}</p></div><UserRound size={15} className={collapsed ? "sr-only" : "text-muted"} /></NavLink></div>}
  </aside>;

  return <div className="min-h-screen bg-canvas text-ink"><div className="mx-auto flex min-h-screen max-w-[1600px]">{sidebar(desktopCollapsed)}<div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-line bg-[#F9F9F9]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-10"><div className="flex items-center gap-3"><button className="rounded-xl p-2 text-muted transition-[background-color,transform] hover:bg-white hover:text-ink active:scale-95 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={20} /></button><button className="hidden rounded-xl p-2 text-muted transition-[background-color,transform] hover:bg-white hover:text-ink active:scale-95 lg:inline-flex" onClick={() => setDesktopCollapsed((collapsed) => !collapsed)} aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!desktopCollapsed}>{desktopCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><div className="lg:hidden"><AppMark size={32} /></div><div className="hidden items-center gap-2 text-xs text-muted sm:flex"><span>{isOrganizationIdentity ? organization.workspace : "Personal attendance"}</span><span className="text-[#BCE1F9]">/</span><span className="font-semibold text-ink">{activeRoleMeta.label}</span></div></div><div className="flex items-center gap-2.5"><div className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted md:flex"><span className={`size-1.5 rounded-full ${connectionState === "connected" ? "bg-mint" : "bg-ice"}`} />{connectionLabel(connectionState)}</div>{(!isOnline || dataSource === "offline-cache" || offlineQueueCount > 0) && <div className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-vanilla-soft px-3 py-1.5 text-xs font-semibold text-[#735C00] md:flex" title={!isOnline ? "The last synchronized workspace is available while offline." : "Pending changes will sync automatically."}>{isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}{isOnline ? `${offlineQueueCount} pending sync` : "Offline · cached data"}</div>}<div ref={notificationMenuRef} className="relative"><button onClick={() => setNotificationsOpen((open) => !open)} className="relative flex size-10 items-center justify-center rounded-xl border border-line bg-white text-muted transition-[color,transform] duration-150 hover:text-ink active:scale-95" aria-label="Open notifications" aria-expanded={notificationsOpen}><Bell size={18} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[9px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>{notificationsOpen && <NotificationPanel notifications={notifications} unreadCount={unreadCount} connectionState={connectionState} markAllRead={markAllRead} clearNotifications={clearNotifications} onClose={() => setNotificationsOpen(false)} />}</div><button onClick={() => navigate(demoMode ? "/login" : "/app/profile")} className="flex size-10 items-center justify-center rounded-xl bg-blue text-xs font-bold text-white transition-[transform,box-shadow] hover:shadow-[0_6px_18px_rgba(90,169,230,0.28)] active:scale-95" aria-label={demoMode ? "Sign in to workspace" : "Open profile"}>{demoMode ? "→" : currentUser.initials}</button></div></header>{demoMode && <div className="border-b border-amber-200 bg-vanilla-soft px-4 py-3 sm:px-6 lg:px-10"><div className="mx-auto flex max-w-[1200px] flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"><p className="font-semibold text-[#735C00]"><strong>Demo workspace:</strong> all people, attendance, and insight values are seeded sample data and are not a live organization.</p><div className="flex items-center gap-3"><button type="button" onClick={() => navigate("/login")} className="font-bold text-blue-deep hover:underline">Sign in</button><button type="button" onClick={() => navigate("/register")} className="rounded-lg bg-blue-deep px-3 py-1.5 font-bold text-white hover:bg-ink">Create an organization account</button></div></div></div>}<main className="flex-1 overflow-y-auto"><Outlet /></main></div></div>{!demoMode && <OnboardingTour />}{mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-ink/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" /><div className="relative h-full w-fit">{sidebar(false, true)}</div></div>}</div>;
}
