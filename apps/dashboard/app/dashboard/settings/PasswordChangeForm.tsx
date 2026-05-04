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
      setStatus({ error: "בחר סיסמה באורך 10 תווים לפחות." });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ error: "הסיסמאות לא זהות." });
      return;
    }

    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setStatus({ error: "לא הצלחתי לעדכן את הסיסמה. נסה להתחבר מחדש ואז לחזור להגדרות." });
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStatus({ success: "הסיסמה עודכנה בהצלחה." });
  }

  return (
    <form onSubmit={submit} className="form-stack settings-form">
      <label>סיסמה חדשה<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} required /></label>
      <label>אימות סיסמה<input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" minLength={10} required /></label>
      <button className="btn primary" disabled={pending}>{pending ? "מעדכן..." : "שנה סיסמה"}</button>
      {status.error ? <p className="form-status error">{status.error}</p> : null}
      {status.success ? <p className="form-status success">{status.success}</p> : null}
    </form>
  );
}
