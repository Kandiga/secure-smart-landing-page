"use server";

import { sendOpsEmail } from "@/lib/email-notifications";
import { getAdminProfile } from "@/lib/dashboard-data";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CUSTOMER_PASSWORD_URL = "https://www.securesmart.tech/customer-login.html";
const CUSTOMER_NOTICE_COPY_TO = process.env.SECURE_SMART_CUSTOMER_NOTICE_BCC || "";

type ActionState = { error?: string; success?: string; inviteLink?: string; emailSent?: boolean; emailProvider?: string };

function service() {
  try {
    return createServiceClient();
  } catch {
    throw new Error("Service role is not configured");
  }
}

async function requireAdmin() {
  const profile = await getAdminProfile();
  if (!profile) throw new Error("Admin session required");
  return profile;
}

const STAFF_ACCESS_EMAILS = new Set(
  (process.env.SECURE_SMART_STAFF_ACCESS_EMAILS || "secure.smart.org@gmail.com,geoff@ft-nc.net")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

async function getTargetProfile(supabase: ReturnType<typeof createServiceClient>, id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,account_status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function isStaffRole(role: unknown) {
  return ["admin", "super_admin"].includes(String(role || ""));
}

function isAllowedStaffEmail(email: unknown) {
  return STAFF_ACCESS_EMAILS.has(String(email || "").trim().toLowerCase());
}

function canModifyProfile(adminProfile: { id: string; role?: string | null }, targetProfile: { id: string; email?: string | null; role?: string | null } | null, nextRole?: string) {
  if (!targetProfile) return { ok: false, error: "Could not find the target profile." };
  if (targetProfile.id === adminProfile.id && (nextRole === "customer" || nextRole === "rejected")) {
    return { ok: false, error: "You cannot demote or reject your own admin profile." };
  }
  if (isStaffRole(targetProfile.role) && adminProfile.role !== "super_admin") {
    return { ok: false, error: "Only a super admin can change another staff profile." };
  }
  if (isStaffRole(nextRole)) {
    if (adminProfile.role !== "super_admin") {
      return { ok: false, error: "Only a super admin can grant admin access." };
    }
    if (!isAllowedStaffEmail(targetProfile.email)) {
      return { ok: false, error: "Admin access is restricted to the approved Secure Smart staff emails only." };
    }
  }
  return { ok: true };
}

function extractContact(notes: string | null | undefined) {
  const text = notes || "";
  const accountOwner = text.match(/Account owner:\s*([^/\n]+)\s*\/\s*([^/\n\s]+@[^/\n\s]+)\s*\/\s*([^\n]+)/i);
  if (accountOwner) {
    const fullName = accountOwner[1].trim();
    const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
    return { email: accountOwner[2].trim().toLowerCase(), firstName: firstName || null, lastName: rest.join(" ") || null, phone: accountOwner[3].trim() || null };
  }
  return { email: "", firstName: null, lastName: null, phone: null };
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createServiceClient>, email: string) {
  // Supabase Admin API has no direct getUserByEmail in all client versions; list and filter safely.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).find((user) => (user.email || "").toLowerCase() === email.toLowerCase()) || null;
}

export async function approveTradeApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = String(formData.get("applicationId") || "");
  if (!applicationId) return { error: "Missing application id." };

  try {
    const adminProfile = await requireAdmin();
    const supabase = service();

    const { data: application, error: appError } = await supabase
      .from("trade_applications")
      .select("id,company_id,notes,status,companies(id,name)")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !application) return { error: "Could not find the customer request." };
    const contact = extractContact((application as any).notes);
    if (!contact.email) return { error: "No account-owner email was found in the request. Ask the customer to submit the form with the Account owner / login details email, then approve again." };

    let user = await findAuthUserByEmail(supabase, contact.email);
    if (!user) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: contact.email,
        email_confirm: true,
        user_metadata: { first_name: contact.firstName, last_name: contact.lastName, source: "crm_trade_approval" },
      });
      if (createError || !created.user) return { error: "Could not create the customer user." };
      user = created.user;
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isExistingStaffUser = ["admin", "super_admin"].includes(String(existingProfile?.role || ""));

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email: contact.email,
      phone: contact.phone,
      first_name: contact.firstName,
      last_name: contact.lastName,
      role: isExistingStaffUser ? existingProfile?.role : "customer",
      account_status: "approved",
      email_verified: true,
      must_change_password: isExistingStaffUser ? false : true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { error: "User was created, but the customer profile could not be updated." };

    const companyId = (application as any).company_id as string | null;
    if (companyId) {
      const { error: memberError } = await supabase.from("company_members").upsert({
        company_id: companyId,
        user_id: user.id,
        member_role: "owner",
      });
      if (memberError) return { error: "User was created, but could not be connected to the company." };
    }

    const now = new Date().toISOString();
    const { error: updateAppError } = await supabase
      .from("trade_applications")
      .update({ status: "approved", reviewed_by: adminProfile.id, reviewed_at: now })
      .eq("id", applicationId);
    if (updateAppError) return { error: "The user was created, but the request status was not updated." };

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: contact.email,
      options: { redirectTo: CUSTOMER_PASSWORD_URL },
    });
    const inviteLink = linkData?.properties?.action_link;
    if (linkError || !inviteLink) return { error: "The customer was approved, but a password setup link could not be created." };

    const companyName = (application as any).companies?.name || "Secure Smart trade account";
    const firstName = contact.firstName || "there";
    const emailText = [
      `Hello ${firstName},`,
      "",
      "Welcome to Secure Smart. Your trade account has been approved.",
      "Please choose a secure password to enter your customer account.",
      "",
      "Set your password here:",
      inviteLink,
      "",
      "For security, this is a one-time link. If it expires, ask Secure Smart for a new setup email.",
      "",
      "Secure Smart",
      "B2B trade catalogue and procurement support",
    ].join("\n");

    const emailHtml = `
      <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;color:#0f2433;">
        <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
          <div style="background:#ffffff;border:1px solid #d9e5ee;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(15,36,51,.10);">
            <div style="padding:26px 30px;background:#071b2a;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#65d7d0;font-weight:700;">Secure Smart</div>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;font-weight:800;">Your trade account is approved</h1>
            </div>
            <div style="padding:30px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hello ${firstName},</p>
              <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Welcome to Secure Smart. Your trade account has been approved and your customer access is ready.</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Please choose a secure password to enter your customer account.</p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${inviteLink}" style="display:inline-block;background:#00a99d;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:15px 26px;border-radius:10px;">Set my password</a>
              </div>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#5e7280;">For security, this is a one-time password setup link. If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#395466;">${inviteLink}</p>
              <div style="border-top:1px solid #e5edf3;padding-top:18px;font-size:14px;line-height:1.6;color:#486272;">
                Need help? Reply to this email and the Secure Smart team will assist you.
              </div>
            </div>
          </div>
          <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#758896;">Secure Smart · B2B trade catalogue and procurement support</p>
        </div>
      </div>
    `;

    const emailResult = await sendOpsEmail({
      to: contact.email,
      subject: "Welcome to Secure Smart - set your password",
      text: emailText,
      html: emailHtml,
      replyTo: "info@securesmart.tech",
      bcc: CUSTOMER_NOTICE_COPY_TO,
    });

    await supabase.from("audit_logs").insert({
      actor_user_id: adminProfile.id,
      action: "approve_trade_application_create_customer_invite",
      entity_type: "trade_application",
      entity_id: applicationId,
      metadata: {
        customer_user_id: user.id,
        company_id: companyId,
        company_name: companyName,
        customer_email: contact.email,
        invite_link_generated: true,
        email_provider: emailResult.provider,
        email_sent: emailResult.sent,
        email_id_present: Boolean(emailResult.id),
      },
    });

    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/customers");
    return {
      success: emailResult.sent
        ? "Customer approved and password setup email sent."
        : "Customer approved and a password setup link was created. Email delivery is not configured, so copy the link manually.",
      inviteLink: emailResult.sent ? undefined : inviteLink,
      emailSent: emailResult.sent,
      emailProvider: emailResult.provider,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Approval failed." };
  }
}

