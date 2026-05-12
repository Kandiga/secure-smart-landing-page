export const CUSTOMER_ACTIVITY_EVENTS = [
  "login_success",
  "login_failed",
  "logout",
  "password_setup_completed",
  "profile_password_changed",
  "password_reset_requested",
  "account_loaded",
] as const;

type CustomerActivityEvent = typeof CUSTOMER_ACTIVITY_EVENTS[number];

type RawPayload = Record<string, unknown>;

type RequestMeta = {
  userAgent?: string | null;
  ipCountry?: string | null;
  ipCity?: string | null;
};

type ProfileLike = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  account_status?: string | null;
} | null;

type CompanyLike = {
  id?: string | null;
  name?: string | null;
} | null;

export type NormalizedCustomerActivityPayload = {
  event: CustomerActivityEvent;
  customerEmail: string | null;
  pageUrl: string | null;
  referrer: string | null;
  language: string | null;
  context: Record<string, string | number | boolean | null>;
  errorMessage: string | null;
};

const ALLOWED = new Set<string>(CUSTOMER_ACTIVITY_EVENTS);
const SENSITIVE_CONTEXT_KEYS = new Set(["password", "new_password", "confirm_password", "access_token", "refresh_token", "code", "token", "inviteLink", "recoveryLink"]);

function cleanText(value: unknown, max = 220) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanEmail(value: unknown) {
  const text = cleanText(value, 180);
  return text ? text.toLowerCase() : null;
}

function cleanPageUrl(value: unknown) {
  const text = cleanText(value, 500);
  if (!text) return null;
  try {
    const url = new URL(text);
    url.hash = "";
    for (const key of ["access_token", "refresh_token", "code", "token"]) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return text.replace(/([?&#](?:access_token|refresh_token|code|token)=)[^&#]+/gi, "$1[redacted]").slice(0, 500);
  }
}

function cleanContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_CONTEXT_KEYS.has(key)) continue;
    if (typeof raw === "string") out[key] = raw.trim().slice(0, 220) || null;
    else if (typeof raw === "number" && Number.isFinite(raw)) out[key] = Math.round(raw);
    else if (typeof raw === "boolean") out[key] = raw;
    else if (raw === null) out[key] = null;
  }
  return out;
}

export function normalizeCustomerActivityPayload(raw: RawPayload): NormalizedCustomerActivityPayload {
  const event = cleanText(raw?.event, 80) || "";
  if (!ALLOWED.has(event)) throw new Error("Unsupported customer activity event");
  const error = raw?.error && typeof raw.error === "object" ? raw.error as Record<string, unknown> : {};
  return {
    event: event as CustomerActivityEvent,
    customerEmail: cleanEmail(raw?.customerEmail),
    pageUrl: cleanPageUrl(raw?.pageUrl),
    referrer: cleanPageUrl(raw?.referrer),
    language: cleanText(raw?.language, 12),
    context: cleanContext(raw?.context),
    errorMessage: cleanText(error.message, 300),
  };
}

export function eventLabel(event: CustomerActivityEvent) {
  return {
    login_success: "Customer login",
    login_failed: "Customer login failed",
    logout: "Customer logout",
    password_setup_completed: "Customer password setup completed",
    profile_password_changed: "Customer password changed",
    password_reset_requested: "Customer password reset requested",
    account_loaded: "Customer account loaded",
  }[event];
}

export function shouldEmailCustomerActivity(event: CustomerActivityEvent) {
  return event !== "account_loaded";
}

export function buildCustomerActivityAuditRow(
  payload: NormalizedCustomerActivityPayload,
  details: { userId?: string | null; profile?: ProfileLike; company?: CompanyLike; requestMeta?: RequestMeta } = {},
) {
  const customerEmail = details.profile?.email || payload.customerEmail;
  return {
    actor_user_id: details.userId || null,
    action: `customer_activity_${payload.event}`,
    entity_type: details.userId ? "customer_profile" : "customer_session",
    entity_id: details.userId || null,
    metadata: {
      source: "customer_portal",
      event: payload.event,
      eventLabel: eventLabel(payload.event),
      customer_email: customerEmail || null,
      profile_role: details.profile?.role || null,
      account_status: details.profile?.account_status || null,
      company_id: details.company?.id || null,
      company_name: details.company?.name || null,
      pageUrl: payload.pageUrl,
      referrer: payload.referrer,
      language: payload.language,
      context: payload.context,
      errorMessage: payload.errorMessage,
      userAgent: cleanText(details.requestMeta?.userAgent, 500),
      ipCountry: cleanText(details.requestMeta?.ipCountry, 80),
      ipCity: cleanText(details.requestMeta?.ipCity, 120),
    },
  };
}

export function buildCustomerActivityNotification(
  payload: NormalizedCustomerActivityPayload,
  details: { profile?: ProfileLike; company?: CompanyLike; requestMeta?: RequestMeta; to?: string | null } = {},
) {
  const label = eventLabel(payload.event);
  const email = details.profile?.email || payload.customerEmail || "unknown";
  const name = [details.profile?.first_name, details.profile?.last_name].filter(Boolean).join(" ") || "not recorded";
  const company = details.company?.name || "not connected / unknown";
  const text = [
    `Secure Smart customer activity: ${label}`,
    "",
    `Customer: ${name}`,
    `Email: ${email}`,
    `Company: ${company}`,
    `Page: ${payload.pageUrl || "unknown"}`,
    `Country/city: ${(details.requestMeta?.ipCountry || "unknown")}/${(details.requestMeta?.ipCity || "unknown")}`,
    payload.errorMessage ? `Error: ${payload.errorMessage}` : null,
    "",
    "This event was recorded in CRM audit logs for customer support tracking.",
  ].filter(Boolean).join("\n");

  return {
    to: details.to || process.env.SECURE_SMART_CUSTOMER_ACTIVITY_ALERT_TO || "secure.smart.org@gmail.com,geoff@ft-nc.net",
    subject: `Secure Smart - ${label}`,
    text,
    replyTo: "info@securesmart.tech",
  };
}
