"use client";

import { useActionState } from "react";
import { manualCustomerAccess } from "./actions";

const initial = {} as { error?: string; success?: string; inviteLink?: string; emailSent?: boolean; emailProvider?: string };

type CompanyOption = { id: string; name: string; account_number: string | null };

function State({ state }: { state: typeof initial }) {
  if (state.error) return <div className="inline-status error">{state.error}</div>;
  if (!state.success) return null;
  return (
    <div className="inline-status success">
      {state.success}
      {state.inviteLink ? (
        <span className="invite-link-box">
          <input readOnly value={state.inviteLink} aria-label="Manual fallback setup link" />
        </span>
      ) : null}
    </div>
  );
}

export function ManualCustomerAccessForm({ companies }: { companies: CompanyOption[] }) {
  const [state, action, pending] = useActionState(manualCustomerAccess, initial);

  return (
    <form action={action} className="manual-access-form">
      <div className="form-grid two">
        <label>
          <span>Login email *</span>
          <input name="email" type="email" required placeholder="customer@example.com" autoComplete="email" />
        </label>
        <label>
          <span>Delivery method *</span>
          <select name="delivery_mode" defaultValue="setup_link" required>
            <option value="setup_link">Send password setup link</option>
            <option value="temporary_password">Send temporary password</option>
          </select>
        </label>
        <label>
          <span>First name</span>
          <input name="first_name" placeholder="First name" autoComplete="given-name" />
        </label>
        <label>
          <span>Last name</span>
          <input name="last_name" placeholder="Last name" autoComplete="family-name" />
        </label>
        <label>
          <span>Phone</span>
          <input name="phone" placeholder="+972..." autoComplete="tel" />
        </label>
        <label>
          <span>Existing company</span>
          <select name="company_id" defaultValue="">
            <option value="">Create / use company name below</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}{company.account_number ? ` · ${company.account_number}` : ""}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Company name</span>
          <input name="company_name" placeholder="Company name, required if no existing company selected" />
        </label>
        <label>
          <span>Business ID / registration no.</span>
          <input name="registration_number" placeholder="Optional" />
        </label>
      </div>
      <label>
        <span>Admin note</span>
        <textarea name="admin_note" rows={3} placeholder="Why this account was created or resent manually" />
      </label>
      <div className="manual-access-footer">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Sending..." : "Create / update customer and send access"}</button>
        <p className="muted">Admin-only. Creates or updates a customer profile, links it to a company, sends access, and writes an audit log.</p>
      </div>
      <State state={state} />
    </form>
  );
}
