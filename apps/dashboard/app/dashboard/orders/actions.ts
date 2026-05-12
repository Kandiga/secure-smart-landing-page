"use server";

import { getAdminProfile } from "@/lib/dashboard-data";
import { sendOpsEmail } from "@/lib/email-notifications";
import { DEFAULT_SUPPLIER_NAME, invoiceTotalForAvailable, purchaseTotalOrFormula, purchaseUnitOrFormula } from "@/lib/secure-smart-pricing";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type StockStatus = "in_stock" | "partial" | "missing" | "needs_purchase";
type OrderStatus = "new" | "review" | "approved" | "needs_purchase" | "partial_stock" | "ready_to_deliver" | "delivered" | "cancelled";
type BatchStatus = "waiting_approval" | "approved" | "executing" | "completed" | "cancelled";
type PurchaseStatus = "draft" | "form_sent" | "supplier_returned" | "securesmart_approved" | "order_confirmation_sent" | "pi_received" | "supplied_to_customer";

function num(value: FormDataEntryValue | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function int(value: FormDataEntryValue | null) {
  const n = Math.round(num(value));
  return n > 0 ? n : 1;
}

async function assertAdmin() {
  const profile = await getAdminProfile();
  if (!profile) throw new Error("Admin access required.");
  return profile;
}

async function recalcOrder(orderId: string) {
  const supabase = createServiceClient();
  const { data: items, error } = await supabase
    .from("order_items")
    .select("customer_total,purchase_total,margin")
    .eq("order_id", orderId);
  if (error) throw new Error(error.message);
  const totalCustomer = (items ?? []).reduce((sum, item: any) => sum + Number(item.customer_total || 0), 0);
  const totalPurchase = (items ?? []).reduce((sum, item: any) => sum + Number(item.purchase_total || 0), 0);
  const grossMargin = totalCustomer - totalPurchase;
  const marginPct = totalCustomer ? (grossMargin / totalCustomer) * 100 : 0;
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      total_customer_value: totalCustomer,
      total_purchase_cost: totalPurchase,
      gross_margin: grossMargin,
      margin_pct: Math.round(marginPct * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (updateError) throw new Error(updateError.message);
}

async function recalcBatch(batchId: string) {
  const supabase = createServiceClient();
  const { data: items, error } = await supabase
    .from("order_batch_items")
    .select("customer_total,purchase_total")
    .eq("batch_id", batchId);
  if (error) throw new Error(error.message);
  const customerValue = (items ?? []).reduce((sum, item: any) => sum + Number(item.customer_total || 0), 0);
  const purchaseTotal = (items ?? []).reduce((sum, item: any) => sum + Number(item.purchase_total || 0), 0);
  const { error: updateError } = await supabase
    .from("order_batches")
    .update({ customer_value: customerValue, purchase_total: purchaseTotal, updated_at: new Date().toISOString() })
    .eq("id", batchId);
  if (updateError) throw new Error(updateError.message);
}

function safeText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function supplierReplyTo() {
  return process.env.SECURE_SMART_REPLY_TO || "info@securesmart.tech";
}

export async function createOrderBatch() {
  const profile = await assertAdmin();
  const supabase = createServiceClient();

  const existingBatchItems = await supabase.from("order_batch_items").select("order_item_id");
  if (existingBatchItems.error) throw new Error(existingBatchItems.error.message);
  const batched = new Set((existingBatchItems.data ?? []).map((item: any) => String(item.order_item_id)));

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,company_id,order_number,project_name,status,companies(name),order_items(id,sku,product_title,order_quantity,customer_unit_price,customer_total,purchase_unit_price,purchase_total,stock_status,supplier_name,missing_quantity)")
    .not("status", "in", "(new,delivered,cancelled)")
    .order("created_at", { ascending: true })
    .limit(150);
  if (ordersError) throw new Error(ordersError.message);

  const batchItems: Array<Record<string, any>> = [];
  const orderIds = new Set<string>();
  for (const order of ((orders ?? []) as Array<Record<string, any>>)) {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of items) {
      if (batched.has(String(item.id))) continue;
      orderIds.add(String(order.id));
      const qty = Number(item.order_quantity || 0);
      const customerUnit = Number(item.customer_unit_price || 0);
      const backorderUnits = Number(item.missing_quantity || 0);
      const customerTotal = invoiceTotalForAvailable(customerUnit, qty, backorderUnits);
      const purchaseUnit = purchaseUnitOrFormula(item.purchase_unit_price, customerUnit);
      const purchaseTotal = purchaseTotalOrFormula(item.purchase_unit_price, item.purchase_total, customerUnit, qty, backorderUnits);
      batchItems.push({
        order_id: order.id,
        order_item_id: item.id,
        company_id: order.company_id,
        sku: item.sku,
        item_name: item.product_title || item.sku,
        customer_name: order.companies?.name || "Customer without company",
        order_number: order.order_number || null,
        project_name: order.project_name || order.order_number || "Customer order",
        customer_qty: qty,
        customer_unit_price: customerUnit,
        customer_total: customerTotal,
        purchase_unit_cost: purchaseUnit,
        purchase_total: purchaseTotal,
        supplier_name: item.supplier_name || DEFAULT_SUPPLIER_NAME,
        pi_no: null,
        backorder_units: backorderUnits,
        stock_status: item.stock_status || "needs_purchase",
        status: "waiting_approval",
      });
    }
  }

  if (!batchItems.length) throw new Error("No unbatched order lines are waiting for approval.");

  const customerValue = batchItems.reduce((sum, item) => sum + Number(item.customer_total || 0), 0);
  const purchaseTotal = batchItems.reduce((sum, item) => sum + Number(item.purchase_total || 0), 0);
  const { data: batch, error: batchError } = await supabase
    .from("order_batches")
    .insert({ status: "waiting_approval", created_by: profile.id, customer_value: customerValue, purchase_total: purchaseTotal })
    .select("id,batch_number")
    .single();
  if (batchError) throw new Error(batchError.message);

  const rows = batchItems.map((item) => ({ ...item, batch_id: batch.id }));
  const { error: itemsError } = await supabase.from("order_batch_items").insert(rows);
  if (itemsError) {
    await supabase.from("order_batches").delete().eq("id", batch.id);
    throw new Error(itemsError.message);
  }

  if (orderIds.size) {
    await supabase.from("orders").update({ status: "review", updated_at: new Date().toISOString() }).in("id", [...orderIds]);
  }
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "create_order_batch", entity_type: "order_batch", entity_id: batch.id, metadata: { batch_number: batch.batch_number, lines: rows.length, orders: orderIds.size } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
}

export async function updateOrderBatchStatus(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const batchId = String(formData.get("batch_id") || "");
  const status = String(formData.get("status") || "approved") as BatchStatus;
  if (!batchId) throw new Error("Missing batch id.");
  if (!["approved", "executing", "completed", "cancelled"].includes(status)) throw new Error("Unsupported batch status.");

  const update: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (status === "approved") {
    update.approved_by = profile.id;
    update.approved_at = new Date().toISOString();
  }
  const { error } = await supabase.from("order_batches").update(update).eq("id", batchId);
  if (error) throw new Error(error.message);

  const { data: items, error: itemsError } = await supabase.from("order_batch_items").select("order_id").eq("batch_id", batchId);
  if (itemsError) throw new Error(itemsError.message);
  const orderIds = [...new Set((items ?? []).map((item: any) => item.order_id).filter(Boolean))];
  const orderStatus: OrderStatus = status === "completed" ? "delivered" : status === "cancelled" ? "cancelled" : status === "approved" ? "approved" : "needs_purchase";
  if (orderIds.length) {
    await supabase.from("orders").update({ status: orderStatus, updated_at: new Date().toISOString() }).in("id", orderIds);
  }
  await supabase.from("order_events").insert(orderIds.map((orderId) => ({ order_id: orderId, actor_user_id: profile.id, event_type: "batch_status_update", metadata: { batch_id: batchId, batch_status: status, order_status: orderStatus } })));
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "update_order_batch_status", entity_type: "order_batch", entity_id: batchId, metadata: { status, order_status: orderStatus, affected_orders: orderIds.length } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
}

export async function updateBatchItemPurchase(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const batchId = String(formData.get("batch_id") || "");
  const itemId = String(formData.get("item_id") || "");
  if (!batchId || !itemId) throw new Error("Missing batch item id.");
  const purchaseQty = num(formData.get("purchase_quantity"));
  const purchaseUnit = num(formData.get("purchase_unit_cost"));
  const purchaseTotal = purchaseQty && purchaseUnit ? purchaseQty * purchaseUnit : num(formData.get("purchase_total"));
  const purchaseStatus = String(formData.get("purchase_status") || "draft") as PurchaseStatus;
  const now = new Date().toISOString();
  const update: Record<string, any> = {
    supplier_name: safeText(formData.get("supplier_name")),
    supplier_email: safeText(formData.get("supplier_email")),
    pi_no: safeText(formData.get("pi_no")),
    purchase_unit_cost: purchaseUnit || null,
    purchase_total: purchaseTotal || null,
    backorder_units: num(formData.get("backorder_units")),
    purchase_status: purchaseStatus,
    updated_at: now,
  };
  if (purchaseStatus === "supplier_returned") update.supplier_form_returned_at = now;
  if (purchaseStatus === "securesmart_approved") update.supplier_approved_at = now;
  if (purchaseStatus === "pi_received") update.pi_received_at = now;
  if (purchaseStatus === "supplied_to_customer") update.stock_status = "in_stock";
  const { error } = await supabase.from("order_batch_items").update(update).eq("id", itemId).eq("batch_id", batchId);
  if (error) throw new Error(error.message);
  await recalcBatch(batchId);
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "update_batch_purchase_line", entity_type: "order_batch_item", entity_id: itemId, metadata: { batch_id: batchId, purchase_status: purchaseStatus } });
  revalidatePath("/dashboard");
}

