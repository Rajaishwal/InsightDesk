// Login.jsx — Employee and admin login page with JWT authentication.
// Two-panel card: InsightDesk brand panel on the left, sign-in form on the right,
// plus a "Change password" dialog (confirms the current password first).
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, X, Mail, Lock, KeyRound, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import axios from "../services/axios";
import { useToast } from "../context/ToastContext";
import BrandOrbit from "../components/BrandOrbit";

// Live India-time clock (own component so the ticking doesn't re-render the form)
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const tz = { timeZone: "Asia/Kolkata" };
  const hm  = now.toLocaleTimeString("en-US", { ...tz, hour: "numeric", minute: "2-digit", hour12: true }); // "5:42 AM"
  const [clock, ampm] = hm.split(" ");
  const sec  = now.toLocaleTimeString("en-US", { ...tz, second: "2-digit" }).padStart(2, "0");
  const date = now.toLocaleDateString("en-GB", { ...tz, weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="text-center">
      <p className="font-bold tabular-nums leading-none text-white">
        <span className="text-[2.6rem] tracking-tight">{clock}</span>
        <span className="ml-0.5 text-xl text-amber-400">:{sec}</span>
        <span className="ml-2 text-sm font-semibold text-blue-200/70">{ampm}</span>
      </p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/60">{date} · IST</p>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-gray-50/70 pl-10 text-sm text-gray-800 outline-none transition " +
  "placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100";

function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gray-400">
      {children}
    </label>
  );
}

function ErrorNote({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

// Password field with a leading lock icon and a show/hide toggle
function PasswordInput({ shown, onToggle, ...props }) {
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input {...props} type={shown ? "text" : "password"} className={`${inputCls} pr-11`} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
      >
        {shown ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export default function Login() {
  const toast = useToast();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  // password change states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const [passwordData, setPasswordData] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const openChangePassword = () => {
    setPwErr("");
    setPasswordData((p) => ({ ...p, email: p.email || form.email }));
    setShowChangePassword(true);
  };
  const closeChangePassword = () => {
    setShowChangePassword(false);
    setPwErr("");
  };

  // Esc closes the change-password dialog
  useEffect(() => {
    if (!showChangePassword) return;
    const onKey = (e) => { if (e.key === "Escape") closeChangePassword(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showChangePassword]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const { success, message } = await login(form.email, form.password);
    setLoading(false);
    if (!success) return setErr(message);
    navigate("/");
  };

  const onChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (
      !passwordData.email ||
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      setPwErr("Please fill in all password fields");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPwErr("New password and confirm password do not match");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPwErr("New password must be at least 6 characters long");
      return;
    }
    if (passwordData.currentPassword === passwordData.newPassword) {
      setPwErr("New password must be different from current password");
      return;
    }

    try {
      setPasswordLoading(true);
      setPwErr("");
      const loginResponse = await axios.post("http://localhost:5000/api/auth/login", {
        email: passwordData.email,
        password: passwordData.currentPassword,
      });

      if (loginResponse.data.token) {
        await axios.put(
          "http://localhost:5000/api/auth/change-password",
          {
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
          },
          {
            headers: {
              Authorization: `Bearer ${loginResponse.data.token}`,
            },
          }
        );
        toast.success("Password changed successfully! Please login with new password.");
        setPasswordData({
          email: "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setShowChangePassword(false);
      }
    } catch (error) {
      setPwErr(
        error.response?.data?.message ||
          (!error.response
            ? "Can't reach the server — make sure the backend is running."
            : "Error changing password. Please try again.")
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-6 py-10">
      <div className="grid w-full max-w-[60rem] overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl md:grid-cols-[1.05fr_1fr]">

        {/* ── Brand panel ── */}
        <aside className="relative flex flex-col overflow-hidden bg-[#0f1b3d] p-9 text-white lg:p-10">
          {/* Wordmark only — the animated mark below carries the logo */}
          <div className="relative z-10">
            <div className="flex flex-col leading-none">
              <div className="text-[1.55rem] font-extrabold tracking-tight">
                <span className="text-blue-400">Insight</span><span className="text-amber-400">Desk</span>
              </div>
              <span className="mt-1.5 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-blue-200/60">Track Your Performance</span>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
            <BrandOrbit className="scale-[0.82] lg:scale-100" />
            <LiveClock />
          </div>

          <p className="relative text-center text-[11px] text-blue-200/50">© {new Date().getFullYear()} InsightDesk</p>
        </aside>

        {/* ── Sign-in form ── */}
        <section className="flex flex-col justify-center px-8 py-10 sm:px-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Sign in</p>
          <h1 className="mt-1.5 text-[1.75rem] font-bold leading-tight text-gray-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-gray-500">Sign in with your work email to open your dashboard.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            {err && <ErrorNote>{err}</ErrorNote>}

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={onChange}
                  required
                  autoFocus
                  autoComplete="email"
                  className={`${inputCls} pr-3`}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={onChange}
                required
                autoComplete="current-password"
                shown={showPassword}
                onToggle={togglePasswordVisibility}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
              )}
            </button>
          </form>

          <div className="mt-7 space-y-3 border-t border-gray-100 pt-5 text-sm">
            <p className="text-gray-500">
              Need to change your password?{" "}
              <button
                type="button"
                onClick={openChangePassword}
                className="cursor-pointer font-semibold text-blue-600 hover:underline"
              >
                Change password
              </button>
            </p>
            <p className="text-xs text-gray-400">New here? Sign in with the login details your HR team shared with you.</p>
          </div>
        </section>
      </div>

      {/* ── Change password dialog ── */}
      {showChangePassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeChangePassword(); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="change-pw-title"
            className="animate-dialog-in w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50">
                  <KeyRound className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="change-pw-title" className="text-lg font-bold text-gray-900">Change password</h3>
                  <p className="mt-0.5 text-sm text-gray-500">Confirm your current password, then choose a new one.</p>
                </div>
                <button
                  type="button"
                  onClick={closeChangePassword}
                  aria-label="Close"
                  className="-mr-1 -mt-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={onChangePasswordSubmit} className="mt-6 space-y-4">
                {pwErr && <ErrorNote>{pwErr}</ErrorNote>}

                <div>
                  <Label htmlFor="cp-email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="cp-email"
                      type="email"
                      name="email"
                      value={passwordData.email}
                      onChange={handlePasswordChange}
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      className={`${inputCls} pr-3`}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="cp-current">Current password</Label>
                  <PasswordInput
                    id="cp-current"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    shown={showCurrentPassword}
                    onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
                  />
                </div>

                <div>
                  <Label htmlFor="cp-new">New password</Label>
                  <PasswordInput
                    id="cp-new"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    shown={showNewPassword}
                    onToggle={() => setShowNewPassword(!showNewPassword)}
                  />
                </div>

                <div>
                  <Label htmlFor="cp-confirm">Confirm new password</Label>
                  <PasswordInput
                    id="cp-confirm"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    autoComplete="new-password"
                    placeholder="Type the new password again"
                    shown={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeChangePassword}
                    className="h-10 flex-1 cursor-pointer rounded-full border border-gray-200 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {passwordLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {passwordLoading ? "Changing…" : "Change password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
