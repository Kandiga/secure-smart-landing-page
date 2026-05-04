"use client";

import { useActionState, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { signInWithPassword } from "./actions";

const initialState = {} as { error?: string; success?: string };

function Status({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <p className="form-status error">{state.error}</p>;
  if (state.success) return <p className="form-status success">{state.success}</p>;
  return null;
}

function RecoveryPasswordBox() {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const hasRecoveryHash = window.location.hash.includes("access_token") || window.location.hash.includes("type=recovery");
    if (!hasRecoveryHash) return;
    setVisible(true);
    createBrowserSupabaseClient().auth.getSession().then(({ error }) => {
      if (error) setStatus({ error: "קישור האיפוס לא נקלט. פתח את קישור האיפוס החדש או בקש קישור חדש מה־Admin." });
    });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setStatus({ error: "הסיסמה צריכה להיות לפחות 8 תווים." });
      return;
    }
    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setStatus({ error: "לא הצלחתי לעדכן סיסמה. ייתכן שהקישור פג תוקף." });
      return;
    }
    setStatus({ success: "הסיסמה עודכנה. אפשר להיכנס לדשבורד." });
    window.history.replaceState({}, document.title, "/login");
  }

  if (!visible) return null;
  return (
    <section className="panel auth-panel recovery-panel">
      <div className="panel-header"><div><div className="panel-title">הגדרת סיסמה חדשה</div><div className="eyebrow">Password recovery</div></div></div>
      <form onSubmit={submit} className="form-stack">
        <label>סיסמה חדשה<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="btn primary" disabled={pending}>{pending ? "מעדכן..." : "עדכן סיסמה"}</button>
        <Status state={status} />
      </form>
    </section>
  );
}

export function LoginForms() {
  const [loginState, loginAction, loginPending] = useActionState(signInWithPassword, initialState);

  return (
    <div className="auth-grid admin-auth-grid">
      <RecoveryPasswordBox />
      <section className="panel auth-panel admin-login-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">כניסת מנהלים בלבד</div>
            <div className="eyebrow">Username / password</div>
          </div>
        </div>
        <form action={loginAction} className="form-stack">
          <label>שם משתמש / אימייל<input name="email" type="email" autoComplete="username email" required /></label>
          <label>סיסמה<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn primary" disabled={loginPending}>{loginPending ? "נכנס..." : "כניסה לדשבורד"}</button>
          <Status state={loginState} />
        </form>
        <div className="admin-access-note">
          אין הרשמה עצמית לדשבורד הפנימי. נתנאל וג׳ף מקבלים משתמש Admin מוכן עם סיסמה זמנית, ולאחר הכניסה מחליפים אותה בהגדרות.
        </div>
      </section>
    </div>
  );
}