export async function rejectTradeApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const applicationId = String(formData.get("applicationId") || "");
  if (!applicationId) return { error: "Missing application id." };
  try {
    const adminProfile = await requireAdmin();
    const supabase = service();
    const { data: application, error: appError } = await supabase
      .from("trade_applications")
      .select("id,company_id,notes,companies(id,name)")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !application) return { error: "Could not find the customer request." };

    const contact = extractContact((application as any).notes);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("trade_applications")
      .update({ status: "rejected", reviewed_by: adminProfile.id, reviewed_at: now })
      .eq("id", applicationId);
    if (error) return { error: "Could not reject application." };

    let emailResult: { sent: boolean; provider: "resend" | "not_configured"; id?: string; error?: string } = { sent: false, provider: "not_configured", error: "No account-owner email was found in the request" };
    if (contact.email) {
      const firstName = contact.firstName || "there";
      const companyName = (application as any).companies?.name || "your company";
      const emailText = [
        `Hello ${firstName},`,
        "",
        `Thank you for applying for a Secure Smart trade account for ${companyName}.`,
        "After review, we are unable to approve this trade account request at this time.",
        "",
        "If you believe this was a mistake or you can provide updated company details, please reply to this email and the Secure Smart team will review it again.",
        "",
        "Secure Smart",
        "B2B trade catalogue and procurement support",
      ].join("\n");
      const emailHtml = `
        <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;color:#0f2433;">
          <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
            <div style="background:#ffffff;border:1px solid #d9e5ee;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(15,36,51,.10);">
              <div style="padding:26px 30px;background:#071b2a;color:#ffffff;">
                <div style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#65d7d0;font-weight:700;">Secure Smart</div>
                <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;font-weight:800;">Trade account request update</h1>
              </div>
              <div style="padding:30px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hello ${firstName},</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Thank you for applying for a Secure Smart trade account for <strong>${companyName}</strong>.</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">After review, we are unable to approve this trade account request at this time.</p>
                <p style="margin:0;font-size:16px;line-height:1.6;">If you believe this was a mistake or you can provide updated company details, please reply to this email and the Secure Smart team will review it again.</p>
              </div>
            </div>
            <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#758896;">Secure Smart · B2B trade catalogue and procurement support</p>
          </div>
        </div>
      `;
      emailResult = await sendOpsEmail({
        to: contact.email,
        subject: "Secure Smart trade account request update",
        text: emailText,
        html: emailHtml,
        replyTo: "info@securesmart.tech",
        bcc: CUSTOMER_NOTICE_COPY_TO,
      });
    }

    await supabase.from("audit_logs").insert({
      actor_user_id: adminProfile.id,
      action: "reject_trade_application",
      entity_type: "trade_application",
      entity_id: applicationId,
      metadata: {
        company_id: (application as any).company_id,
        company_name: (application as any).companies?.name,
        customer_email: contact.email || null,
        customer_notice_bcc_configured: Boolean(CUSTOMER_NOTICE_COPY_TO),
        email_provider: emailResult.provider,
        email_sent: emailResult.sent,
        email_id_present: Boolean((emailResult as any).id),
      },
    });
    revalidatePath("/dashboard/approvals");
    return {
      success: contact.email
        ? emailResult.sent
          ? "Request rejected and customer notice email sent."
          : "Request rejected. Customer email delivery failed or is not configured."
        : "Request rejected. No customer email was found in the request.",
      emailSent: emailResult.sent,
      emailProvider: emailResult.provider,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Reject failed." };
  }
}

