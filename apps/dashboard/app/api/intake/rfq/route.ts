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

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      company_id: customerContext?.companyId ?? null,
      customer_user_id: customerContext?.userId ?? null,
      project_name: projectName,
      source: parsed.data.source,
      status: "new",
      total_customer_value: totalCustomerValue,
      total_purchase_cost: 0,
      gross_margin: totalCustomerValue,
    })
    .select("id")
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

  await supabase.from("order_events").insert({
    order_id: order.id,
    event_type: "website_order_request_received",
    metadata: {
      source: parsed.data.source,
      language: parsed.data.language,
      itemCount: parsed.data.items.length,
      company: companyName,
      contact: contactName,
      email: contactEmail,
      notes: parsed.data.notes,
      authenticatedCustomer: Boolean(customerContext),
      notificationTo: "sales@securesmart.tech",
    },
  });

  const emailResult = await sendOpsEmail({
    to: "sales@securesmart.tech",
    subject: `New Secure Smart website order · ${parsed.data.company || parsed.data.email || order.id}`,
    text: [
      "New Secure Smart website order received.",
      `Order ID: ${order.id}`,
      `Company: ${companyName || "not provided"}`,
      `Contact: ${contactName || "not provided"}`,
      `Email: ${contactEmail || "not provided"}`,
      `Customer login: ${customerContext ? "approved customer portal" : "public website form"}`,
      `Items: ${parsed.data.items.length}`,
      `Notes: ${parsed.data.notes || "not provided"}`,
      "",
      "Review this request in the Secure Smart Ops dashboard.",
    ].join("\n"),
  });

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    receivedItems: parsed.data.items.length,
    authenticatedCustomer: Boolean(customerContext),
    notification: {
      to: "sales@securesmart.tech",
      queued: emailResult.sent,
      provider: emailResult.provider,
      reason: emailResult.sent ? undefined : emailResult.error,
    },
  }, { headers });
}
