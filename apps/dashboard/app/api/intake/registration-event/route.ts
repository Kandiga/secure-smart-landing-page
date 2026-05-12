import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOpsEmail } from "@/lib/email-notifications";

const allowedOrigins = new Set([
  "https://securesmart.tech",
  "https://www.securesmart.tech",
  "https://crm.securesmart.tech",
]);

const allowedEvents = new Set([
  "page_loaded",
  "form_started",
  "submit_clicked",
  "submit_attempt",
  "validation_failed",
  "submit_success",
  "submit_failed",
]);

const alertEvents = new Set(["validation_failed", "submit_failed"]);
const MAX_TEXT = 220;

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://securesmart.tech",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function cleanText(value: unknown, max = MAX_TEXT) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanStringArray(value: unknown, maxItems = 20) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, maxItems) as string[];
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400, headers });
  }

  const event = cleanText(body?.event, 60) || "";
  if (!allowedEvents.has(event)) {
    return NextResponse.json({ error: "Unsupported event" }, { status: 400, headers });
  }

  const form = (body?.form && typeof body.form === "object" ? body.form : {}) as Record<string, unknown>;
  const error = (body?.error && typeof body.error === "object" ? body.error : {}) as Record<string, unknown>;
  const context = (body?.context && typeof body.context === "object" ? body.context : {}) as Record<string, unknown>;

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503, headers });
  }

  const metadata = {
    source: "Website",
    division: "Israel",
    formName: "trade-access",
    event,
    visitorSessionId: cleanText(body?.visitorSessionId, 120),
    pageUrl: cleanText(body?.pageUrl, 500),
    referrer: cleanText(body?.referrer, 500),
    language: cleanText(body?.language, 12),
    userAgent: cleanText(request.headers.get("user-agent"), 500),
    ipCountry: cleanText(request.headers.get("x-vercel-ip-country"), 80),
    ipCity: cleanText(request.headers.get("x-vercel-ip-city"), 120),
    companyName: cleanText(form.businessName),
    applicantEmail: cleanText(form.applicantEmail, 160),
    applicantPhone: cleanText(form.applicantPhone, 80),
    invalidFields: cleanStringArray(error.invalidFields),
    errorMessage: cleanText(error.message, 300),
    httpStatus: typeof error.httpStatus === "number" ? error.httpStatus : null,
    browserOnline: typeof context.browserOnline === "boolean" ? context.browserOnline : null,
    elapsedMs: typeof context.elapsedMs === "number" ? Math.round(context.elapsedMs) : null,
  };

  let duplicateValidationEvent = false;
  if (event === "validation_failed" && metadata.visitorSessionId) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentAttempts } = await supabase
      .from("audit_logs")
      .select("id,metadata,created_at")
      .eq("action", "website_trade_registration_validation_failed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    duplicateValidationEvent = (recentAttempts || []).some((row: any) => {
      const other = row?.metadata || {};
      const otherFields = Array.isArray(other.invalidFields) ? other.invalidFields.join("|") : "";
      const fields = metadata.invalidFields.join("|");
      return other.visitorSessionId === metadata.visitorSessionId
        && other.companyName === metadata.companyName
        && other.applicantEmail === metadata.applicantEmail
        && otherFields === fields;
    });
  }

  if (duplicateValidationEvent) {
    return NextResponse.json({
      ok: true,
      event,
      audit: { recorded: false, duplicateSuppressed: true },
      alert: { queued: false, provider: "not_configured" },
    }, { status: 200, headers });
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    action: `website_trade_registration_${event}`,
    entity_type: "trade_registration_attempt",
    entity_id: null,
    metadata,
  });

  let alert: { sent: boolean; provider: "resend" | "not_configured"; id?: string; error?: string } = { sent: false, provider: "not_configured", error: undefined };
  if (!auditError && alertEvents.has(event)) {
    const subject = event === "validation_failed"
      ? "Secure Smart registration form validation failed"
      : "Secure Smart registration submit failed";
    const text = [
      subject,
      "",
      `Event: ${event}`,
      `Company: ${metadata.companyName || "not provided"}`,
      `Applicant email: ${metadata.applicantEmail || "not provided"}`,
      `Applicant phone: ${metadata.applicantPhone || "not provided"}`,
      `Page: ${metadata.pageUrl || "unknown"}`,
      `Invalid fields: ${metadata.invalidFields.length ? metadata.invalidFields.join(", ") : "none recorded"}`,
      `Error: ${metadata.errorMessage || "none recorded"}`,
      `HTTP status: ${metadata.httpStatus || "not recorded"}`,
      `Browser online: ${metadata.browserOnline === null ? "not recorded" : metadata.browserOnline}`,
      `Country/city: ${(metadata.ipCountry || "unknown")}/${(metadata.ipCity || "unknown")}`,
      "",
      "This is a registration-attempt tracking alert. Check CRM audit logs for the full attempt trail.",
    ].join("\n");
    alert = await sendOpsEmail({
      to: process.env.SECURE_SMART_REGISTRATION_ALERT_TO || "info@securesmart.tech",
      subject,
      text,
      replyTo: "info@securesmart.tech",
    }).catch((err) => ({ sent: false, provider: "resend" as const, error: err instanceof Error ? err.message : "Alert email failed" }));
  }

  return NextResponse.json({
    ok: !auditError,
    event,
    audit: { recorded: !auditError, reason: auditError?.message },
    alert: { queued: alert.sent, provider: alert.provider, reason: alert.error },
  }, { status: auditError ? 500 : 200, headers });
}
