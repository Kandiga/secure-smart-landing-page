import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOpsEmail } from "@/lib/email-notifications";
import {
  buildTradeApplicationDatabaseRows,
  buildTradeApplicationEmailNotification,
  buildTradeApplicationIntake,
} from "@/lib/intake-routing";

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
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function wantsHtmlRedirect(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("text/html") && contentType.includes("multipart/form-data");
}

function redirectToPublicThanks(request: NextRequest, status: "received" | "error") {
  const url = new URL("https://securesmart.tech/thanks.html");
  url.searchParams.set("registration", status);
  return NextResponse.redirect(url, { status: 303, headers: corsHeaders(request) });
}

function badRequest(request: NextRequest, message: string) {
  if (wantsHtmlRedirect(request)) return redirectToPublicThanks(request, "error");
  return NextResponse.json({ error: message }, { status: 400, headers: corsHeaders(request) });
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

function requiredValue(form: FormData, key: string) {
  const raw = form.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function missingTradeRegistrationFields(form: FormData) {
  const required = [
    ["business_name", "Business name"],
    ["business_id_number", "Business ID number"],
    ["applicant_name", "Account owner full name"],
    ["applicant_email", "Account owner email"],
    ["applicant_phone", "Account owner phone"],
  ] as const;
  return required.filter(([key]) => !requiredValue(form, key)).map(([, label]) => label);
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);
  const form = await request.formData().catch(() => null);
  if (!form) return badRequest(request, "Invalid form submission");

  const missingFields = missingTradeRegistrationFields(form);
  if (missingFields.length) {
    return badRequest(request, `Missing required fields: ${missingFields.join(", ")}`);
  }

  const intake = buildTradeApplicationIntake(form);
  if (!intake.company.name) return badRequest(request, "Business name is required");
  if (!intake.profile.email) return badRequest(request, "Applicant email is required");

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503, headers });
  }

  const initialRows = buildTradeApplicationDatabaseRows(intake);
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert(initialRows.company)
    .select("id")
    .single();

  if (companyError || !company) {
    if (wantsHtmlRedirect(request)) return redirectToPublicThanks(request, "error");
    return NextResponse.json({ error: "Could not create company record" }, { status: 500, headers });
  }

  const applicationRows = buildTradeApplicationDatabaseRows(intake, { companyId: company.id });
  const { data: application, error: applicationError } = await supabase
    .from("trade_applications")
    .insert(applicationRows.application)
    .select("id")
    .single();

  if (applicationError || !application) {
    await supabase.from("companies").delete().eq("id", company.id);
    if (wantsHtmlRedirect(request)) return redirectToPublicThanks(request, "error");
    return NextResponse.json({ error: "Could not create trade application" }, { status: 500, headers });
  }

  const finalRows = buildTradeApplicationDatabaseRows(intake, {
    companyId: company.id,
    applicationId: application.id,
  });
  const notification = buildTradeApplicationEmailNotification(intake);

  const auditResult = await supabase.from("audit_logs").insert(finalRows.audit);
  const emailResult = await sendOpsEmail(notification).catch((error) => ({
    sent: false,
    provider: "resend" as const,
    error: error instanceof Error ? error.message : "Notification failed",
  }));

  const responseBody = {
    ok: true,
    companyId: company.id,
    applicationId: application.id,
    route: intake.route,
    notification: {
      to: notification.to,
      subject: notification.subject,
      queued: emailResult.sent,
      provider: emailResult.provider,
      reason: emailResult.sent ? undefined : emailResult.error,
    },
    audit: {
      recorded: !auditResult.error,
      reason: auditResult.error?.message,
    },
  };

  if (wantsHtmlRedirect(request)) return redirectToPublicThanks(request, "received");

  return NextResponse.json(responseBody, { headers });
}
