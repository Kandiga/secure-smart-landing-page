import { LoginForms } from "./AuthForms";

export default function LoginPage() {
  return (
    <main className="main auth-main">
      <div className="auth-hero">
        <div className="eyebrow">Secure Smart CRM / ERP</div>
        <h1>כניסה והרשמת לקוחות B2B</h1>
        <p>לקוחות חדשים נשארים ב־Pending עד אישור Admin. מחירי כוח קנייה ושדות פנימיים זמינים רק ל־Admin.</p>
      </div>
      <LoginForms />
    </main>
  );
}
