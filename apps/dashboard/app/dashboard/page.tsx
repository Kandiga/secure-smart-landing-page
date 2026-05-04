import { AppShell } from "@/components/AppShell";
import { getCurrentProfile, getOrderLines } from "@/lib/dashboard-data";
import { money, stockClass, stockLabel } from "@/lib/mock-orders";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const { rows, isMock, error } = await getOrderLines();
  const totalSales = rows.reduce((sum, row) => sum + row.customerTotal, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.purchaseTotal, 0);
  const totalMargin = totalSales - totalCost;
  const missing = rows.filter((row) => row.stockStatus !== "in_stock").length;

  return (
    <AppShell active="/dashboard" userLabel={`${profile.email} · ${profile.role} · ${profile.account_status}`}>
      <header className="topbar">
        <div>
          <div className="eyebrow">CRM / ERP dashboard · {isMock ? "מצב דמו עד כניסת הזמנות אמיתיות" : "נתוני Supabase חיים"}</div>
          <h1>קוקפיט הזמנות</h1>
        </div>
        <div className="actions">
          <button className="btn">ייצוא Excel</button>
          <button className="btn primary">הזמנה ידנית</button>
        </div>
      </header>

      {error ? <div className="notice warning">לא ניתן לקרוא הזמנות חיות כרגע, מוצג דמו בטוח. {error}</div> : null}
      {profile.account_status !== "approved" && profile.role === "customer" ? <div className="notice warning">החשבון שלך עדיין Pending. לקוחות יראו מידע מוגבל עד אישור Admin.</div> : null}

      <section className="kpis" aria-label="מדדי הזמנות">
        <div className="kpi"><div className="kpi-label">שווי לקוח פתוח</div><div className="kpi-value">{money(totalSales)}</div></div>
        <div className="kpi"><div className="kpi-label">כוח קנייה</div><div className="kpi-value">{money(totalCost)}</div></div>
        <div className="kpi"><div className="kpi-label">מרווח צפוי</div><div className="kpi-value">{money(totalMargin)}</div></div>
        <div className="kpi"><div className="kpi-label">שורות שדורשות טיפול</div><div className="kpi-value">{missing}</div></div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">הזמנות אחרונות</div>
            <div className="eyebrow">צד לקוח מול צד כוח קנייה, מופרדים וברורים</div>
          </div>
          <button className="btn">סינון</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="group-row">
                <th colSpan={4}>פרטי לקוח ופריט</th>
                <th colSpan={3} className="customer-group">צד לקוח</th>
                <th colSpan={3} className="purchase-group">כוח קנייה פנימי</th>
                <th colSpan={2}>תפעול</th>
              </tr>
              <tr>
                <th>לקוח</th><th>פרויקט</th><th className="sku">SKU</th><th>פריט</th>
                <th className="split-head customer-group">כמות לקוח</th><th className="money split-head customer-group">מחיר לקוח</th><th className="money split-head customer-group">סה״כ לקוח</th>
                <th className="money split-head purchase-group">כוח קנייה יח׳</th><th className="money split-head purchase-group">סה״כ כוח קנייה</th><th className="money purchase-group">מרווח</th><th>מלאי</th><th>אחראי</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.customer}</td><td>{row.project}</td><td className="sku">{row.sku}</td><td>{row.product}</td>
                  <td>{row.orderQty}</td><td className="money">{money(row.customerUnitPrice)}</td><td className="money"><strong>{money(row.customerTotal)}</strong></td>
                  <td className="money">{money(row.purchaseUnitPrice)}</td><td className="money">{money(row.purchaseTotal)}</td><td className="money">{money(row.margin)} · {row.marginPct}%</td>
                  <td><span className={`chip ${stockClass(row.stockStatus)}`}>{stockLabel(row.stockStatus)}</span></td><td>{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-cards">
          {rows.map((row) => (
            <article className="order-card" key={row.id}>
              <div className="order-card-head">
                <div><div className="sku">{row.sku}</div><strong>{row.customer}</strong><div className="eyebrow">{row.product}</div></div>
                <span className={`chip ${stockClass(row.stockStatus)}`}>{stockLabel(row.stockStatus)}</span>
              </div>
              <div className="card-grid">
                <div className="card-metric"><span>צד לקוח</span><strong>{row.orderQty} × {money(row.customerUnitPrice)} = {money(row.customerTotal)}</strong></div>
                <div className="card-metric"><span>כוח קנייה</span><strong>{money(row.purchaseTotal)}</strong></div>
                <div className="card-metric"><span>מרווח</span><strong>{money(row.margin)} · {row.marginPct}%</strong></div>
                <div className="card-metric"><span>אחראי</span><strong>{row.owner}</strong></div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
