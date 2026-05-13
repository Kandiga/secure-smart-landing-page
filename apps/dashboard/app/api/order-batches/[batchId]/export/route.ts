import { getAdminProfile } from "@/lib/dashboard-data";
import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { DEFAULT_SUPPLIER_NAME, availableQuantity, grossMarginPct, invoiceTotalForAvailable, purchaseTotalOrFormula, purchaseUnitOrFormula } from "@/lib/secure-smart-pricing";

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

function blankRow(width = 23) {
  return Array.from({ length: width }, () => "");
}

export async function GET(_request: NextRequest, context: { params: Promise<{ batchId: string }> }) {
  const profile = await getAdminProfile();
  if (!profile) return NextResponse.json({ error: "Admin access required" }, { status: 401 });

  const { batchId } = await context.params;
  const supabase = createServiceClient();
  const { data: batch, error: batchError } = await supabase
    .from("order_batches")
    .select("id,batch_number,status,created_at,customer_value,purchase_total,order_batch_items(sku,item_name,customer_name,order_number,project_name,customer_po_number,customer_visible_note,internal_admin_note,customer_is_vip,customer_vip_label,customer_qty,customer_unit_price,customer_total,purchase_unit_cost,purchase_total,supplier_name,supplier_email,pi_no,backorder_units,stock_status,purchase_status)")
    .eq("id", batchId)
    .single();
  if (batchError || !batch) return NextResponse.json({ error: batchError?.message ?? "Batch not found" }, { status: 404 });

  const items = Array.isArray((batch as any).order_batch_items) ? (batch as any).order_batch_items : [];
  const grouped = new Map<string, any[]>();
  for (const item of items) {
    const key = String(item.sku || "UNKNOWN");
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));

  const worksheetRows: (string | number)[][] = [
    blankRow(),
    blankRow(),
    blankRow(),
    blankRow(),
    blankRow(),
    blankRow(),
    blankRow(),
    ["", "", "Date", "Customer", "VIP", "Order No.", "PO", "SKU", "Quantity", "Price Each", "", "Supplier", "PI No", "Quantity", "Price each", "GM %", "", "Total invoice value", "Total purchase cost", "", "Backorder units", "Customer note", "Internal note"],
    blankRow(),
  ];

  for (const [sku, group] of sortedGroups) {
    const customerTotal = group.reduce((sum, item) => sum + invoiceTotalForAvailable(item.customer_unit_price, item.customer_qty, item.backorder_units), 0);
    const purchaseTotal = group.reduce((sum, item) => sum + purchaseTotalOrFormula(item.purchase_unit_cost, item.purchase_total, item.customer_unit_price, item.customer_qty, item.backorder_units), 0);
    const customerQty = group.reduce((sum, item) => sum + num(item.customer_qty), 0);
    const backorder = group.reduce((sum, item) => sum + num(item.backorder_units), 0);
    const supplierQty = group.reduce((sum, item) => sum + availableQuantity(item.customer_qty, item.backorder_units), 0);
    const customers = [...new Set(group.map((item) => item.customer_name).filter(Boolean))];
    const orderNumbers = [...new Set(group.map((item) => item.order_number).filter(Boolean))];
    const suppliers = [...new Set(group.map((item) => item.supplier_name).filter(Boolean))];
    const vipLabels = [...new Set(group.filter((item) => item.customer_is_vip).map((item) => item.customer_vip_label || "VIP"))];
    const poNumbers = [...new Set(group.map((item) => item.customer_po_number).filter(Boolean))];
    const customerNotes = [...new Set(group.map((item) => item.customer_visible_note).filter(Boolean))];
    const internalNotes = [...new Set(group.map((item) => item.internal_admin_note).filter(Boolean))];
    const piNos = [...new Set(group.map((item) => item.pi_no).filter(Boolean))];
    const customerUnitPrices = [...new Set(group.map((item) => moneyValue(item.customer_unit_price)).filter(Boolean))];
    const purchaseUnitPrices = [...new Set(group.map((item) => moneyValue(purchaseUnitOrFormula(item.purchase_unit_cost, item.customer_unit_price))).filter(Boolean))];

    worksheetRows.push([
      "",
      "",
      dateOnly((batch as any).created_at),
      customers.length === 1 ? customers[0] : `Multiple (${customers.length})`,
      vipLabels.join(", "),
      orderNumbers.length === 1 ? orderNumbers[0] : orderNumbers.length ? `Mixed (${orderNumbers.length})` : "Pending",
      poNumbers.join(", "),
      sku,
      customerQty,
      customerUnitPrices.length === 1 ? Number(customerUnitPrices[0]) : "Mixed",
      "",
      suppliers.length ? suppliers.join(", ") : DEFAULT_SUPPLIER_NAME,
      piNos.join(", "),
      supplierQty,
      purchaseUnitPrices.length === 1 ? Number(purchaseUnitPrices[0]) : "Mixed",
      grossMarginPct(customerTotal, purchaseTotal) ?? "",
      "",
      Number(moneyValue(customerTotal)),
      purchaseTotal ? Number(moneyValue(purchaseTotal)) : "",
      "",
      backorder,
      customerNotes.join(" | "),
      internalNotes.join(" | "),
    ]);
    worksheetRows.push(blankRow());
  }

  await supabase.from("order_batches").update({ exported_at: new Date().toISOString() }).eq("id", batchId);
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "export_order_batch", entity_type: "order_batch", entity_id: batchId, metadata: { batch_number: (batch as any).batch_number, rows: sortedGroups.length, source_lines: items.length, layout: "Portal_layout.xlsx", format: "xlsx" } });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Secure Smart";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Discomp order");
  worksheetRows.forEach((row) => worksheet.addRow(row));
  worksheet.columns = [
    { width: 4 }, { width: 4 }, { width: 12 }, { width: 24 }, { width: 12 }, { width: 18 }, { width: 16 }, { width: 22 }, { width: 10 }, { width: 12 }, { width: 4 },
    { width: 18 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 4 }, { width: 18 }, { width: 18 }, { width: 4 }, { width: 16 }, { width: 28 }, { width: 28 },
  ];
  worksheet.getRow(8).font = { bold: true };
  worksheet.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCECF4" } };
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFB7C9D3" } },
        left: { style: "thin", color: { argb: "FFB7C9D3" } },
        bottom: { style: "thin", color: { argb: "FFB7C9D3" } },
        right: { style: "thin", color: { argb: "FFB7C9D3" } },
      };
    });
  });
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return new NextResponse(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${(batch as any).batch_number}-discomp-order.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
