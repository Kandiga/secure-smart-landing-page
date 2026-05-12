"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function PasswordChangeForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({});
    if (password.length < 10) {
      setStatus({ error: "Choose a password with at least 10 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ error: "Passwords do not match." });
      return;
    }

    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setStatus({ error: "Could not update the password. Sign in again and return to Settings." });
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStatus({ success: "Password updated successfully." });
  }

  return (
    <form onSubmit={submit} className="form-stack settings-form">
      <label>New password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} required /></label>
      <label>Confirm password<input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} required /></label>
      <button className="btn primary" disabled={pending}>{pending ? "Updating..." : "Change password"}</button>
      {status.error ? <p className="form-status error">{status.error}</p> : null}
      {status.success ? <p className="form-status success">{status.success}</p> : null}
    </form>
  );
}
