"use client";

import { useActionState, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { sendMagicLink, signInWithPassword, signUpTradeAccount } from "./actions";

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
      if (error) setStatus({ error: "קישור האיפוס לא נקלט. נסה לפתוח את המייל מחדש אחרי שהשרת המקומי פעיל." });
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
      setStatus({ error: "לא הצלחתי לעדכן סיסמה. ייתכן שהקישור פג תוקף — בקש Magic Link/Reset חדש." });
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
  const [signupState, signupAction, signupPending] = useActionState(signUpTradeAccount, initialState);
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, initialState);

  return (
    <div className="auth-grid">
      <RecoveryPasswordBox />
      <section className="panel auth-panel">
        <div className="panel-header"><div><div className="panel-title">כניסה למערכת</div><div className="eyebrow">Admin / approved trade account</div></div></div>
        <form action={loginAction} className="form-stack">
          <label>אימייל עסקי<input name="email" type="email" autoComplete="email" required /></label>
          <label>סיסמה<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn primary" disabled={loginPending}>{loginPending ? "נכנס..." : "כניסה"}</button>
          <Status state={loginState} />
        </form>
        <form action={magicAction} className="form-stack compact-form">
          <label>Magic Link<input name="email" type="email" autoComplete="email" placeholder="email@company.com" /></label>
          <button className="btn" disabled={magicPending}>{magicPending ? "שולח..." : "שלח Magic Link"}</button>
          <Status state={magicState} />
        </form>
      </section>

      <section className="panel auth-panel">
        <div className="panel-header"><div><div className="panel-title">הרשמת Trade Account</div><div className="eyebrow">Pending עד אישור נתנאל/ג׳ף</div></div></div>
        <form action={signupAction} className="form-stack">
          <div className="two-fields">
            <label>שם פרטי<input name="firstName" autoComplete="given-name" /></label>
            <label>שם משפחה<input name="lastName" autoComplete="family-name" /></label>
          </div>
          <label>טלפון<input name="phone" type="tel" autoComplete="tel" /></label>
          <label>אימייל עסקי<input name="email" type="email" autoComplete="email" required /></label>
          <label>סיסמה ראשונית<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          <button className="btn primary" disabled={signupPending}>{signupPending ? "יוצר..." : "צור בקשת חשבון"}</button>
          <Status state={signupState} />
        </form>
      </section>
    </div>
  );
}
