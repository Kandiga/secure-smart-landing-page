import { AppShell } from "@/components/AppShell";
import { getAdminProfile, getOrderRecords, type OrderRecord } from "@/lib/dashboard-data";
import { money, stockClass, stockLabel } from "@/lib/mock-orders";
import { redirect } from "next/navigation";
import { deleteOrder, updateOrderHeader, updateOrderItem } from "./actions";

export const dynamic = "force-dynamic";

const orderStatuses = ["new", "review", "approved", "needs_purchase", "partial_stock", "ready_to_deliver", "delivered", "cancelled"];
const stockStatuses = ["in_stock", "partial", "missing", "needs_purchase"];

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US") : "—";
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function totals(rows: OrderRecord[]) {
  const customer = rows.reduce((sum, row) => sum + row.totalCustomerValue, 0);
  const purchase = rows.reduce((sum, row) => sum + row.totalPurchaseCost, 0);
  return { customer, purchase, margin: customer - purchase, attention: rows.filter((row) => !["delivered", "cancelled"].includes(row.status)).length };
}

export default async function OrdersPage() {
  const profile = await getAdminProfile();
  if (!profile) redirect("/login");
  const { rows, isMock, error } = await getOrderRecords();
  const kpi = totals(rows);

  return (
    <AppShell active="/dashboard/orders" userLabel={`${profile.email} · ${profile.role}`}>
      <header className="topbar">
        <div>
          <div className="eyebrow">CRM orders · {isMock ? "Waiting for live orders" : "Live Supabase records"}</div>
          <h1>Order Editing and Purchasing Control</h1>
        </div>
      </header>

      {error ? <div className="notice warning">Orders could not be loaded: {error}</div> : null}

      <section className="kpis" aria-label="Order editing metrics">
        <div className="kpi"><div className="kpi-label">Open customer value</div><div className="kpi-value">{money(kpi.customer)}</div></div>
        <div className="kpi"><div className="kpi-label">Internal purchasing cost</div><div className="kpi-value">{money(kpi.purchase)}</div></div>
        <div className="kpi"><div className="kpi-label">Gross margin</div><div className="kpi-value">{money(kpi.margin)}</div></div>
        <div className="kpi"><div className="kpi-label">Active orders</div><div className="kpi-value">{kpi.attention}</div></div>
      </section>

      <section className="order-editor-list">
        {rows.length ? rows.map((order) => (
          <article className="panel order-editor" key={order.id}>
            <div className="panel-header order-editor-head">
              <div>
                <div className="panel-title">{order.orderNumber || "Unnumbered order"} · {order.customer}</div>
                <div className="eyebrow">Created {date(order.createdAt)} · Updated {date(order.updatedAt)} · {order.customerEmail || "No customer email"}</div>
              </div>
              <span className="chip">{statusLabel(order.status)}</span>
            </div>

            <form action={updateOrderHeader} className="order-admin-form order-header-form">
              <input type="hidden" name="order_id" value={order.id} />
              <label>Order number<input name="order_number" defaultValue={order.orderNumber ?? ""} placeholder="SS-1001" /></label>
              <label>Project<input name="project_name" defaultValue={order.projectName ?? ""} placeholder="Customer project" /></label>
              <label>Status
                <select name="status" defaultValue={order.status}>
                  {orderStatuses.map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}
                </select>
              </label>
              <button className="btn primary" type="submit">Save order header</button>
            </form>

            <div className="editable-lines">
              {order.items.length ? order.items.map((item) => (
                <form action={updateOrderItem} className="order-line-form" key={item.id}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <div className="line-identity">
                    <div className="sku">{item.sku}</div>
                    <label>Product title<input name="product_title" defaultValue={item.productTitle ?? item.sku} /></label>
                  </div>
                  <label>Qty<input name="order_quantity" type="number" min="1" step="1" defaultValue={item.orderQuantity} /></label>
                  <label>Customer unit<input name="customer_unit_price" type="number" min="0" step="0.01" defaultValue={item.customerUnitPrice} /></label>
                  <label>Purchase unit<input name="purchase_unit_price" type="number" min="0" step="0.01" defaultValue={item.purchaseUnitPrice} /></label>
                  <label>Stock
                    <select name="stock_status" defaultValue={item.stockStatus}>
                      {stockStatuses.map((status) => <option value={status} key={status}>{stockLabel(status as any)}</option>)}
                    </select>
                  </label>
                  <label>Notes<input name="notes" defaultValue={item.notes ?? ""} placeholder="Supplier, missing stock, ETA" /></label>
                  <div className="line-math">
                    <span className={`chip ${stockClass(item.stockStatus)}`}>{stockLabel(item.stockStatus)}</span>
                    <strong>{money(item.customerTotal)} customer</strong>
                    <strong>{money(item.purchaseTotal)} cost</strong>
                    <strong>{money(item.margin)} · {item.marginPct}%</strong>
                  </div>
                  <button className="btn" type="submit">Save line</button>
                </form>
              )) : <div className="empty-state">No order lines yet.</div>}
            </div>

            {profile.role === "super_admin" ? (
              <form action={deleteOrder} className="danger-zone">
                <input type="hidden" name="order_id" value={order.id} />
                <div>
                  <strong>Delete order</strong>
                  <div className="eyebrow">Deletes the order and its lines/events. Use only for test or duplicate records.</div>
                </div>
                <input name="confirm_delete" placeholder="Type DELETE" aria-label="Type DELETE to delete order" />
                <button className="btn danger" type="submit">Delete</button>
              </form>
            ) : null}
          </article>
        )) : <div className="panel empty-state">No live orders yet. Orders from the public site will appear here after customer submission.</div>}
      </section>
    </AppShell>
  );
}