export async function sendSupplierPurchaseForm(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const batchId = String(formData.get("batch_id") || "");
  const itemId = String(formData.get("item_id") || "");
  const supplierEmail = String(formData.get("supplier_email") || "").trim();
  if (!batchId || !itemId || !supplierEmail) throw new Error("Supplier email is required.");
  const { data: item, error } = await supabase
    .from("order_batch_items")
    .select("sku,item_name,customer_qty,purchase_unit_cost,purchase_total,supplier_name,pi_no,backorder_units")
    .eq("id", itemId)
    .eq("batch_id", batchId)
    .single();
  if (error || !item) throw new Error(error?.message ?? "Batch item not found.");
  const replyTo = supplierReplyTo();
  const text = `Dear Supplier,\n\nPlease complete the purchase form below and reply to this same email address (${replyTo}).\n\nSKU: ${(item as any).sku}\nItem: ${(item as any).item_name ?? ""}\nRequired quantity: ${(item as any).customer_qty}\n\nPlease complete:\nSupplier name:\nPI No:\nPurchase quantity:\nPrice each:\nBackorder units:\nExpected supply date:\nNotes:\n\nAfter Secure Smart approval you will receive an order confirmation to produce the PI.\n\nSecure Smart`;
  const result = await sendOpsEmail({
    to: supplierEmail,
    replyTo,
    subject: `Secure Smart purchase form · ${(item as any).sku}`,
    text,
    html: `<p>Dear Supplier,</p><p>Please complete the purchase form below and reply to this same email address: <strong>${replyTo}</strong>.</p><table border="1" cellpadding="6" cellspacing="0"><tr><th>SKU</th><td>${(item as any).sku}</td></tr><tr><th>Item</th><td>${(item as any).item_name ?? ""}</td></tr><tr><th>Required quantity</th><td>${(item as any).customer_qty}</td></tr><tr><th>Supplier name</th><td></td></tr><tr><th>PI No</th><td></td></tr><tr><th>Purchase quantity</th><td></td></tr><tr><th>Price each</th><td></td></tr><tr><th>Backorder units</th><td></td></tr><tr><th>Expected supply date</th><td></td></tr><tr><th>Notes</th><td></td></tr></table><p>After Secure Smart approval you will receive an order confirmation to produce the PI.</p><p>Secure Smart</p>`,
  });
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("order_batch_items")
    .update({ supplier_email: supplierEmail, supplier_form_sent_at: now, purchase_status: "form_sent" })
    .eq("id", itemId)
    .eq("batch_id", batchId);
  if (updateError) throw new Error(updateError.message);
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "send_supplier_purchase_form", entity_type: "order_batch_item", entity_id: itemId, metadata: { batch_id: batchId, email_provider: result.provider, sent: result.sent } });
  revalidatePath("/dashboard");
}

