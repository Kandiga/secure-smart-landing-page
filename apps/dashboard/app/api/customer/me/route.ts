import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const allowedOrigins = new Set([
  "https://securesmart.tech",
  "https://www.securesmart.tech",
  "https://crm.securesmart.tech",
]);

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://securesmart.tech",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Missing session" }, { status: 401, headers });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503, headers });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401, headers });

  const profileWithNumber = await supabase
    .from("profiles")
    .select("id,customer_number,email,phone,first_name,last_name,role,account_status")
    .eq("id", user.id)
    .single();
  const { data: profile } = profileWithNumber.error?.code === "42703"
    ? await supabase
        .from("profiles")
        .select("id,email,phone,first_name,last_name,role,account_status")
        .eq("id", user.id)
        .single()
    : profileWithNumber;

  const membershipWithNumber = await supabase
    .from("company_members")
    .select("member_role, created_at, companies(id,account_number,name,country,registration_number,vat_number,is_vip,vip_label,vip_notes)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: membership } = membershipWithNumber.error?.code === "42703"
    ? await supabase
        .from("company_members")
        .select("member_role, created_at, companies(id,name,country,registration_number,vat_number)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : membershipWithNumber;

  const hasCustomerPortalAccess =
    profile?.account_status === "approved" &&
    (profile.role === "customer" || (["admin", "super_admin"].includes(profile.role) && Boolean(membership)));

  if (!profile || !hasCustomerPortalAccess) {
    return NextResponse.json({ error: "Customer account is not approved" }, { status: 403, headers });
  }

  const companyId = (membership?.companies as { id?: string } | null | undefined)?.id ?? null;
  let orderQuery = supabase
    .from("orders")
    .select("id,order_number,project_name,status,total_customer_value,customer_po_number,customer_visible_note,created_at,order_items(id,sku,product_title,order_quantity,customer_unit_price,customer_total,stock_status)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (companyId) {
    orderQuery = orderQuery.or(`customer_user_id.eq.${user.id},company_id.eq.${companyId}`);
  } else {
    orderQuery = orderQuery.eq("customer_user_id", user.id);
  }

  const { data: orders } = await orderQuery;

  return NextResponse.json({
    ok: true,
    profile,
    company: membership?.companies ?? null,
    memberRole: membership?.member_role ?? null,
    orders: orders ?? [],
  }, { headers });
}