export async function approveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("profileId") || "");
  if (!id) return { error: "Missing profile id." };
  try {
    const adminProfile = await requireAdmin();
    const supabase = service();
    const targetProfile = await getTargetProfile(supabase, id);
    const guard = canModifyProfile(adminProfile, targetProfile, "approved");
    if (!guard.ok) return { error: guard.error };
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "approved" })
      .eq("id", id);
    if (error) return { error: "Could not approve profile." };
    await supabase.from("audit_logs").insert({ actor_user_id: adminProfile.id, action: "approve_profile", entity_type: "profile", entity_id: id, metadata: {} });
    revalidatePath("/dashboard/approvals");
    return { success: "User approved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Approve failed." };
  }
}

export async function rejectProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("profileId") || "");
  if (!id) return { error: "Missing profile id." };
  try {
    const adminProfile = await requireAdmin();
    const supabase = service();
    const targetProfile = await getTargetProfile(supabase, id);
    const guard = canModifyProfile(adminProfile, targetProfile, "rejected");
    if (!guard.ok) return { error: guard.error };
    const { error } = await supabase
      .from("profiles")
      .update({ account_status: "rejected" })
      .eq("id", id);
    if (error) return { error: "Could not reject profile." };
    await supabase.from("audit_logs").insert({ actor_user_id: adminProfile.id, action: "reject_profile", entity_type: "profile", entity_id: id, metadata: {} });
    revalidatePath("/dashboard/approvals");
    return { success: "User rejected." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Reject failed." };
  }
}

export async function promoteProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("profileId") || "");
  const role = String(formData.get("role") || "admin");
  if (!id || !["admin", "super_admin", "customer"].includes(role)) return { error: "Missing profile id or invalid role." };
  try {
    const adminProfile = await requireAdmin();
    const supabase = service();
    const targetProfile = await getTargetProfile(supabase, id);
    const guard = canModifyProfile(adminProfile, targetProfile, role);
    if (!guard.ok) return { error: guard.error };
    const { error } = await supabase
      .from("profiles")
      .update({ role, account_status: role === "customer" ? "pending" : "approved" })
      .eq("id", id);
    if (error) return { error: "Could not update role." };
    await supabase.from("audit_logs").insert({ actor_user_id: adminProfile.id, action: "update_profile_role", entity_type: "profile", entity_id: id, metadata: { role } });
    revalidatePath("/dashboard/approvals");
    return { success: "Role updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Role update failed." };
  }
}
