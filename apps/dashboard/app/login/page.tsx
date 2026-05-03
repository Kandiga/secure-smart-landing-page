export default function LoginPage() {
  return (
    <main className="main" style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="panel" style={{ width: "100%" }}>
        <div className="panel-header"><div><div className="panel-title">כניסה למערכת</div><div className="eyebrow">Secure Smart CRM / ERP</div></div></div>
        <form style={{ display: "grid", gap: 12, padding: 18 }}>
          <label>אימייל עסקי<input style={{ width: "100%", marginTop: 6, padding: 12, borderRadius: 10, border: "1px solid var(--line)" }} type="email" /></label>
          <label>סיסמה<input style={{ width: "100%", marginTop: 6, padding: 12, borderRadius: 10, border: "1px solid var(--line)" }} type="password" /></label>
          <button className="btn primary" type="button">כניסה</button>
          <button className="btn" type="button">שלח Magic Link</button>
        </form>
      </section>
    </main>
  );
}
