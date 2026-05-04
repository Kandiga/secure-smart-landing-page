import { AppShell } from "@/components/AppShell";
import { PasswordChangeForm } from "./PasswordChangeForm";

export default function SettingsPage() {
  return (
    <AppShell active="/dashboard/settings">
      <header className="topbar"><div><div className="eyebrow">System access</div><h1>הגדרות גישה</h1></div></header>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">החלפת סיסמה</div><div className="eyebrow">Admin account</div></div></div>
          <PasswordChangeForm />
        </section>
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">מדיניות גישה</div><div className="eyebrow">Secure Smart internal</div></div></div>
          <div className="settings-copy">
            <p>הדשבורד הפנימי פתוח למשתמשים שהוגדרו מראש בלבד. אין הרשמה עצמית למנהלים.</p>
            <p>לקוחות Trade יאושרו בהמשך דרך מסך האישורים, אבל גישה לניהול נשארת מוגנת ל־Admin בלבד.</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
