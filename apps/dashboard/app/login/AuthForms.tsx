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

function PasswordField({
  name,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  pattern,
  required = true,
}: {
  name?: string;
  label: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  minLength?: number;
  pattern?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="password-input-row">
        <input
          name={name}
          value={value}
          onChange={onChange}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          pattern={pattern}
          required={required}
        />
        <button type="button" className="password-toggle" onClick={() => setShow((current) => !current)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

function RecoveryPasswordBox({ onRecoveryVisible }: { onRecoveryVisible: (visible: boolean) => void }) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ error?: string; success?: string }>({});
  const [pending, setPending] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasRecoveryHash = window.location.hash.includes("access_token") || window.location.hash.includes("type=recovery");
    const hasRecoveryCode = params.has("code") || params.get("type") === "recovery";
    if (!hasRecoveryHash && !hasRecoveryCode) {
      onRecoveryVisible(false);
      return;
    }

    setVisible(true);
    onRecoveryVisible(true);
    const supabase = createBrowserSupabaseClient();

    if (params.has("code")) {
      const authCode = params.get("code") || "";
      supabase.auth.exchangeCodeForSession(authCode).then(({ error }) => {
        if (error) {
          setSessionReady(false);
          setStatus({ error: "The reset link was not accepted. Open the newest reset link or ask an Admin for a new one." });
          return;
        }
        setSessionReady(true);
        setStatus({ success: "The link is ready. You can choose a new password." });
        window.history.replaceState({}, document.title, "/login?type=recovery");
      });
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setSessionReady(false);
        setStatus({ error: "The reset link was not accepted. Open the newest reset link or ask an Admin for a new one." });
        return;
      }
      setSessionReady(true);
    });
  }, [onRecoveryVisible]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setStatus({ error: "Password must include at least 8 characters, one uppercase English letter, one lowercase English letter and one number." });
      return;
    }
    if (!sessionReady) {
      setStatus({ error: "The link is not ready yet. Wait a moment, and if this remains, ask an Admin for a new link." });
      return;
    }
    setPending(true);
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) await supabase.auth.signOut().catch(() => {});
    setPending(false);
    if (error) {
      setStatus({ error: "Could not update the password. The link may have expired." });
      return;
    }
    setStatus({ success: "Password updated. Redirecting to the Secure Smart sign-in page..." });
    window.history.replaceState({}, document.title, "/login");
    window.setTimeout(() => {
      window.location.href = "https://securesmart.tech/customer-login.html?password=updated";
    }, 900);
  }

  if (!visible) return null;
  return (
    <section className="panel auth-panel recovery-panel">
      <div className="panel-header"><div><div className="panel-title">Set a New Password</div><div className="eyebrow">Password recovery</div></div></div>
      <form onSubmit={submit} className="form-stack">
        <PasswordField
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}"
        />
        <div className="password-guidance" dir="rtl">
          Choose a strong password: at least 8 characters, one uppercase English letter, one lowercase English letter and one number.
        </div>
        <button className="btn primary" disabled={pending || !sessionReady}>{pending ? "Updating..." : "Update password"}</button>
        <Status state={status} />
      </form>
    </section>
  );
}

export function LoginForms() {
  const [loginState, loginAction, loginPending] = useActionState(signInWithPassword, initialState);
  const [recoveryVisible, setRecoveryVisible] = useState(false);

  return (
    <div className="auth-grid admin-auth-grid">
      <RecoveryPasswordBox onRecoveryVisible={setRecoveryVisible} />
      {!recoveryVisible && (
        <section className="panel auth-panel admin-login-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Admin Sign In Only</div>
              <div className="eyebrow">Username / password</div>
            </div>
          </div>
          <form action={loginAction} className="form-stack">
            <label>Username / Email<input name="email" type="email" autoComplete="username email" required /></label>
            <PasswordField name="password" label="Password" autoComplete="current-password" />
            <button className="btn primary" disabled={loginPending}>{loginPending ? "Signing in..." : "Sign in to dashboard"}</button>
            <Status state={loginState} />
          </form>
          <div className="admin-access-note">
            There is no self-registration for the internal dashboard. Netanel and Geoff use preconfigured Admin accounts and can change their password in Settings after sign-in.
          </div>
        </section>
      )}
    </div>
  );
}
