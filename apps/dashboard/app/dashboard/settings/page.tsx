import { AppShell } from "@/components/AppShell";
import { getAdminProfile, getSettingsOverview } from "@/lib/dashboard-data";
import { redirect } from "next/navigation";
import { PasswordChangeForm } from "./PasswordChangeForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getAdminProfile();
  if (!profile) redirect("/login");
  const overview = await getSettingsOverview();
  return (
    <AppShell active="/dashboard/settings" userLabel={`${profile.email} · ${profile.role}`}>
      <header className="topbar">
        <div>
          <div className="eyebrow">Secure Smart CRM operations</div>
          <h1>Settings and Control Center</h1>
        </div>
      </header>

      <section className="kpis" aria-label="System metrics">
        <div className="kpi"><div className="kpi-label">Customers</div><div className="kpi-value">{overview.counts.customers}</div></div>
        <div className="kpi"><div className="kpi-label">Orders</div><div className="kpi-value">{overview.counts.orders}</div></div>
        <div className="kpi"><div className="kpi-label">Pending approvals</div><div className="kpi-value">{overview.counts.pendingApplications}</div></div>
        <div className="kpi"><div className="kpi-label">Admin users</div><div className="kpi-value">{overview.counts.admins}</div></div>
      </section>

      <div className="settings-grid expanded">
        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Change Password</div><div className="eyebrow">Admin account</div></div></div>
          <PasswordChangeForm />
        </section>

        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">System Readiness</div><div className="eyebrow">Environment status without exposing secrets</div></div></div>
          <div className="settings-copy status-list">
            {overview.env.map((item) => (
              <div className="status-row" key={item.label}>
                <span>{item.label}</span>
                <strong className={item.ready ? "ok" : "missing"}>{item.ready ? "Ready" : "Missing"}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Operating Policy</div><div className="eyebrow">Current CRM access rules</div></div></div>
          <div className="settings-copy">
            <p>The internal dashboard is available only to preconfigured Admin and Super Admin users. There is no public self-registration for CRM admins.</p>
            <p>Trade customers enter through the public registration and approval workflow. Approved customers receive account setup by email and stay separate from staff access.</p>
            <p>Supplier cost, purchase unit price and margin fields stay inside this CRM only. Public customer surfaces must never expose purchasing-power data.</p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><div className="panel-title">Quick Operations</div><div className="eyebrow">Shortcuts for Netanel and Geoff</div></div></div>
          <div className="settings-copy quick-links">
            <a className="btn" href="/dashboard/approvals">Review trade approvals</a>
            <a className="btn" href="/dashboard/orders">Edit orders and purchase status</a>
            <a className="btn" href="/dashboard/customers">Manage customer database</a>
            <a className="btn" href="https://securesmart.tech/customer-login.html">Open customer login</a>
            <a className="btn" href="https://securesmart.tech/account.html">Open public registration</a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
