import { LoginForms } from "./AuthForms";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-shell" aria-label="Secure Smart operations access">
        <aside className="auth-intro">
          <div className="auth-logo-row">
            <img src="/brand/secure-smart-logo-official.png" alt="Secure Smart" className="auth-logo" />
          </div>
          <div className="auth-kicker">Operations cockpit</div>
          <h1>דשבורד B2B לניהול לקוחות, אישורים והזמנות</h1>
          <p>
            סביבת עבודה פנימית ל־Secure Smart: לקוחות Trade נשארים Pending עד אישור,
            RFQ נכנס ישירות ל־Orders, וכוח הקנייה הפנימי מופרד מהמחיר ללקוח.
          </p>
          <div className="auth-proof-grid" aria-label="יכולות מרכזיות">
            <div><span>01</span><strong>Admin approvals</strong><small>אישור לקוחות והרשאות</small></div>
            <div><span>02</span><strong>RFQ intake</strong><small>בקשות מהאתר ל־DB</small></div>
            <div><span>03</span><strong>Internal margin</strong><small>עלות פנימית מוגנת</small></div>
          </div>
        </aside>
        <LoginForms />
      </section>
    </main>
  );
}
