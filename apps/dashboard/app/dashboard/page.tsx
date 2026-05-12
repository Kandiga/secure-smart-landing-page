import { AppShell } from "@/components/AppShell";
import { getAdminProfile, getCockpitData, type BatchSummary, type SkuGroup } from "@/lib/dashboard-data";
import { money } from "@/lib/mock-orders";
import { redirect } from "next/navigation";
import { createOrderBatch, updateBatchItemPurchase, updateOrderBatchStatus } from "./orders/actions";

export const dynamic = "force-dynamic";

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US") : "—";
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function batchMarginText(batch: BatchSummary) {
  if (batch.purchaseTotal <= 0) return "Margin pending";
  const margin = batch.customerValue - batch.purchaseTotal;
  const pct = batch.customerValue ? Math.round((margin / batch.customerValue) * 1000) / 10 : 0;
  return `${money(margin)} · ${pct}%`;
}

function supplierText(group: SkuGroup) {
  const suppliers = [...new Set(group.lines.map((line) => line.supplierName).filter(Boolean))];
  return suppliers.length ? suppliers.join(", ") : "Discomp";
}

function backorderUnits(group: SkuGroup) {
  return group.lines.reduce((sum, line) => sum + line.backorderUnits, 0);
}

function supplierQuantity(group: SkuGroup) {
  return Math.max(0, group.totalQty - backorderUnits(group));
}

const purchaseStatusOptions = [
  ["draft", "Draft"],
  ["form_sent", "Supplier form prepared"],
  ["supplier_returned", "Supplier returned form"],
  ["securesmart_approved", "SecureSmart approved"],
  ["order_confirmation_sent", "Order confirmation sent"],
  ["pi_received", "PI received"],
  ["supplied_to_customer", "Supplied to customer"],
] as const;

function purchaseStatusLabel(value: string) {
  return purchaseStatusOptions.find(([key]) => key === value)?.[1] ?? statusLabel(value);
}

function purchaseRowClass(value: string) {
  return value === "supplied_to_customer" ? "purchase-line supplied" : value === "order_confirmation_sent" || value === "pi_received" ? "purchase-line active" : "purchase-line";
}

