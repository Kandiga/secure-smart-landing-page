import { AppShell } from "@/components/AppShell";

export default function CustomersPage() {
  return (
    <AppShell active="/dashboard/customers">
      <header className="topbar"><div><div className="eyebrow">CRM</div><h1>לקוחות וחברות</h1></div></header>
      <section className="panel"><div className="panel-header"><div className="panel-title">בשלב הבא</div></div><div style={{ padding: 18 }}>כאן יופיעו חברות, אנשי קשר, סטטוס אישור, הערות והיסטוריית הזמנות.</div></section>
    </AppShell>
  );
}
