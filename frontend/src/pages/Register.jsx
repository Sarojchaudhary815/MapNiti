import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Globe2, Briefcase, GraduationCap, Eye, EyeOff, Loader2, AlertCircle, Check, ShieldCheck } from "lucide-react";
import { registerUser, sendOtp, verifyOtp } from "../api/authApi";
import AuthLayout from "./AuthLayout";
import { COUNTRIES } from "../constants/countries";
import { getErrorMessage } from "../utils/errors";
import { afterLoginPath } from "../utils/afterLogin";

const strengthChecks = (password) => ([
  { label: "At least 8 characters", valid: password.length >= 8 },
  { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
  { label: "One number", valid: /[0-9]/.test(password) },
  { label: "One special character", valid: /[^A-Za-z0-9]/.test(password) },
]);

const strengthMeta = [
  { label: "Weak", color: "bg-red-500", text: "text-red-500" },
  { label: "Fair", color: "bg-orange-500", text: "text-orange-500" },
  { label: "Good", color: "bg-accent-500", text: "text-accent-600" },
  { label: "Strong", color: "bg-green-500", text: "text-green-600" },
];

const inputClass = "w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all";
const plainInputClass = "w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all";

export default function Register() {
  const [step, setStep] = useState("info"); // "info" | "otp" | "details"

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [otp, setOtp] = useState("");

  const [country, setCountry] = useState("Nepal");
  const [occupation, setOccupation] = useState("employed"); // "employed" | "student"
  const [organization, setOrganization] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const checks = strengthChecks(password);
  const score = checks.filter((c) => c.valid).length;
  const meta = strengthMeta[Math.max(score - 1, 0)];

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!fullName || !email) {
      setError("Please fill in your name and email.");
      return;
    }
    setLoading(true);
    try {
      await sendOtp(email);
      setStep("otp");
    } catch (err) {
      setError(getErrorMessage(err, "Could not send the verification code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Enter the 6-digit code we emailed you.");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      setStep("details");
    } catch (err) {
      setError(getErrorMessage(err, "That code didn't work. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await sendOtp(email);
    } catch (err) {
      setError(getErrorMessage(err, "Could not resend the code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!country || !occupation || !organization || !roleTitle || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }
    if (score < 4) {
      setError("Please choose a stronger password using the checklist below.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        fullName,
        email,
        password,
        country,
        occupation,
        organization,
        roleTitle,
      });
      navigate(afterLoginPath());
      window.location.reload();
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = { info: 0, otp: 1, details: 2 }[step];

  return (
    <AuthLayout title="Create your account" subtitle="Start running GIS analyses with MapNiti in minutes">
      <div className="flex items-center gap-2 mb-6">
        {["Account", "Verify", "Details"].map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-brand-600" : "bg-slate-200"}`} />
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {step === "info" && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Full Name</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Your full name"
                required
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                placeholder="you@example.com"
                required
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-all disabled:opacity-50 shadow-lg shadow-brand-600/20"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? "Sending code..." : "Continue"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <ShieldCheck size={16} className="text-brand-600 shrink-0" />
            We sent a 6-digit code to <span className="font-semibold text-slate-700">{email}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              required
              className={`${plainInputClass} text-center text-2xl tracking-[0.5em] font-bold`}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>

          <button
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-all disabled:opacity-50 shadow-lg shadow-brand-600/20"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? "Verifying..." : "Continue"}
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={loading}
            className="w-full text-center text-sm text-brand-600 font-semibold hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        </form>
      )}

      {step === "details" && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Country</label>
            <div className="relative">
              <Globe2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                required
                className={`${inputClass} appearance-none`}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Occupation</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOccupation("employed")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-all ${
                  occupation === "employed"
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:border-brand-300"
                }`}
              >
                <Briefcase size={16} /> Employed
              </button>
              <button
                type="button"
                onClick={() => setOccupation("student")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-all ${
                  occupation === "student"
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:border-brand-300"
                }`}
              >
                <GraduationCap size={16} /> Student
              </button>
            </div>
          </div>

          {occupation === "employed" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Designation</label>
                <input
                  type="text"
                  placeholder="e.g. GIS Analyst"
                  required
                  className={plainInputClass}
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Company</label>
                <input
                  type="text"
                  placeholder="Company name"
                  required
                  className={plainInputClass}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Faculty</label>
                <input
                  type="text"
                  placeholder="e.g. Geomatics Engineering"
                  required
                  className={plainInputClass}
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">College</label>
                <input
                  type="text"
                  placeholder="College name"
                  required
                  className={plainInputClass}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-11 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {password && (
              <div className="mt-2.5">
                <div className="flex gap-1.5 mb-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? meta.color : "bg-slate-150 bg-slate-200"}`} />
                  ))}
                </div>
                <p className={`text-xs font-bold mb-2 ${meta.text}`}>{meta.label} password</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {checks.map((c) => (
                    <div key={c.label} className={`flex items-center gap-1.5 text-xs font-medium ${c.valid ? "text-green-600" : "text-slate-400"}`}>
                      <Check size={12} className={c.valid ? "opacity-100" : "opacity-30"} />
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-11 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && (
              <p className={`text-xs font-semibold mt-1.5 ${password === confirmPassword ? "text-green-600" : "text-red-500"}`}>
                {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
              </p>
            )}
          </div>

          <button
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-all disabled:opacity-50 shadow-lg shadow-brand-600/20"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-slate-500 mt-8">
        Already have an account?{" "}
        <Link to={`/login${window.location.search}`} className="text-brand-600 font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
