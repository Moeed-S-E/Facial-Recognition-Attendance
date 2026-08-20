import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { AppMark } from "../components/ui/app-ui";
import { IconSymbol } from "../components/ui/icon-symbol";

export default function Register() {
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(organizationName, name, email, password);
      navigate("/app", { replace: true });
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-snow px-4 py-8 text-ink sm:px-6 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden lg:block">
          <Link to="/" className="inline-flex items-center gap-3" aria-label="Facial Recognition Attendance home">
            <AppMark size={42} />
            <span className="text-sm font-extrabold tracking-tight">Facial Recognition Attendance</span>
          </Link>
          <p className="mt-16 text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue">Start with your organization</p>
          <h1 className="mt-4 max-w-md text-[clamp(42px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.055em]">Run the real workspace with your own team.</h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-muted">Create the organization account first. You can then sign in as the owner, let HR create accounts, and let managers assign existing people to teams.</p>
          <div className="mt-8 space-y-3 text-[12px] font-semibold text-muted">
            <p className="flex items-center gap-2"><IconSymbol name="checkmark.circle.fill" size={16} color="#5AA9E6" /> The workspace is created locally.</p>
            <p className="flex items-center gap-2"><IconSymbol name="checkmark.circle.fill" size={16} color="#5AA9E6" /> You control the organization data and accounts.</p>
            <p className="flex items-center gap-2"><IconSymbol name="checkmark.circle.fill" size={16} color="#5AA9E6" /> Your live workspace stays separate from sample demo data.</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[480px]">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" aria-label="Facial Recognition Attendance home"><AppMark size={38} /></Link>
            <Link to="/demo" className="text-xs font-bold text-blue-deep hover:text-blue">View demo</Link>
          </div>
          <div className="rounded-[30px] border border-line bg-white p-6 shadow-[0_20px_60px_rgba(23,58,89,0.08)] sm:p-9">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-blue">Enterprise onboarding</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em]">Create your account</h2>
              <p className="mt-3 text-sm leading-6 text-muted">Set up the organization owner account. You can invite HR and employees after signing in.</p>
            </div>

            {error && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert"><IconSymbol name="exclamationmark.triangle.fill" size={16} color="#FF6392" /><p>{error}</p></div>}

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="organization-name" className="mb-2 block text-xs font-extrabold text-ink">Organization name</label>
                <input id="organization-name" type="text" required minLength={2} maxLength={160} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Northstar Labs" className="w-full rounded-2xl border border-line bg-snow px-4 py-3.5 text-sm outline-none transition focus:border-blue focus:ring-4 focus:ring-blue/10" />
              </div>
              <div>
                <label htmlFor="owner-name" className="mb-2 block text-xs font-extrabold text-ink">Your name</label>
                <input id="owner-name" type="text" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Avery Morgan" className="w-full rounded-2xl border border-line bg-snow px-4 py-3.5 text-sm outline-none transition focus:border-blue focus:ring-4 focus:ring-blue/10" />
              </div>
              <div>
                <label htmlFor="owner-email" className="mb-2 block text-xs font-extrabold text-ink">Work email</label>
                <input id="owner-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="w-full rounded-2xl border border-line bg-snow px-4 py-3.5 text-sm outline-none transition focus:border-blue focus:ring-4 focus:ring-blue/10" />
              </div>
              <div>
                <label htmlFor="owner-password" className="mb-2 block text-xs font-extrabold text-ink">Password</label>
                <div className="relative">
                  <input id="owner-password" type={showPassword ? "text" : "password"} required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" className="w-full rounded-2xl border border-line bg-snow px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-blue focus:ring-4 focus:ring-blue/10" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted">Use at least 12 characters. This account becomes the organization owner.</p>
              </div>
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-blue-deep disabled:cursor-not-allowed disabled:opacity-60">{loading ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : "Create organization"}</button>
            </form>

            <p className="mt-7 text-center text-xs leading-5 text-muted">Already have an account? <Link to="/login" className="font-extrabold text-blue-deep hover:text-blue">Sign in</Link></p>
          </div>
          <p className="mt-5 text-center text-[11px] text-muted">This creates a local organization and owner account.</p>
        </section>
      </div>
    </div>
  );
}
