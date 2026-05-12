import { LoginForms } from "./AuthForms";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-shell" aria-label="Secure Smart operations access">
        <LoginForms />
      </section>
    </main>
  );
}