export async function sendSupplierOrderConfirmation(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const batchId = String(formData.get("batch_id") || "");
  const itemId = String(formData.get("item_id") || "");
  if (!batchId || !itemId) throw new Error("Missing batch item id.");
  const { data: item, error } = await supabase
    .from("order_batch_items")
    .select("sku,item_name,customer_qty,purchase_unit_cost,purchase_total,supplier_name,supplier_email,pi_no")
    .eq("id", itemId)
    .eq("batch_id", batchId)
    .single();
  if (error || !item) throw new Error(error?.message ?? "Batch item not found.");
  const supplierEmail = String((item as any).supplier_email || "").trim();
  if (!supplierEmail) throw new Error("Supplier email is required before sending confirmation.");
  const replyTo = supplierReplyTo();
  const result = await sendOpsEmail({
    to: supplierEmail,
    replyTo,
    subject: `Secure Smart order confirmation · ${(item as any).sku}`,
    text: `Dear Supplier,\n\nSecure Smart approves this purchase line. Please issue / produce the PI and return it to ${replyTo}.\n\nSKU: ${(item as any).sku}\nItem: ${(item as any).item_name ?? ""}\nQuantity: ${(item as any).customer_qty}\nPI No: ${(item as any).pi_no ?? "pending"}\n\nSecure Smart`,
  });
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("order_batch_items")
    .update({ supplier_approved_at: now, order_confirmation_sent_at: now, purchase_status: "order_confirmation_sent" })
    .eq("id", itemId)
    .eq("batch_id", batchId);
  if (updateError) throw new Error(updateError.message);
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "send_supplier_order_confirmation", entity_type: "order_batch_item", entity_id: itemId, metadata: { batch_id: batchId, email_provider: result.provider, sent: result.sent } });
  revalidatePath("/dashboard");
}

