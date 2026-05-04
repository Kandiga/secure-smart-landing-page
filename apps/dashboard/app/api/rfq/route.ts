import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const rfqSchema = z.object({
  customerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  projectName: z.string().max(200).optional(),
  source: z.string().default("website"),
  language: z.string().default("en"),
  items: z.array(z.object({
    sku: z.string().min(1).max(120),
    title: z.string().max(300).optional(),
    quantity: z.number().int().positive().max(100000),
    customerUnitPrice: z.number().nonnegative().optional(),
    notes: z.string().max(1000).optional(),
  })).min(1).max(200),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-secure-smart-signature");
  const secret = process.env.SECURE_SMART_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!signature || signature !== secret) return unauthorized();

  const json = await request.json().catch(() => null);
  const parsed = rfqSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid RFQ payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const totalCustomerValue = parsed.data.items.reduce((sum, item) => sum + (item.customerUnitPrice ?? 0) * item.quantity, 0);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      company_id: parsed.data.companyId ?? null,
      customer_user_id: parsed.data.customerId ?? null,
      project_name: parsed.data.projectName ?? `Website RFQ · ${parsed.data.language}`,
      source: parsed.data.source,
      status: "new",
      total_customer_value: totalCustomerValue,
      total_purchase_cost: 0,
      gross_margin: totalCustomerValue,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }

  const orderItems = parsed.data.items.map((item) => {
    const customerTotal = (item.customerUnitPrice ?? 0) * item.quantity;
    return {
      order_id: order.id,
      sku: item.sku,
      product_title: item.title ?? item.sku,
      order_quantity: item.quantity,
      customer_unit_price: item.customerUnitPrice ?? null,
      customer_total: customerTotal,
      purchase_unit_price: null,
      purchase_total: null,
      margin: customerTotal,
      margin_pct: null,
      stock_status: "needs_purchase",
      notes: item.notes,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Could not create order items" }, { status: 500 });
  }

  await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "website_rfq_received",
    metadata: { source: parsed.data.source, language: parsed.data.language, itemCount: parsed.data.items.length },
  });

  return NextResponse.json({ ok: true, orderId: order.id, receivedItems: parsed.data.items.length });
}
