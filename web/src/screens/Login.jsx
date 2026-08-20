import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { AppMark } from "../components/ui/app-ui";
import { IconSymbol } from "../components/ui/icon-symbol";

export default function Login() {
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      await login(email, password);
      navigate("/app");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-10">
          <Link to="/" className="inline-block hover:opacity-80 transition-opacity mb-6">
            <AppMark size={40} />
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111] mb-2">Welcome back</h1>
          <p className="text-gray-500 text-sm">Please enter your details to sign in.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl p-4 text-sm mb-6 flex items-start gap-3">
              <IconSymbol name="exclamationmark.triangle.fill" size={16} />
              <p className="mt-0.5">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[#111] mb-2">Email</label>
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 text-[#111] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#111] mb-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-gray-200 text-[#111] rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#111] text-white border-none px-6 py-3.5 rounded-xl font-bold text-sm cursor-pointer shadow-[0_4px_12px_rgba(17,17,17,0.1)] hover:bg-[#333] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : "Sign In"}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          Don't have an account? <span className="text-[#111] font-bold">Contact your HR department to get provisioned.</span>
        </p>
      </div>
    </div>
  );
}