export default async function DashboardPage() {
  const profile = await getAdminProfile();
  if (!profile) redirect("/login");
  const data = await getCockpitData();
  const totalSales = data.openLines.reduce((sum, row) => sum + row.customerTotal, 0);
  const costKnownLines = data.openLines.filter((row) => row.purchaseCostKnown).length;
  const pendingCostLines = data.openLines.length - costKnownLines;
  const waitingValue = data.waitingBatches.reduce((sum, batch) => sum + batch.customerValue, 0);
  const waitingLines = data.waitingBatches.reduce((sum, batch) => sum + batch.itemCount, 0);

  return (
    <AppShell active="/dashboard" userLabel={`${profile.email} · ${profile.role} · ${profile.account_status}`}>
      <header className="topbar cockpit-topbar">
        <div>
          <div className="eyebrow">CRM / ERP dashboard · SKU-sorted live order collection</div>
          <h1>Orders Cockpit</h1>
          <p className="topbar-copy">Collect customer orders, lock them into approval batches, export clean worksheets and keep new demand in a fresh queue.</p>
        </div>
        <div className="actions">
          <form action={createOrderBatch}>
            <button className="btn primary" disabled={!data.batchSchemaReady || data.openLines.length === 0} type="submit">Create approval batch</button>
          </form>
          <a className="btn" href="/dashboard/orders">Edit orders</a>
        </div>
      </header>

      {data.error ? <div className="notice warning">Live cockpit data warning: {data.error}</div> : null}
      {!data.batchSchemaReady ? <div className="notice warning">Batch tables are not applied yet. Run the new Orders Cockpit migration before creating approval batches.</div> : null}

      <section className="kpis" aria-label="Order metrics">
        <div className="kpi"><div className="kpi-label">Collecting now</div><div className="kpi-value">{money(totalSales)}</div></div>
        <div className="kpi"><div className="kpi-label">SKU groups</div><div className="kpi-value">{data.skuGroups.length}</div></div>
        <div className="kpi"><div className="kpi-label">Waiting approval</div><div className="kpi-value">{money(waitingValue)}</div><div className="kpi-note">{waitingLines} locked lines</div></div>
        <div className="kpi"><div className="kpi-label">Cost pending</div><div className="kpi-value">{pendingCostLines}</div></div>
      </section>

      <input className="cockpit-approval-toggle" id="cockpitApprovalToggle" type="checkbox" aria-label="Expand approval batches panel" />
      <section className="cockpit-grid">
        <section className="panel cockpit-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Collecting now, sorted by SKU</div>
              <div className="eyebrow">Only unbatched lines appear here. Creating a batch locks this snapshot and starts a fresh queue for new orders.</div>
            </div>
            <span className="chip">{data.openLines.length} open lines</span>
          </div>
          <div className="cockpit-tools" aria-label="Order list search and sorting controls">
            <label>Search orders<input data-cockpit-search placeholder="SKU, customer, product or order no." /></label>
            <label>Sort by<select data-cockpit-sort defaultValue="sku"><option value="sku">SKU A-Z</option><option value="customer">Customer A-Z</option><option value="order">Order No.</option><option value="value">Total value high-low</option></select></label>
          </div>
          <div className="table-wrap cockpit-table-wrap">
            <table className="cockpit-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Order No.</th>
                  <th className="sku">SKU</th>
                  <th>Quantity</th>
                  <th className="money">Price Each</th>
                  <th className="layout-gap" aria-label="layout spacer"></th>
                  <th>Supplier</th>
                  <th>PI No</th>
                  <th>Quantity</th>
                  <th className="money">Price each</th>
                  <th>GM %</th>
                  <th className="layout-gap" aria-label="layout spacer"></th>
                  <th className="money">Total invoice value</th>
                  <th className="money">Total purchase cost</th>
                  <th className="layout-gap" aria-label="layout spacer"></th>
                  <th>Backorder units</th>
                </tr>
              </thead>
              <tbody>
                {data.skuGroups.map((group) => {
                  const customers = [...new Set(group.lines.map((line) => line.customer).filter(Boolean))].join(" ");
                  const orderNumbers = [...new Set(group.lines.map((line) => line.orderNumber).filter(Boolean))].join(" ");
                  const projects = [...new Set(group.lines.map((line) => line.project).filter(Boolean))].join(" ");
                  return (
                  <tr key={group.sku} data-order-row data-customer={customers} data-order={orderNumbers || projects} data-product={group.product} data-sku={group.sku} data-value={group.customerValue}>
                    <td>{date(group.lines[0]?.createdAt ?? null)}</td>
                    <td>{group.lines[0]?.customer ?? "—"}</td>
                    <td><strong>{group.lines[0]?.orderNumber ?? "Pending"}</strong><br /><span className="order-project-note">{group.lines[0]?.project ?? "—"}</span></td>
                    <td className="sku"><strong>{group.sku}</strong></td>
                    <td>{group.totalQty}</td>
                    <td className="money">{group.lines.length === 1 ? money(group.lines[0].customerUnitPrice) : "Mixed"}</td>
                    <td className="layout-gap"></td>
                    <td>{supplierText(group)}</td>
                    <td>PI pending</td>
                    <td>{supplierQuantity(group)}</td>
                    <td className="money">{group.purchaseCostKnown && supplierQuantity(group) ? money(group.purchaseTotal / supplierQuantity(group)) : "Cost pending"}</td>
                    <td>{group.marginPct == null ? "GM pending" : `${group.marginPct}%`}</td>
                    <td className="layout-gap"></td>
                    <td className="money"><strong>{money(group.customerValue)}</strong></td>
                    <td className="money">{group.purchaseCostKnown ? money(group.purchaseTotal) : "Cost pending"}</td>
                    <td className="layout-gap"></td>
                    <td>{backorderUnits(group)}</td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
          {!data.skuGroups.length ? <div className="empty-state">No unbatched lines. New customer orders will appear here automatically.</div> : null}
        </section>

        <section className="cockpit-side-stack">
          <label className="approval-rail" htmlFor="cockpitApprovalToggle"><span>Approval batches</span><strong>›</strong></label>
          <div className="cockpit-side-content">
          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Waiting approval</div>
                <div className="eyebrow">Locked batches. They no longer mix with new incoming orders.</div>
              </div>
            </div>
            <div className="batch-list">
              {data.waitingBatches.map((batch) => (
                <article className="batch-card" key={batch.id}>
                  <div className="batch-card-head">
                    <div>
                      <strong>{batch.batchNumber}</strong>
                      <div className="eyebrow">Created {date(batch.createdAt)} · {batch.skuCount} SKUs · {batch.customerCount} customers</div>
                    </div>
                    <span className="chip warning">{statusLabel(batch.status)}</span>
                  </div>
                  <div className="batch-metrics">
                    <div><span>Customer value</span><strong>{money(batch.customerValue)}</strong></div>
                    <div><span>Purchase cost</span><strong>{batch.purchaseTotal > 0 ? money(batch.purchaseTotal) : "Cost pending"}</strong></div>
                    <div><span>Margin</span><strong>{batchMarginText(batch)}</strong></div>
                  </div>
                  <details className="purchase-portal">
                    <summary>Supplier purchase portal · {batch.items.length} lines</summary>
                    <div className="purchase-flow-note">Prepare supplier form → send it manually from Secure Smart email → supplier returns completed form → Secure Smart approves → download/send order confirmation for PI → complete PI details → mark supplied to customer.</div>
                    <div className="purchase-lines">
                      {batch.items.map((item) => {
                        const unitCost = item.customerQty && item.purchaseTotal ? item.purchaseTotal / item.customerQty : 0;
                        return (
                          <article className={purchaseRowClass(item.purchaseStatus)} key={item.id}>
                            <div className="purchase-line-head">
                              <div><strong>{item.sku}</strong><span>{item.itemName || item.customerName || "Batch line"}</span></div>
                              <span className="chip">{purchaseStatusLabel(item.purchaseStatus)}</span>
                            </div>
                            <form action={updateBatchItemPurchase} className="purchase-line-form">
                              <input type="hidden" name="batch_id" value={batch.id} />
                              <input type="hidden" name="item_id" value={item.id} />
                              <label>Supplier<input name="supplier_name" defaultValue={item.supplierName ?? ""} placeholder="Supplier name" /></label>
                              <label>Supplier email<input name="supplier_email" type="email" defaultValue={item.supplierEmail ?? ""} placeholder="supplier@example.com" /></label>
                              <label>PI No<input name="pi_no" defaultValue={item.piNo ?? ""} placeholder="PI pending" /></label>
                              <label>Purchase qty<input name="purchase_quantity" inputMode="decimal" defaultValue={item.customerQty} /></label>
                              <label>Price each<input name="purchase_unit_cost" inputMode="decimal" defaultValue={unitCost ? String(Math.round(unitCost * 100) / 100) : ""} placeholder="Cost pending" /></label>
                              <label>Backorder<input name="backorder_units" inputMode="decimal" defaultValue={item.backorderUnits} /></label>
                              <label>Status<select name="purchase_status" defaultValue={item.purchaseStatus}>{purchaseStatusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                              <button className="btn" type="submit">Save line</button>
                            </form>
                            <div className="purchase-actions">
                              <a className="btn" href={`/api/order-batches/${batch.id}/supplier-document?itemId=${item.id}&kind=form`}>Download supplier form</a>
                              <a className="btn primary" href={`/api/order-batches/${batch.id}/supplier-document?itemId=${item.id}&kind=confirmation`}>Download order confirmation</a>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </details>
                  <div className="batch-actions">
                    <a className="btn" href={`/api/order-batches/${batch.id}/export`}>Export worksheet</a>
                    <form action={updateOrderBatchStatus}>
                      <input type="hidden" name="batch_id" value={batch.id} />
                      <input type="hidden" name="status" value="approved" />
                      <button className="btn primary" type="submit">Approve</button>
                    </form>
                    <form action={updateOrderBatchStatus}>
                      <input type="hidden" name="batch_id" value={batch.id} />
                      <input type="hidden" name="status" value="completed" />
                      <button className="btn" type="submit">Mark completed</button>
                    </form>
                  </div>
                </article>
              ))}
              {!data.waitingBatches.length ? <div className="empty-state">No locked batch is waiting. Create one from the live collection queue.</div> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Completed / cancelled</div>
                <div className="eyebrow">Recent closed batches for audit and traceability.</div>
              </div>
            </div>
            <div className="batch-list compact">
              {data.completedBatches.map((batch) => (
                <article className="batch-card compact" key={batch.id}>
                  <strong>{batch.batchNumber}</strong>
                  <span>{statusLabel(batch.status)} · {money(batch.customerValue)}</span>
                </article>
              ))}
              {!data.completedBatches.length ? <div className="empty-state">No completed batches yet.</div> : null}
            </div>
          </section>
          </div>
        </section>
      </section>
      <script dangerouslySetInnerHTML={{ __html: `
        (() => {
          const input = document.querySelector('[data-cockpit-search]');
          const sort = document.querySelector('[data-cockpit-sort]');
          const tbody = document.querySelector('.cockpit-table tbody');
          if (!input || !sort || !tbody) return;
          const text = (row) => [row.dataset.sku, row.dataset.customer, row.dataset.order, row.dataset.product].join(' ').toLowerCase();
          const apply = () => {
            const q = String(input.value || '').trim().toLowerCase();
            const rows = Array.from(tbody.querySelectorAll('[data-order-row]'));
            rows.forEach((row) => { row.hidden = q ? !text(row).includes(q) : false; });
            rows.sort((a, b) => {
              const mode = sort.value;
              if (mode === 'value') return (Number(b.dataset.value) || 0) - (Number(a.dataset.value) || 0);
              const key = mode === 'customer' ? 'customer' : mode === 'order' ? 'order' : 'sku';
              return String(a.dataset[key] || '').localeCompare(String(b.dataset[key] || ''), 'en', { numeric: true, sensitivity: 'base' });
            }).forEach((row) => tbody.appendChild(row));
          };
          input.addEventListener('input', apply);
          sort.addEventListener('change', apply);
          apply();
        })();
      ` }} />
    </AppShell>
  );
}
