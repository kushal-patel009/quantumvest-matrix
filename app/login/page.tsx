"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp, requestPasswordReset } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { display, inputCls, inputStyle } from "../../lib/uiKit";

export default function LoginPage() {
  const router = useRouter();
  const { colors: COLORS, mode: themeMode, toggleTheme } = useTheme();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.push("/");
      } else if (mode === "signup") {
        await signUp(email, password);
        setSignupDone(true);
      } else {
        await requestPasswordReset(email, `${window.location.origin}/reset-password`);
        setResetSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: COLORS.bg }}>
      <div className="w-full max-w-sm rounded-xl border p-6" style={{ borderColor: COLORS.border, backgroundColor: COLORS.panel }}>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: COLORS.accent }}>
            Quantumvest
          </div>
          <button
            onClick={toggleTheme}
            className="rounded-md border px-2 py-1 text-xs"
            style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
            title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {themeMode === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        <h1 className="mb-6 text-2xl font-bold" style={{ ...display, color: COLORS.text }}>
          {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
        </h1>

        {resetSent ? (
          <div className="text-sm" style={{ color: COLORS.text }}>
            If an account exists for <strong>{email}</strong>, a password reset link has been sent.
            Check your inbox (and spam folder), then follow the link to set a new password.
            <button
              type="button"
              onClick={() => {
                setResetSent(false);
                setMode("login");
              }}
              className="mt-3 block text-xs"
              style={{ color: COLORS.accent }}
            >
              Back to sign in
            </button>
          </div>
        ) : signupDone ? (
          <div className="text-sm" style={{ color: COLORS.text }}>
            Check your email to confirm your account, then sign in. New accounts default to
            view-only access — an admin needs to promote you separately.
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: COLORS.textMuted }}>Email</span>
              <input type="email" required className={`${inputCls} w-full`} style={inputStyle(COLORS)} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode !== "forgot" && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: COLORS.textMuted }}>Password</span>
                <input type="password" required minLength={6} className={`${inputCls} w-full`} style={inputStyle(COLORS)} value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}

            {error && <div className="text-sm" style={{ color: COLORS.bad }}>{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: COLORS.accent }}
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>

            {mode === "login" && (
              <button type="button" onClick={() => setMode("forgot")} className="text-xs" style={{ color: COLORS.textMuted }}>
                Forgot password?
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}
              className="text-xs"
              style={{ color: COLORS.textMuted }}
            >
              {mode === "signup" ? "Already have an account? Sign in" : mode === "forgot" ? "Back to sign in" : "Need an account? Sign up"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
