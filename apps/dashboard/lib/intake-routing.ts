export type IntakeKind = "general_contact" | "quote_request" | "support_request" | "trade_registration";

export type IntakeRoute = {
  kind: IntakeKind;
  division: "Israel";
  mailboxRoute: "info" | "sales" | "support";
  notificationTo: "info@securesmart.tech" | "sales@securesmart.tech" | "support@securesmart.tech";
  crmType: "General Inquiry" | "Quote Request" | "Support Ticket" | "Account Application";
};

export type TradeApplicationIntake = {
  route: IntakeRoute;
  profile: {
    email: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  company: {
    name: string;
    country: string | null;
    vatNumber: string | null;
    registrationNumber: string | null;
    billingAddress: Record<string, string | null>;
    shippingAddress: Record<string, string | null>;
  };
  application: {
    customerType: string;
    interests: string[];
    notes: string;
  };
  crm: {
    source: "Website";
    status: "Pending Review";
    division: "Israel";
    mailboxRoute: IntakeRoute["mailboxRoute"];
  };
  raw: Record<string, string>;
};

export type TradeApplicationDatabaseRows = {
  company: {
    name: string;
    country: string | null;
    vat_number: string | null;
    registration_number: string | null;
    billing_address: Record<string, string | null>;
    shipping_address: Record<string, string | null>;
  };
  application: {
    user_id: null;
    company_id: string | null;
    customer_type: string;
    interests: string[];
    notes: string;
    status: "pending";
    admin_notes: string;
  };
  audit: {
    action: "website_trade_application_received";
    entity_type: "trade_application";
    entity_id: string | null;
    metadata: {
      source: "Website";
      division: "Israel";
      mailboxRoute: IntakeRoute["mailboxRoute"];
      notificationTo: IntakeRoute["notificationTo"];
      crmType: IntakeRoute["crmType"];
      companyName: string;
      applicantEmail: string;
      applicantPhone: string | null;
    };
  };
};

export type IntakeEmailNotification = {
  to: IntakeRoute["notificationTo"];
  subject: string;
  text: string;
};

const ROUTES: Record<IntakeKind, IntakeRoute> = {
  general_contact: {
    kind: "general_contact",
    division: "Israel",
    mailboxRoute: "info",
    notificationTo: "info@securesmart.tech",
    crmType: "General Inquiry",
  },
  quote_request: {
    kind: "quote_request",
    division: "Israel",
    mailboxRoute: "sales",
    notificationTo: "sales@securesmart.tech",
    crmType: "Quote Request",
  },
  support_request: {
    kind: "support_request",
    division: "Israel",
    mailboxRoute: "support",
    notificationTo: "support@securesmart.tech",
    crmType: "Support Ticket",
  },
  trade_registration: {
    kind: "trade_registration",
    division: "Israel",
    mailboxRoute: "info",
    notificationTo: "info@securesmart.tech",
    crmType: "Account Application",
  },
};

function value(form: FormData, key: string): string {
  const raw = form.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function nullable(text: string): string | null {
  return text ? text : null;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function rawFormData(form: FormData) {
  const raw: Record<string, string> = {};
  for (const [key, entryValue] of form.entries()) {
    if (typeof entryValue === "string") raw[key] = entryValue.trim();
  }
  return raw;
}

export function getRouteForIntakeKind(kind: IntakeKind): IntakeRoute {
  return ROUTES[kind];
}

export function buildTradeApplicationIntake(form: FormData): TradeApplicationIntake {
  const route = getRouteForIntakeKind("trade_registration");
  const applicantName = value(form, "applicant_name") || value(form, "account_owner_name") || value(form, "contact_name");
  const { firstName, lastName } = splitName(applicantName);
  const email = value(form, "applicant_email") || value(form, "account_owner_email") || value(form, "contact_email");
  const phone = value(form, "applicant_phone") || value(form, "account_owner_phone") || value(form, "contact_phone");
  const creditRequested = value(form, "credit_terms_requested");
  const bankAck = value(form, "bank_transfer_only_acknowledged");
  const interests = ["B2B trade account"];
  if (creditRequested) interests.push("Current + 60 requested");

  return {
    route,
    profile: {
      email,
      phone: nullable(phone),
      firstName,
      lastName,
    },
    company: {
      name: value(form, "business_name"),
      country: "Israel",
      vatNumber: value(form, "business_id_type") === "Licensed dealer" ? nullable(value(form, "business_id_number")) : null,
      registrationNumber: value(form, "business_id_type") !== "Licensed dealer" ? nullable(value(form, "business_id_number")) : null,
      billingAddress: {
        invoice_address: nullable(value(form, "invoice_address") || value(form, "accounting_email")),
      },
      shippingAddress: {
        delivery_address: nullable(value(form, "shipping_addresses_hours") || value(form, "delivery_address")),
        delivery_hours: nullable(value(form, "delivery_hours")),
      },
    },
    application: {
      customerType: "Trade account registration",
      interests,
      notes: [
        `Division: ${route.division}`,
        `Mailbox route: ${route.mailboxRoute}`,
        `Business ID type: ${value(form, "business_id_type") || "not provided"}`,
        `Year established: ${value(form, "year_established") || "not provided"}`,
        `Employees: ${value(form, "employee_count") || "not provided"}`,
        `Account owner: ${applicantName || "not provided"} / ${email || "no email"} / ${phone || "no phone"}`,
        `CEO: ${value(form, "ceo_name") || "not provided"} / ${value(form, "ceo_email") || "no email"} / ${value(form, "ceo_phone") || "no phone"}`,
        `Purchasing: ${value(form, "purchasing_name") || "not provided"} / ${value(form, "purchasing_email") || "no email"} / ${value(form, "purchasing_phone") || "no phone"}`,
        `Payments: ${value(form, "payments_name") || "not provided"} / ${value(form, "payments_email") || "no email"} / ${value(form, "payments_phone") || "no phone"}`,
        `Technical: ${value(form, "technical_name") || "not provided"} / ${value(form, "technical_email") || "no email"} / ${value(form, "technical_phone") || "no phone"}`,
        `Delivery hours: ${value(form, "delivery_hours") || "not provided"}`,
        `Bank transfer acknowledged: ${bankAck || "no"}`,
      ].join("\n"),
    },
    crm: {
      source: "Website",
      status: "Pending Review",
      division: route.division,
      mailboxRoute: route.mailboxRoute,
    },
    raw: rawFormData(form),
  };
}

export function buildTradeApplicationDatabaseRows(
  intake: TradeApplicationIntake,
  ids: { companyId?: string | null; applicationId?: string | null } = {},
): TradeApplicationDatabaseRows {
  return {
    company: {
      name: intake.company.name,
      country: intake.company.country,
      vat_number: intake.company.vatNumber,
      registration_number: intake.company.registrationNumber,
      billing_address: intake.company.billingAddress,
      shipping_address: intake.company.shippingAddress,
    },
    application: {
      user_id: null,
      company_id: ids.companyId ?? null,
      customer_type: intake.application.customerType,
      interests: intake.application.interests,
      notes: intake.application.notes,
      status: "pending",
      admin_notes: `Website intake routed to ${intake.route.notificationTo}`,
    },
    audit: {
      action: "website_trade_application_received",
      entity_type: "trade_application",
      entity_id: ids.applicationId ?? null,
      metadata: {
        source: intake.crm.source,
        division: intake.crm.division,
        mailboxRoute: intake.crm.mailboxRoute,
        notificationTo: intake.route.notificationTo,
        crmType: intake.route.crmType,
        companyName: intake.company.name,
        applicantEmail: intake.profile.email,
        applicantPhone: intake.profile.phone,
      },
    },
  };
}

export function buildTradeApplicationEmailNotification(intake: TradeApplicationIntake): IntakeEmailNotification {
  return {
    to: intake.route.notificationTo,
    subject: `New Secure Smart trade application · ${intake.company.name || "Unnamed company"}`,
    text: [
      "New Secure Smart trade-account application received.",
      `Division: ${intake.crm.division}`,
      `CRM type: ${intake.route.crmType}`,
      `Mailbox route: ${intake.crm.mailboxRoute}`,
      `Company: ${intake.company.name || "not provided"}`,
      `Applicant email: ${intake.profile.email || "not provided"}`,
      `Applicant phone: ${intake.profile.phone || "not provided"}`,
      "",
      "Review this customer in the Secure Smart Ops dashboard before approval.",
    ].join("\n"),
  };
}