export async function updateOrderHeader(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const orderId = String(formData.get("order_id") || "");
  if (!orderId) throw new Error("Missing order id.");
  const status = String(formData.get("status") || "review") as OrderStatus;
  const projectName = String(formData.get("project_name") || "").trim() || null;
  const orderNumber = String(formData.get("order_number") || "").trim() || null;
  const { error } = await supabase
    .from("orders")
    .update({ order_number: orderNumber, project_name: projectName, status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  await supabase.from("order_events").insert({ order_id: orderId, actor_user_id: profile.id, event_type: "admin_update_order_header", metadata: { status, project_name_present: Boolean(projectName), order_number_present: Boolean(orderNumber) } });
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "update_order_header", entity_type: "order", entity_id: orderId, metadata: { status } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
}

export async function updateOrderItem(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const itemId = String(formData.get("item_id") || "");
  const orderId = String(formData.get("order_id") || "");
  if (!itemId || !orderId) throw new Error("Missing order item id.");
  const quantity = int(formData.get("order_quantity"));
  const customerUnit = num(formData.get("customer_unit_price"));
  const purchaseUnit = num(formData.get("purchase_unit_price"));
  const customerTotal = quantity * customerUnit;
  const purchaseTotal = quantity * purchaseUnit;
  const margin = customerTotal - purchaseTotal;
  const marginPct = customerTotal ? (margin / customerTotal) * 100 : 0;
  const stockStatus = String(formData.get("stock_status") || "needs_purchase") as StockStatus;
  const notes = String(formData.get("notes") || "").trim() || null;
  const productTitle = String(formData.get("product_title") || "").trim() || null;
  const { error } = await supabase
    .from("order_items")
    .update({
      product_title: productTitle,
      order_quantity: quantity,
      customer_unit_price: customerUnit,
      customer_total: customerTotal,
      purchase_unit_price: purchaseUnit,
      purchase_total: purchaseTotal,
      margin,
      margin_pct: Math.round(marginPct * 100) / 100,
      stock_status: stockStatus,
      notes,
    })
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  await recalcOrder(orderId);
  await supabase.from("order_events").insert({ order_id: orderId, actor_user_id: profile.id, event_type: "admin_update_order_item", metadata: { item_id: itemId, stock_status: stockStatus } });
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "update_order_item", entity_type: "order", entity_id: orderId, metadata: { item_id: itemId } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
}

export async function deleteOrder(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const orderId = String(formData.get("order_id") || "");
  const confirm = String(formData.get("confirm_delete") || "").trim().toUpperCase();
  if (!orderId) throw new Error("Missing order id.");
  if (confirm !== "DELETE") throw new Error("Type DELETE to remove the order.");
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw new Error(error.message);
  await supabase.from("audit_logs").insert({ actor_user_id: profile.id, action: "delete_order", entity_type: "order", entity_id: orderId, metadata: { confirmed: true } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/customers");
}
