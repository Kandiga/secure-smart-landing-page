import { AppShell } from "@/components/AppShell";
import { getCurrentProfile, getCustomers } from "@/lib/dashboard-data";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const { rows, error } = await getCustomers();
  return (
    <AppShell active="/dashboard/customers" userLabel={`${profile.email} · ${profile.role}`}>
      <header className="topbar"><div><div className="eyebrow">CRM · Supabase live</div><h1>לקוחות וחברות</h1></div></header>
      {error ? <div className="notice warning">לא ניתן לקרוא חברות כרגע: {error}</div> : null}
      <section className="panel">
        <div className="panel-header"><div><div className="panel-title">חברות</div><div className="eyebrow">לקוחות, אנשי קשר ובקשות Trade Account</div></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>חברה</th><th>מדינה</th><th>אנשי קשר</th><th>בקשות</th><th>נוצר</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}><td>{row.name}</td><td>{row.country || "—"}</td><td>{row.members}</td><td>{row.applications}</td><td>{new Date(row.created_at).toLocaleDateString("he-IL")}</td></tr>
              )) : <tr><td colSpan={5}>אין חברות עדיין. הן ייווצרו מתהליך הרשמה/אישור או הזמנה ידנית.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
