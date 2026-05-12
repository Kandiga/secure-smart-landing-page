import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOpsEmail } from "@/lib/email-notifications";

const allowedOrigins = new Set([
  "https://securesmart.tech",
  "https://www.securesmart.tech",
  "https://crm.securesmart.tech",
]);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://securesmart.tech",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

const publicOrderRequestSchema = z.object({
  source: z.string().max(120).default("website-cart"),
  language: z.string().max(12).default("en"),
  company: z.string().max(200).optional().default(""),
  contact: z.string().max(200).optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  notes: z.string().max(2000).optional().default(""),
  items: z.array(z.object({
    sku: z.string().min(1).max(120),
    title: z.string().max(300).optional(),
    brand: z.string().max(120).optional(),
    quantity: z.number().int().positive().max(100000),
    mode: z.string().max(40).optional(),
    customerUnitPrice: z.number().nonnegative().optional(),
    notes: z.string().max(1000).optional(),
  })).min(1).max(200),
});

type ApprovedCustomerContext = {
  userId: string;
  email: string;
  displayName: string;
  companyId: string | null;
  companyName: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function nextOrderNumber(supabase: ReturnType<typeof createServiceClient>) {
  const ymd = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `SS-ORD-${ymd}-`;
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .ilike("order_number", `${prefix}%`);
  const start = (count ?? 0) + 1;
  for (let offset = 0; offset < 25; offset += 1) {
    const candidate = `${prefix}${String(start + offset).padStart(4, "0")}`;
    const { data } = await supabase.from("orders").select("id,order_number").eq("order_number", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${prefix}${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function getApprovedCustomerContext(request: NextRequest, supabase: ReturnType<typeof createServiceClient>): Promise<ApprovedCustomerContext | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,first_name,last_name,role,account_status")
    .eq("id", user.id)
    .single();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, created_at, companies(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasCustomerPortalAccess =
    profile?.account_status === "approved" &&
    (profile.role === "customer" || (["admin", "super_admin"].includes(profile.role) && Boolean(membership)));

  if (!profile || !hasCustomerPortalAccess) return null;

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || user.email || "Approved customer";
  const company = membership?.companies as { name?: string } | null | undefined;

  return {
    userId: user.id,
    email: profile.email || user.email || "",
    displayName,
    companyId: membership?.company_id ?? null,
    companyName: company?.name || "",
  };
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  const json = await request.json().catch(() => null);
  const parsed = publicOrderRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order request payload", issues: parsed.error.flatten() }, { status: 400, headers });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503, headers });
  }

  const customerContext = await getApprovedCustomerContext(request, supabase);
  const companyName = customerContext?.companyName || parsed.data.company;
  const contactName = customerContext?.displayName || parsed.data.contact;
  const contactEmail = customerContext?.email || parsed.data.email;

  const totalCustomerValue = parsed.data.items.reduce((sum, item) => sum + (item.customerUnitPrice ?? 0) * item.quantity, 0);
  const projectName = [customerContext ? "Customer portal order" : "Website order", companyName, contactName].filter(Boolean).join(" · ") || `Website order · ${parsed.data.language}`;
  const orderNumber = await nextOrderNumber(supabase);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      company_id: customerContext?.companyId ?? null,
      customer_user_id: customerContext?.userId ?? null,
      project_name: projectName,
      source: parsed.data.source,
      status: "new",
      total_customer_value: totalCustomerValue,
      total_purchase_cost: 0,
      gross_margin: totalCustomerValue,
    })
    .select("id,order_number")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not create order" }, { status: 500, headers });
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
      notes: [item.brand, item.mode, item.notes].filter(Boolean).join(" · ") || null,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Could not create order items" }, { status: 500, headers });
  }

  const changeDeadlineAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const customerConfirmationText = [
    "THANK YOU FOR YOUR ORDER",
    "",
    `Order No.: ${order.order_number || orderNumber}`,
    `Company: ${companyName || "not provided"}`,
    `Contact: ${contactName || "not provided"}`,
    `Items: ${parsed.data.items.length}`,
    "",
    "If no notification is received at sales@securesmart.tech within 48 hours regarding any possible changes, the order will be passed to our logistics team for processing.",
    "",
    "Secure Smart",
  ].join("\n");

  const customerEmailResult = contactEmail
    ? await sendOpsEmail({
        to: contactEmail,
        replyTo: "sales@securesmart.tech",
        subject: `Secure Smart order confirmation · ${order.order_number || orderNumber}`,
        text: customerConfirmationText,
        html: `
          <h1>THANK YOU FOR YOUR ORDER</h1>
          <p><strong>Order No.:</strong> ${escapeHtml(order.order_number || orderNumber)}</p>
          <p><strong>Company:</strong> ${escapeHtml(companyName || "not provided")}<br />
          <strong>Contact:</strong> ${escapeHtml(contactName || "not provided")}<br />
          <strong>Items:</strong> ${parsed.data.items.length}</p>
          <p>If no notification is received at <a href="mailto:sales@securesmart.tech">sales@securesmart.tech</a> within 48 hours regarding any possible changes, the order will be passed to our logistics team for processing.</p>
          <p>Secure Smart</p>
        `,
      })
    : { sent: false, provider: "not_configured" as const, error: "No customer email on order" };

  await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "website_order_confirmed_waiting_48h",
    metadata: {
      source: parsed.data.source,
      language: parsed.data.language,
      itemCount: parsed.data.items.length,
      company: companyName,
      contact: contactName,
      email: contactEmail,
      notes: parsed.data.notes,
      authenticatedCustomer: Boolean(customerContext),
      customerConfirmationTo: contactEmail || null,
      customerConfirmationQueued: customerEmailResult.sent,
      customerConfirmationProvider: customerEmailResult.provider,
      changeDeadlineAt,
      nextStatusAfterDeadline: "review",
      notificationTo: "sales@securesmart.tech",
    },
  });

  const emailResult = await sendOpsEmail({
    to: "sales@securesmart.tech",
    subject: `New Secure Smart website order · ${order.order_number || orderNumber}`,
    text: [
      "New Secure Smart website order received.",
      `Order No.: ${order.order_number || orderNumber}`,
      `Company: ${companyName || "not provided"}`,
      `Contact: ${contactName || "not provided"}`,
      `Email: ${contactEmail || "not provided"}`,
      `Customer login: ${customerContext ? "approved customer portal" : "public website form"}`,
      `Items: ${parsed.data.items.length}`,
      `Customer confirmation email: ${customerEmailResult.sent ? "queued" : `not sent (${customerEmailResult.error || "unknown reason"})`}`,
      `48h logistics release after: ${changeDeadlineAt}`,
      `Notes: ${parsed.data.notes || "not provided"}`,
      "",
      "Review this request in the Secure Smart Ops dashboard.",
    ].join("\n"),
  });

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    orderNumber: order.order_number || orderNumber,
    receivedItems: parsed.data.items.length,
    authenticatedCustomer: Boolean(customerContext),
    customerConfirmation: {
      to: contactEmail || null,
      queued: customerEmailResult.sent,
      provider: customerEmailResult.provider,
      reason: customerEmailResult.sent ? undefined : customerEmailResult.error,
    },
    operationRelease: {
      status: "waiting_48h",
      deadlineAt: changeDeadlineAt,
      nextStatus: "review",
    },
    notification: {
      to: "sales@securesmart.tech",
      queued: emailResult.sent,
      provider: emailResult.provider,
      reason: emailResult.sent ? undefined : emailResult.error,
    },
  }, { headers });
}
