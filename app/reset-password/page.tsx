"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { updatePassword } from "../../lib/auth";
import { COLORS, display, inputCls } from "../../lib/uiKit";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase's client library automatically parses the recovery token
  // out of the URL fragment when this page loads and turns it into a
  // temporary session — we just need to wait for that to happen before
  // letting the user submit a new password.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // In case the event already fired before this listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
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
          Set a new password
        </h1>

        {!ready ? (
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Verifying your reset link…
          </p>
        ) : done ? (
          <p className="text-sm" style={{ color: COLORS.good }}>
            Password updated. Redirecting you to sign in…
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: COLORS.textMuted }}>New password</span>
              <input type="password" required minLength={6} className={`${inputCls} w-full`} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: COLORS.textMuted }}>Confirm new password</span>
              <input type="password" required minLength={6} className={`${inputCls} w-full`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>

            {error && <div className="text-sm" style={{ color: COLORS.bad }}>{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: COLORS.accent }}
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
