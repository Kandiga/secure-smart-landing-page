import { AppShell } from "@/components/AppShell";
import { getAdminProfile, getCustomerActivity, getCustomers } from "@/lib/dashboard-data";
import { redirect } from "next/navigation";
import { deleteCustomerCompany, updateCustomerVip } from "./actions";
import { ManualCustomerAccessForm } from "./ManualCustomerAccessForm";

export const dynamic = "force-dynamic";

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US") : "—";
}

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("en-US") : "—";
}

export default async function CustomersPage() {
  const profile = await getAdminProfile();
  if (!profile) redirect("/login");
  const { rows, error } = await getCustomers();
  const { rows: activityRows, error: activityError } = await getCustomerActivity(30);
  const totalCustomers = rows.length;
  const totalMembers = rows.reduce((sum, row) => sum + row.members, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.orders, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.totalValue, 0);

  return (
    <AppShell active="/dashboard/customers" userLabel={`${profile.email} · ${profile.role}`}>
      <header className="topbar">
        <div>
          <div className="eyebrow">Admin workflow · Secure Smart CRM</div>
          <h1>Customers, Companies and Access</h1>
        </div>
      </header>

      {error ? <div className="notice warning">Could not load companies: {error}</div> : null}
      {activityError ? <div className="notice warning">Could not load customer activity: {activityError}</div> : null}

      <section className="kpis" aria-label="Customer metrics">
        <div className="kpi"><div className="kpi-label">Registered companies</div><div className="kpi-value">{totalCustomers}</div></div>
        <div className="kpi"><div className="kpi-label">Customer users</div><div className="kpi-value">{totalMembers}</div></div>
        <div className="kpi"><div className="kpi-label">Orders</div><div className="kpi-value">{totalOrders}</div></div>
        <div className="kpi"><div className="kpi-label">Transaction value</div><div className="kpi-value">{money(totalValue)}</div></div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Customer portal activity</div>
            <div className="eyebrow">Login, logout, password setup/reset and customer-account activity from the public site</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Customer</th>
                <th>Company</th>
                <th>Page</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {activityRows.length ? activityRows.map((event) => (
                <tr key={event.id}>
                  <td>{dateTime(event.createdAt)}</td>
                  <td><strong>{event.eventLabel}</strong></td>
                  <td>{event.customerEmail || "—"}</td>
                  <td>{event.companyName || "—"}</td>
                  <td className="muted">{event.pageUrl || "—"}</td>
                  <td>{event.alert || "Recorded"}</td>
                </tr>
              )) : <tr><td colSpan={6}>No customer portal activity has been recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Manual customer access / resend setup</div>
            <div className="eyebrow">Create or repair a customer login, connect it to the right company, send the setup email, and audit the action</div>
          </div>
        </div>
        <ManualCustomerAccessForm companies={rows.map((row) => ({ id: row.id, name: row.name, account_number: row.account_number }))} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Registered customer database</div>
            <div className="eyebrow">Company, contacts, status, Trade Account requests and transaction history</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Users / access</th>
                <th>Requests</th>
                <th>Transactions</th>
                <th>Value</th>
                <th>Last transaction</th>
                <th>Created</th>
                <th>Admin control</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    {row.isVip ? <span className="chip vip-chip">{row.vipLabel || "VIP"}</span> : null}
                    <div className="muted">{row.account_number || "No account number yet"}</div>
                    {row.vipNotes ? <div className="muted">VIP note: {row.vipNotes}</div> : null}
                    <div className="muted">{row.country || "—"}{row.registration_number ? ` · ${row.registration_number}` : ""}</div>
                  </td>
                  <td>
                    {row.memberLabels.length ? row.memberLabels.map((label) => <div key={label}>{label}</div>) : <span className="muted">No connected user</span>}
                  </td>
                  <td>{row.applications}</td>
                  <td>{row.orders}</td>
                  <td>{money(row.totalValue)}</td>
                  <td>{date(row.latestOrderAt)}</td>
                  <td>{date(row.created_at)}</td>
                  <td>
                    <form action={updateCustomerVip} className="mini-vip-form">
                      <input type="hidden" name="company_id" value={row.id} />
                      <label className="inline-check"><input type="checkbox" name="is_vip" value="yes" defaultChecked={row.isVip} /> VIP customer</label>
                      <input name="vip_label" defaultValue={row.vipLabel || "VIP"} placeholder="VIP label" aria-label="VIP label" />
                      <input name="vip_notes" defaultValue={row.vipNotes || ""} placeholder="VIP/internal note" aria-label="VIP note" />
                      <button className="btn" type="submit">Save VIP</button>
                    </form>
                    {profile.role === "super_admin" ? (
                      <form action={deleteCustomerCompany} className="mini-danger-form">
                        <input type="hidden" name="company_id" value={row.id} />
                        <input type="hidden" name="company_name" value={row.name} />
                        <input name="confirm_delete" placeholder={`Type ${row.name}`} aria-label={`Type ${row.name} to delete customer`} disabled={row.hasStaffMember} />
                        <label className="inline-check"><input type="checkbox" name="include_orders" value="yes" disabled={row.hasStaffMember} /> delete orders</label>
                        <button className="btn danger" type="submit" disabled={row.hasStaffMember}>Delete customer</button>
                        {row.hasStaffMember ? <div className="eyebrow">Blocked: staff/admin-linked company</div> : null}
                      </form>
                    ) : <span className="muted">Super admin only</span>}
                  </td>
                </tr>
              )) : <tr><td colSpan={8}>No companies yet. They will be created from registration/approval or manual order flows.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
