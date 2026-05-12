import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerActivityAuditRow,
  buildCustomerActivityNotification,
  normalizeCustomerActivityPayload,
} from "./customer-activity";

describe("Secure Smart customer activity tracking", () => {
  it("normalizes allowed customer activity events and strips unsafe text", () => {
    const payload = normalizeCustomerActivityPayload({
      event: "password_setup_completed",
      pageUrl: "https://www.securesmart.tech/customer-login.html?code=secret-token",
      customerEmail: " Seth@Example.COM ",
      context: { source: "recovery", password: "should-not-keep", note: "x".repeat(400) },
    });

    assert.equal(payload.event, "password_setup_completed");
    assert.equal(payload.customerEmail, "seth@example.com");
    assert.equal(payload.pageUrl, "https://www.securesmart.tech/customer-login.html");
    assert.equal(payload.context.source, "recovery");
    assert.equal((payload.context as Record<string, unknown>).password, undefined);
    assert.equal(String(payload.context.note).length, 220);
  });

  it("rejects unsupported customer activity events", () => {
    assert.throws(() => normalizeCustomerActivityPayload({ event: "delete_everything" }), /Unsupported customer activity event/);
  });

  it("builds audit rows with no raw passwords or recovery links", () => {
    const payload = normalizeCustomerActivityPayload({
      event: "profile_password_changed",
      pageUrl: "https://www.securesmart.tech/customer-account.html#access_token=secret",
      customerEmail: "maya@example.com",
      context: { source: "profile" },
    });

    const row = buildCustomerActivityAuditRow(payload, {
      userId: "user-1",
      profile: { email: "maya@example.com", role: "customer", account_status: "approved" },
      company: { id: "company-1", name: "ACME" },
      requestMeta: { userAgent: "Test", ipCountry: "IL", ipCity: "Binyamina" },
    });

    assert.equal(row.action, "customer_activity_profile_password_changed");
    assert.equal(row.entity_type, "customer_profile");
    assert.equal(row.entity_id, "user-1");
    assert.equal(row.metadata.customer_email, "maya@example.com");
    assert.equal(row.metadata.pageUrl, "https://www.securesmart.tech/customer-account.html");
    assert.equal(row.metadata.company_name, "ACME");
    assert.deepEqual(Object.keys(row.metadata).includes("password"), false);
  });

  it("builds a concise notification for Netanel and Jeff on security events", () => {
    const payload = normalizeCustomerActivityPayload({
      event: "login_success",
      customerEmail: "buyer@example.com",
      pageUrl: "https://www.securesmart.tech/customer-login.html",
    });
    const notification = buildCustomerActivityNotification(payload, {
      profile: { email: "buyer@example.com", first_name: "Buyer", last_name: "One" },
      company: { name: "Buyer Co" },
      requestMeta: { ipCountry: "US", ipCity: "New York" },
      to: "secure.smart.org@gmail.com,geoff@ft-nc.net",
    });

    assert.equal(notification.to, "secure.smart.org@gmail.com,geoff@ft-nc.net");
    assert.match(notification.subject, /Customer login/);
    assert.match(notification.text, /Buyer Co/);
    assert.match(notification.text, /buyer@example.com/);
  });
});
