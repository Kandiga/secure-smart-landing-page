import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOpsEmail } from "@/lib/email-notifications";
import {
  buildCustomerActivityAuditRow,
  buildCustomerActivityNotification,
  normalizeCustomerActivityPayload,
  shouldEmailCustomerActivity,
} from "@/lib/customer-activity";

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

async function getProfileAndCompany(supabase: ReturnType<typeof createServiceClient>, userId: string | null, email: string | null) {
  let profile: any = null;
  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,first_name,last_name,role,account_status")
      .eq("id", userId)
      .maybeSingle();
    profile = data;
  }
  if (!profile && email) {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,first_name,last_name,role,account_status")
      .ilike("email", email)
      .maybeSingle();
    profile = data;
  }

  let company: any = null;
  const profileId = profile?.id || userId;
  if (profileId) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("companies(id,name)")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    company = membership?.companies || null;
  }
  return { profile, company };
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  let payload;
  try {
    const body = await request.json();
    payload = normalizeCustomerActivityPayload(body && typeof body === "object" ? body : {});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid customer activity payload" }, { status: 400, headers });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503, headers });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  let userId: string | null = null;
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data?.user?.id || null;
  }

  const { profile, company } = await getProfileAndCompany(supabase, userId, payload.customerEmail);
  const auditRow = buildCustomerActivityAuditRow(payload, {
    userId: userId || profile?.id || null,
    profile,
    company,
    requestMeta: {
      userAgent: request.headers.get("user-agent"),
      ipCountry: request.headers.get("x-vercel-ip-country"),
      ipCity: request.headers.get("x-vercel-ip-city"),
    },
  });

  const { error: auditError } = await supabase.from("audit_logs").insert(auditRow);
  let alert: { sent: boolean; provider: "resend" | "not_configured"; id?: string; error?: string } = { sent: false, provider: "not_configured" };
  if (!auditError && shouldEmailCustomerActivity(payload.event)) {
    const notification = buildCustomerActivityNotification(payload, {
      profile,
      company,
      requestMeta: {
        ipCountry: request.headers.get("x-vercel-ip-country"),
        ipCity: request.headers.get("x-vercel-ip-city"),
      },
    });
    alert = await sendOpsEmail(notification).catch((err) => ({ sent: false, provider: "resend" as const, error: err instanceof Error ? err.message : "Customer activity alert failed" }));
  }

  return NextResponse.json({
    ok: !auditError,
    audit: { recorded: !auditError, reason: auditError?.message },
    alert: { queued: alert.sent, provider: alert.provider, reason: alert.error },
  }, { status: auditError ? 500 : 200, headers });
}
