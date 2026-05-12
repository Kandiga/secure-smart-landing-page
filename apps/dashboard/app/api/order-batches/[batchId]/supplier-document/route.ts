import { getAdminProfile } from "@/lib/dashboard-data";
import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function esc(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function moneyValue(value: unknown) {
  if (value == null || value === "") return "";
  return num(value).toFixed(2);
}

function dateOnly(value: unknown) {
  if (!value) return "";
  return new Date(String(value)).toISOString().slice(0, 10);
}

function td(value: unknown, cls = "") {
  return `<td${cls ? ` class="${cls}"` : ""}>${esc(value)}</td>`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const profile = await getAdminProfile();
  if (!profile) return NextResponse.json({ error: "Admin access required" }, { status: 401 });

  const { batchId } = await context.params;
  const itemId = request.nextUrl.searchParams.get("itemId") || "";
  const kind = request.nextUrl.searchParams.get("kind") === "confirmation" ? "confirmation" : "form";
  if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: batch, error } = await supabase
    .from("order_batches")
    .select("id,batch_number,status,created_at,order_batch_items(id,sku,item_name,customer_name,project_name,customer_qty,customer_unit_price,customer_total,purchase_unit_cost,purchase_total,supplier_name,supplier_email,pi_no,backorder_units,purchase_status)")
    .eq("id", batchId)
    .single();
  if (error || !batch) return NextResponse.json({ error: error?.message ?? "Batch not found" }, { status: 404 });

  const items = Array.isArray((batch as any).order_batch_items) ? (batch as any).order_batch_items : [];
  const item = items.find((row: any) => String(row.id) === itemId);
  if (!item) return NextResponse.json({ error: "Batch item not found" }, { status: 404 });

  const title = kind === "confirmation" ? "Secure Smart Order Confirmation for PI" : "Secure Smart Supplier Purchase Form";
  const instruction = kind === "confirmation"
    ? "Secure Smart has approved this purchase line. Please produce / issue the PI and return it to the Secure Smart email address used for this order."
    : "Supplier section: please complete the empty fields and return this document to the same Secure Smart email address that sent it.";

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    action: kind === "confirmation" ? "download_supplier_order_confirmation" : "download_supplier_purchase_form",
    entity_type: "order_batch_item",
    entity_id: itemId,
    metadata: { batch_id: batchId, batch_number: (batch as any).batch_number, sku: item.sku },
  });

  const rows = [
    ["Batch", (batch as any).batch_number],
    ["Date", dateOnly((batch as any).created_at)],
    ["Customer", item.customer_name || ""],
    ["Order No.", item.project_name || ""],
    ["SKU", item.sku || ""],
    ["Item", item.item_name || ""],
    ["Required quantity", item.customer_qty || ""],
    ["Supplier", item.supplier_name || ""],
    ["Supplier email", item.supplier_email || ""],
    ["PI No", item.pi_no || ""],
    ["Purchase quantity", item.customer_qty || ""],
    ["Price each", moneyValue(item.purchase_unit_cost)],
    ["Total purchase cost", moneyValue(item.purchase_total)],
    ["Backorder units", item.backorder_units || 0],
    ["Expected supply date", ""],
    ["Supplier notes", ""],
  ];

  const htmlRows = rows.map(([label, value]) => `<tr><th>${esc(label)}</th>${td(value)}</tr>`).join("\n");
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; color: #122938; }
  h1 { font-size: 18pt; margin-bottom: 4px; }
  p { font-size: 11pt; color: #445; }
  table { border-collapse: collapse; font-size: 11pt; margin-top: 16px; }
  th, td { border: 1px solid #b7c9d3; padding: 8px 10px; min-width: 180px; text-align: left; white-space: nowrap; }
  th { background: #dcecf4; color: #122938; font-weight: 700; }
  td { min-width: 260px; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(instruction)}</p>
<table>${htmlRows}</table>
</body>
</html>`;

  const suffix = kind === "confirmation" ? "order-confirmation" : "supplier-form";
  return new NextResponse(html, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="${(batch as any).batch_number}-${item.sku}-${suffix}.xls"`,
      "cache-control": "no-store",
    },
  });
}
