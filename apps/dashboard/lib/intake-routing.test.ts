import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTradeApplicationDatabaseRows,
  buildTradeApplicationEmailNotification,
  buildTradeApplicationIntake,
  getRouteForIntakeKind,
} from "./intake-routing";

describe("Secure Smart intake routing", () => {
  it("routes trade registration to Israel/info with customer profile metadata", () => {
    const route = getRouteForIntakeKind("trade_registration");
    assert.equal(route.division, "Israel");
    assert.equal(route.mailboxRoute, "info");
    assert.equal(route.notificationTo, "info@securesmart.tech");
    assert.equal(route.crmType, "Account Application");
  });

  it("builds a normalized CRM payload from the existing registration form fields", () => {
    const form = new FormData();
    form.set("business_name", "ACME Networks Ltd");
    form.set("business_id_type", "Company registration number");
    form.set("business_id_number", "515151515");
    form.set("applicant_name", "Maya Applicant");
    form.set("applicant_email", "maya@example.com");
    form.set("applicant_phone", "+972509999999");
    form.set("ceo_name", "Dana Cohen");
    form.set("ceo_email", "dana@example.com");
    form.set("ceo_phone", "+972501111111");
    form.set("purchasing_name", "Rami Buyer");
    form.set("purchasing_email", "purchasing@example.com");
    form.set("shipping_addresses_hours", "Haifa warehouse, Sun-Thu 08:00-16:00");
    form.set("invoice_address", "Tel Aviv HQ");
    form.set("credit_terms_requested", "Current + 60");
    form.set("bank_transfer_only_acknowledged", "Accepted");

    const intake = buildTradeApplicationIntake(form);

    assert.equal(intake.route.division, "Israel");
    assert.equal(intake.route.mailboxRoute, "info");
    assert.equal(intake.profile.email, "maya@example.com");
    assert.equal(intake.profile.firstName, "Maya");
    assert.equal(intake.profile.lastName, "Applicant");
    assert.equal(intake.company.name, "ACME Networks Ltd");
    assert.equal(intake.company.registrationNumber, "515151515");
    assert.equal(intake.application.customerType, "Trade account registration");
    assert.deepEqual(intake.application.interests, ["B2B trade account", "Current + 60 requested"]);
    assert.equal(intake.crm.source, "Website");
    assert.equal(intake.crm.status, "Pending Review");
  });

  it("maps the existing registration form into Supabase rows and an info mailbox notification", () => {
    const form = new FormData();
    form.set("business_name", "ACME Networks Ltd");
    form.set("business_id_type", "Company registration number");
    form.set("business_id_number", "515151515");
    form.set("applicant_name", "Maya Applicant");
    form.set("applicant_email", "maya@example.com");
    form.set("applicant_phone", "+972509999999");
    form.set("ceo_name", "Dana Cohen");
    form.set("ceo_email", "dana@example.com");
    form.set("ceo_phone", "+972501111111");
    form.set("shipping_addresses_hours", "Haifa warehouse, Sun-Thu 08:00-16:00");
    form.set("invoice_address", "Tel Aviv HQ");

    const intake = buildTradeApplicationIntake(form);
    const rows = buildTradeApplicationDatabaseRows(intake, {
      companyId: "11111111-1111-4111-8111-111111111111",
      applicationId: "22222222-2222-4222-8222-222222222222",
    });
    const email = buildTradeApplicationEmailNotification(intake);

    assert.equal(rows.company.name, "ACME Networks Ltd");
    assert.equal(rows.application.company_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(rows.application.status, "pending");
    assert.equal(rows.audit.entity_id, "22222222-2222-4222-8222-222222222222");
    assert.equal(rows.audit.metadata.division, "Israel");
    assert.equal(rows.audit.metadata.mailboxRoute, "info");
    assert.equal(rows.audit.metadata.notificationTo, "info@securesmart.tech");
    assert.equal(email.to, "info@securesmart.tech");
    assert.match(email.subject, /ACME Networks Ltd/);
    assert.match(email.text, /Review this customer/);
  });
});
