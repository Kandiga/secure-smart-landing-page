import { AppShell } from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <AppShell active="/dashboard/settings">
      <header className="topbar"><div><div className="eyebrow">System</div><h1>הגדרות מערכת</h1></div></header>
      <section className="panel"><div className="panel-header"><div className="panel-title">חיבורים</div></div><div style={{ padding: 18 }}>Supabase, Email provider, SMS/OTP, Webhook secrets ו־admin roles יוגדרו כאן בשלבים הבאים.</div></section>
    </AppShell>
  );
}
