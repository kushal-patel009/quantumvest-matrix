"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "../../lib/auth";
import { COLORS, display, inputCls } from "../../lib/uiKit";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        router.push("/");
      } else {
        await signUp(email, password);
        setSignupDone(true);
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
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: COLORS.accent }}>
          Quantumvest
        </div>
        <h1 className="mb-6 text-2xl font-bold" style={{ ...display, color: COLORS.text }}>
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>

        {signupDone ? (
          <div className="text-sm" style={{ color: COLORS.text }}>
            Check your email to confirm your account, then sign in. New accounts default to
            view-only access — an admin needs to promote you separately.
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: COLORS.textMuted }}>Email</span>
              <input type="email" required className={`${inputCls} w-full`} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: COLORS.textMuted }}>Password</span>
              <input type="password" required minLength={6} className={`${inputCls} w-full`} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            {error && <div className="text-sm" style={{ color: COLORS.bad }}>{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: COLORS.accent }}
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-xs"
              style={{ color: COLORS.textMuted }}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
