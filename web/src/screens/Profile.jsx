import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { PageTitle, FrostedCard, Skeleton } from "../components/ui/app-ui";
import { API_BASE_URL, palette } from "../constants";
import { requestJson } from "../lib/api";
import { IconSymbol } from "../components/ui/icon-symbol";
import AuthenticatedAvatar from "../components/AuthenticatedAvatar";
import { useAttendance } from "../context/AttendanceContext";

function roleLabel(role) {
  return {
    enterprise_admin: "Organization owner",
    hr: "HR",
    manager: "Manager",
    employee: "Employee",
  }[role] || "Team member";
}

function roleDescription(role) {
  return {
    enterprise_admin: "Owns the organization attendance workspace.",
    hr: "Creates accounts and manages the organization directory.",
    manager: "Manages an assigned team of existing employees.",
    employee: "Uses personal attendance and leave tools.",
  }[role] || "Facial Recognition Attendance workspace member.";
}

function initialsFor(name = "") {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SA";
}

function SettingRow({ icon, iconColor, title, description, children, last = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-4 md:px-5 ${last ? "" : "border-b border-line/70"}`}>
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-soft">
          <IconSymbol name={icon} size={19} color={iconColor || palette.blue} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-ink">{title}</p>
          <p className="mt-1 text-[12px] leading-5 text-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ enabled, onToggle, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors duration-300 ${enabled ? "bg-blue" : "bg-[#D8E6F0]"}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function Profile() {
  const { isLoading, currentUser, currentUserRecord, activeRole, activeRoleMeta, can } = useAttendance();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const authToken = useAuthStore((state) => state.token);
  const isDemoWorkspace = !authToken;
  const [pinEnabled, setPinEnabled] = useState(false);
  const [faceIdEnabled, setFaceIdEnabled] = useState(true);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const name = currentUser?.name || "Facial Recognition Attendance member";
  const email = currentUser?.email || "Not available";
  const role = roleLabel(activeRole);
  const team = currentUserRecord?.department || (activeRole === "enterprise_admin" ? "Organization workspace" : "Unassigned team");
  const isEnrolled = currentUserRecord?.recognitionStatus === "enrolled";
  const accountStatus = currentUserRecord?.accountStatus || "active";

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const savePin = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(pin) || pin !== pinConfirm) return showNotice("Use the same six-digit PIN in both fields.");
    setPinLoading(true);
    try {
      await requestJson(`${API_BASE_URL.replace(/\/$/, "")}/v1/attendance/pin`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ pin }) }, "Could not save attendance PIN.");
      setPinEnabled(true);
      setPin("");
      setPinConfirm("");
      showNotice("Attendance PIN saved securely.");
    } catch (error) {
      showNotice(error.message);
    } finally {
      setPinLoading(false);
    }
  };

  const uploadProfileImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !authToken) return;
    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      await requestJson(`${API_BASE_URL.replace(/\/$/, "")}/v1/auth/profile-image`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` }, body: formData }, "Could not upload profile image.");
      window.location.reload();
    } catch (error) {
      showNotice(error.message);
    } finally {
      setImageLoading(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (!API_BASE_URL) return showNotice("Password service is not configured. Set VITE_API_BASE_URL in .env.local.");
    setPasswordLoading(true);
    try {
      const response = await requestJson(`${API_BASE_URL.replace(/\/$/, "")}/v1/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${useAuthStore.getState().token}` },
        body: JSON.stringify(passwords),
      }, "Could not change password.");
      if (response?.access_token) useAuthStore.getState().updateToken(response.access_token);
      setPasswords({ current_password: "", new_password: "" });
      showNotice("Password changed successfully.");
    } catch (error) {
      showNotice(error.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-canvas px-4 py-5 pb-safe sm:px-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <PageTitle eyebrow="Settings" title="Profile" />
        <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted">Manage your account details, attendance security, and workspace preferences.</p>

        {notice && (
          <div className="motion-enter mt-5 flex items-center gap-2 rounded-2xl border border-blue/20 bg-sky-soft px-4 py-3 text-[13px] font-semibold text-ink" role="status">
            <IconSymbol name="checkmark.circle.fill" size={17} color={palette.blue} />
            {notice}
          </div>
        )}

        <div className="mt-7 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(250px,0.78fr)_minmax(0,1.5fr)]">
          <div className="space-y-5">
            <FrostedCard className="overflow-hidden bg-white/95 p-0">
              <div className="h-24 bg-[linear-gradient(135deg,#5AA9E6_0%,#BCE1F9_58%,#FFF5C7_100%)]" />
              <div className="px-5 pb-5">
                <div className="-mt-10 h-20 w-20 overflow-hidden rounded-[24px] border-4 border-white bg-blue text-[22px] font-extrabold text-white shadow-[0_10px_28px_rgba(90,169,230,0.28)]">
                  {isLoading ? <Skeleton className="h-full w-full rounded-[20px] bg-white/50" /> : <AuthenticatedAvatar src={currentUserRecord?.profileImageUrl} name={name} className="h-full w-full object-cover" fallbackClassName="flex h-full w-full items-center justify-center" />}
                </div>
                {!isLoading && !isDemoWorkspace && <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold text-ink hover:bg-canvas"><IconSymbol name="photo.fill" size={15} color={palette.blue} />{imageLoading ? "Uploading…" : "Upload profile image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadProfileImage} disabled={imageLoading} /></label>}
                {isLoading ? (
                  <div className="mt-4 space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-32 rounded-full" /></div>
                ) : (
                  <>
                    <h2 className="mt-4 text-[21px] font-extrabold tracking-tight text-ink">{name}</h2>
                    <p className="mt-1 text-[13px] font-medium text-muted">{role} · {team}</p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1.5 text-[11px] font-bold text-mint">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                      {accountStatus === "active" ? "Active account" : accountStatus}
                    </div>
                  </>
                )}
              </div>
            </FrostedCard>

            <FrostedCard className="bg-white/95 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-vanilla-soft"><IconSymbol name="person.crop.circle" size={19} color={palette.gold} /></div>
                <div>
                  <p className="text-[13px] font-bold text-ink">Your access</p>
                  <p className="mt-1 text-[12px] leading-5 text-muted">{activeRoleMeta?.description || roleDescription(activeRole)}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-canvas px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Role</p><p className="mt-1 text-[13px] font-bold text-ink">{role}</p></div>
                <div className="rounded-2xl bg-canvas px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Status</p><p className="mt-1 text-[13px] font-bold text-mint">Active</p></div>
              </div>
            </FrostedCard>

            <FrostedCard className="bg-white/95 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Contact details</p>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-soft"><IconSymbol name="envelope.fill" size={16} color={palette.blue} /></div><div className="min-w-0"><p className="text-[11px] text-muted">Work email</p><p className="truncate text-[13px] font-bold text-ink">{email}</p></div></div>
                <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vanilla-soft"><IconSymbol name="building.2.fill" size={16} color={palette.gold} /></div><div><p className="text-[11px] text-muted">Organization</p><p className="text-[13px] font-bold text-ink">Northstar Labs</p></div></div>
              </div>
            </FrostedCard>
          </div>

          <div className="space-y-5">
            <section>
              <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-[17px] font-extrabold text-ink">Attendance security</h2><p className="mt-1 text-[12px] text-muted">Keep your identity and check-in flow protected.</p></div><span className="rounded-full bg-mint-soft px-2.5 py-1 text-[10px] font-bold text-mint">Protected</span></div>
              <FrostedCard className="bg-white/95 p-0">
                <SettingRow icon="faceid" title="Face verification" description={isEnrolled ? "Your attendance photo is enrolled and ready." : "Enroll a photo before your first attendance capture."}>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isEnrolled ? "bg-mint-soft text-mint" : "bg-vanilla-soft text-gold"}`}>{isEnrolled ? "Enrolled" : "Action needed"}</span>
                    {!isDemoWorkspace && can("enroll_self") && (
                      <button type="button" onClick={() => navigate("/verify?mode=enroll")} className="rounded-xl border border-blue/25 bg-sky-soft px-3 py-2 text-[11px] font-bold text-blue-deep transition-[background-color,transform] hover:bg-blue/15 active:scale-[0.98]">
                        {isEnrolled ? "Retake enrollment photo" : "Enroll attendance photo"}
                      </button>
                    )}
                  </div>
                </SettingRow>
                <SettingRow icon="shield.fill" iconColor={palette.gold} title="Require biometrics for attendance" description="Use the enrolled photo when recording attendance.">
                  <Toggle enabled={faceIdEnabled} onToggle={() => setFaceIdEnabled((value) => !value)} label="Require biometrics for attendance" />
                </SettingRow>
                <SettingRow icon="lock.fill" iconColor={palette.ink} title="PIN fallback" description={pinEnabled ? "A six-digit fallback is ready for camera failures." : "Set a six-digit fallback for camera failures."} last>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${pinEnabled ? "bg-mint-soft text-mint" : "bg-vanilla-soft text-gold"}`}>{pinEnabled ? "Ready" : "Not set"}</span>
                </SettingRow>
                <form onSubmit={savePin} className="grid gap-2 border-t border-line/70 px-4 py-4 md:grid-cols-[1fr_1fr_auto] md:px-5">
                  <input required inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="New 6-digit PIN" className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm tracking-[0.2em] outline-none focus:border-blue" />
                  <input required inputMode="numeric" autoComplete="new-password" maxLength={6} value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Repeat PIN" className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm tracking-[0.2em] outline-none focus:border-blue" />
                  <button type="submit" disabled={pinLoading || isDemoWorkspace || pin.length !== 6 || pinConfirm.length !== 6} className="rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{pinLoading ? "Saving…" : "Save PIN"}</button>
                </form>
              </FrostedCard>
            </section>

            <section>
              <div className="mb-3"><h2 className="text-[17px] font-extrabold text-ink">Password</h2><p className="mt-1 text-[12px] text-muted">Change your workspace login password.</p></div>
              <FrostedCard className="bg-white/95 p-5">
                <form onSubmit={changePassword} className="space-y-3">
                  <div className="relative">
                    <input aria-label="Current password" required minLength={1} maxLength={128} type={showCurrentPassword ? "text" : "password"} value={passwords.current_password} onChange={(event) => setPasswords((value) => ({ ...value, current_password: event.target.value }))} placeholder="Current password" className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 pr-10 text-sm outline-none focus:border-blue" />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink focus:outline-none">
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="relative">
                    <input aria-label="New password" required minLength={12} maxLength={128} type={showNewPassword ? "text" : "password"} value={passwords.new_password} onChange={(event) => setPasswords((value) => ({ ...value, new_password: event.target.value }))} placeholder="New password (12+ characters)" className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 pr-10 text-sm outline-none focus:border-blue" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink focus:outline-none">
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button type="submit" disabled={passwordLoading || isDemoWorkspace} className="rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{passwordLoading ? "Updating…" : "Change password"}</button>
                </form>
              </FrostedCard>
            </section>

            <section>
              <div className="mb-3"><h2 className="text-[17px] font-extrabold text-ink">Support & information</h2><p className="mt-1 text-[12px] text-muted">Useful links for your Facial Recognition Attendance workspace.</p></div>
              <FrostedCard className="bg-white/95 p-0">
                <button type="button" onClick={() => showNotice("Help Center is ready to connect to your support portal.")} className="group flex w-full items-center justify-between gap-4 border-b border-line/70 px-4 py-4 text-left transition-colors hover:bg-sky-soft/45 md:px-5"><span className="flex items-center gap-3.5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-soft"><IconSymbol name="questionmark.circle.fill" size={19} color={palette.blue} /></span><span><span className="block text-[14px] font-bold text-ink">Help Center</span><span className="mt-1 block text-[12px] text-muted">Guides for enrollment, attendance, and teams.</span></span></span><IconSymbol name="chevron.right" size={16} color={palette.muted} /></button>
                <button type="button" onClick={() => showNotice("Facial Recognition Attendance · v1.0 demo workspace")} className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-sky-soft/45 md:px-5"><span className="flex items-center gap-3.5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-vanilla-soft"><IconSymbol name="info.circle.fill" size={19} color={palette.gold} /></span><span><span className="block text-[14px] font-bold text-ink">About Facial Recognition Attendance</span><span className="mt-1 block text-[12px] text-muted">Privacy-first attendance for modern organizations.</span></span></span><IconSymbol name="chevron.right" size={16} color={palette.muted} /></button>
              </FrostedCard>
            </section>

            <div className="flex flex-col gap-3 rounded-3xl border border-rose/15 bg-rose-soft/45 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[13px] font-bold text-ink">Need to leave this workspace?</p><p className="mt-1 text-[12px] text-muted">{isDemoWorkspace ? "Sign out is unavailable for the public demo workspace." : "End your current Facial Recognition Attendance session."}</p></div><button type="button" onClick={() => { if (isDemoWorkspace) { showNotice("Sign out is disabled in the public demo only."); return; } logout(); navigate("/login", { replace: true }); }} className="rounded-xl px-4 py-2 text-[12px] font-bold text-rose transition-colors hover:bg-rose-soft">Sign out</button></div>

            {!can("view_profile") && <p className="text-[11px] text-muted">Profile settings are shown in preview mode for the current organization identity.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
