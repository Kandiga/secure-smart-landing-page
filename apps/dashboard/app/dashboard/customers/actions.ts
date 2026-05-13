"use server";

import { getAdminProfile } from "@/lib/dashboard-data";
import { sendOpsEmail } from "@/lib/email-notifications";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CUSTOMER_PASSWORD_URL = "https://www.securesmart.tech/customer-login.html";
const CUSTOMER_NOTICE_COPY_TO = process.env.SECURE_SMART_CUSTOMER_NOTICE_BCC || "";

type ActionState = { error?: string; success?: string; inviteLink?: string; emailSent?: boolean; emailProvider?: string };

type ManualDeliveryMode = "setup_link" | "temporary_password";

async function assertSuperAdmin() {
  const profile = await getAdminProfile();
  if (!profile || profile.role !== "super_admin") throw new Error("Super admin access required.");
  return profile;
}

async function assertAdmin() {
  const profile = await getAdminProfile();
  if (!profile) throw new Error("Admin access required.");
  return profile;
}

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return clean(value).toLowerCase();
}

function randomTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createServiceClient>, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).find((user) => (user.email || "").toLowerCase() === email.toLowerCase()) || null;
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

export async function manualCustomerAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const supabase = createServiceClient();
    const email = normalizeEmail(formData.get("email"));
    const firstName = clean(formData.get("first_name"));
    const lastName = clean(formData.get("last_name"));
    const phone = clean(formData.get("phone"));
    const existingCompanyId = clean(formData.get("company_id"));
    const companyName = clean(formData.get("company_name"));
    const registrationNumber = clean(formData.get("registration_number"));
    const adminNote = clean(formData.get("admin_note"));
    const deliveryMode = clean(formData.get("delivery_mode")) as ManualDeliveryMode;

    if (!email || !email.includes("@")) return { error: "Enter a valid login email." };
    if (deliveryMode !== "setup_link" && deliveryMode !== "temporary_password") return { error: "Choose a valid delivery method." };
    if (!existingCompanyId && !companyName) return { error: "Choose an existing company or enter a company name." };

    let companyId = existingCompanyId;
    let resolvedCompanyName = companyName;
    if (companyId) {
      const { data: company, error: companyError } = await supabase.from("companies").select("id,name").eq("id", companyId).maybeSingle();
      if (companyError) return { error: companyError.message };
      if (!company) return { error: "Selected company was not found." };
      resolvedCompanyName = company.name;
    } else {
      const { data: company, error: insertCompanyError } = await supabase
        .from("companies")
        .insert({ name: companyName, registration_number: registrationNumber || null })
        .select("id,name")
        .single();
      if (insertCompanyError || !company) return { error: insertCompanyError?.message || "Could not create company." };
      companyId = company.id;
      resolvedCompanyName = company.name;
    }

    let user = await findAuthUserByEmail(supabase, email);
    const tempPassword = deliveryMode === "temporary_password" ? randomTemporaryPassword() : null;
    let createdUser = false;

    if (!user) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword || undefined,
        email_confirm: true,
        user_metadata: { first_name: firstName || null, last_name: lastName || null, source: "crm_manual_customer_access" },
      });
      if (createError || !created.user) return { error: createError?.message || "Could not create customer auth user." };
      user = created.user;
      createdUser = true;
    } else if (tempPassword) {
      const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(user.id, { password: tempPassword, email_confirm: true });
      if (updatePasswordError) return { error: updatePasswordError.message };
    }

    const { data: existingProfile, error: profileReadError } = await supabase.from("profiles").select("role,email").eq("id", user.id).maybeSingle();
    if (profileReadError) return { error: profileReadError.message };
    if (["admin", "super_admin"].includes(String(existingProfile?.role || ""))) return { error: "This email belongs to a protected staff/admin user. Manual customer access is blocked." };

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      email,
      phone: phone || null,
      first_name: firstName || null,
      last_name: lastName || null,
      role: "customer",
      account_status: "approved",
      email_verified: true,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { error: profileError.message };

    const { error: memberError } = await supabase.from("company_members").upsert({ company_id: companyId, user_id: user.id, member_role: "owner" });
    if (memberError) return { error: memberError.message };

    let inviteLink: string | undefined;
    let emailText = "";
    let emailHtml = "";
    const firstNameLabel = firstName || "there";

    if (deliveryMode === "setup_link") {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: CUSTOMER_PASSWORD_URL } });
      inviteLink = linkData?.properties?.action_link;
      if (linkError || !inviteLink) return { error: linkError?.message || "Could not generate password setup link." };
      emailText = [
        `Hello ${firstNameLabel},`,
        "",
        `Secure Smart has created or updated your customer access for ${resolvedCompanyName}.`,
        `Login email: ${email}`,
        "",
        "Please set your password here:",
        inviteLink,
        "",
        "If the email does not arrive, reply to Secure Smart and we will assist.",
        "",
        "Secure Smart",
      ].join("\n");
      emailHtml = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;padding:24px;color:#111827"><h2>Secure Smart customer access</h2><p>Hello ${htmlEscape(firstNameLabel)},</p><p>Secure Smart has created or updated your customer access for <strong>${htmlEscape(resolvedCompanyName)}</strong>.</p><p>Login email: <strong>${htmlEscape(email)}</strong></p><p><a href="${htmlEscape(inviteLink)}" style="display:inline-block;background:#0f766e;color:white;text-decoration:none;border-radius:10px;padding:13px 20px;font-weight:bold">Set your password</a></p><p style="color:#4b5563;font-size:14px">If this message does not arrive, reply to Secure Smart and we will assist.</p><hr><p style="color:#6b7280;font-size:13px">Secure Smart Team<br>www.securesmart.tech</p></div>`;
    } else {
      emailText = [
        `Hello ${firstNameLabel},`,
        "",
        `Secure Smart has created or updated your customer access for ${resolvedCompanyName}.`,
        `Login email: ${email}`,
        `Temporary password: ${tempPassword}`,
        "",
        "Please sign in and change this password immediately:",
        CUSTOMER_PASSWORD_URL,
        "",
        "Secure Smart",
      ].join("\n");
      emailHtml = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;padding:24px;color:#111827"><h2>Secure Smart customer access</h2><p>Hello ${htmlEscape(firstNameLabel)},</p><p>Secure Smart has created or updated your customer access for <strong>${htmlEscape(resolvedCompanyName)}</strong>.</p><p>Login email: <strong>${htmlEscape(email)}</strong></p><p>Temporary password:</p><p style="font-family:Consolas,monospace;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;padding:12px">${htmlEscape(tempPassword || "")}</p><p>Please sign in and change this password immediately:</p><p><a href="${CUSTOMER_PASSWORD_URL}" style="color:#0f766e">${CUSTOMER_PASSWORD_URL}</a></p><hr><p style="color:#6b7280;font-size:13px">Secure Smart Team<br>www.securesmart.tech</p></div>`;
    }

    const emailResult = await sendOpsEmail({
      to: email,
      subject: deliveryMode === "setup_link" ? "Secure Smart customer access - set your password" : "Secure Smart customer access - temporary password",
      text: emailText,
      html: emailHtml,
      replyTo: "info@securesmart.tech",
      bcc: CUSTOMER_NOTICE_COPY_TO,
    });

    await supabase.from("audit_logs").insert({
      actor_user_id: admin.id,
      action: "manual_customer_access_created_or_resent",
      entity_type: "customer_profile",
      entity_id: user.id,
      metadata: {
        customer_email: email,
        company_id: companyId,
        company_name: resolvedCompanyName,
        delivery_mode: deliveryMode,
        auth_user_created_now: createdUser,
        invite_link_generated: deliveryMode === "setup_link",
        temporary_password_set: deliveryMode === "temporary_password",
        email_provider: emailResult.provider,
        email_sent: emailResult.sent,
        email_id_present: Boolean(emailResult.id),
        admin_note: adminNote || null,
      },
    });

    revalidatePath("/dashboard/customers");
    revalidatePath("/dashboard/approvals");
    return {
      success: emailResult.sent
        ? `Customer access sent to ${email}.`
        : `Customer access was prepared for ${email}, but email delivery failed/configuration is missing.`,
      inviteLink: !emailResult.sent && deliveryMode === "setup_link" ? inviteLink : undefined,
      emailSent: emailResult.sent,
      emailProvider: emailResult.provider,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Manual customer access failed." };
  }
}

export async function deleteCustomerCompany(formData: FormData) {
  const profile = await assertSuperAdmin();
  const supabase = createServiceClient();
  const companyId = String(formData.get("company_id") || "");
  const companyName = String(formData.get("company_name") || "");
  const confirm = String(formData.get("confirm_delete") || "").trim();
  const includeOrders = formData.get("include_orders") === "yes";
  if (!companyId) throw new Error("Missing company id.");
  if (confirm !== companyName) throw new Error("Type the exact company name before deleting.");

  const [{ data: members, error: membersError }, { data: orders, error: ordersError }, { data: company, error: companyError }] = await Promise.all([
    supabase.from("company_members").select("user_id,profiles(role,email)").eq("company_id", companyId),
    supabase.from("orders").select("id").eq("company_id", companyId),
    supabase.from("companies").select("id,name").eq("id", companyId).maybeSingle(),
  ]);
  if (membersError) throw new Error(membersError.message);
  if (ordersError) throw new Error(ordersError.message);
  if (companyError) throw new Error(companyError.message);
  if (!company) throw new Error("Company not found.");

  const hasStaff = (members ?? []).some((member: any) => member.profiles?.role === "admin" || member.profiles?.role === "super_admin");
  if (hasStaff) throw new Error("This company is linked to an admin/staff profile and cannot be deleted from this control.");
  if ((orders ?? []).length && !includeOrders) throw new Error("This customer has orders. Tick the order deletion box if this is a test customer that should be fully removed.");

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    action: "delete_customer_company_requested",
    entity_type: "company",
    entity_id: companyId,
    metadata: { company_name: company.name, order_count: (orders ?? []).length, member_count: (members ?? []).length, include_orders: includeOrders },
  });

  if (includeOrders && (orders ?? []).length) {
    await supabase.from("orders").delete().eq("company_id", companyId);
  }
  await supabase.from("trade_applications").delete().eq("company_id", companyId);
  await supabase.from("company_members").delete().eq("company_id", companyId);
  const { error: deleteCompanyError } = await supabase.from("companies").delete().eq("id", companyId);
  if (deleteCompanyError) throw new Error(deleteCompanyError.message);

  for (const member of members ?? []) {
    const userId = (member as any).user_id;
    if (userId) {
      await supabase.from("profiles").delete().eq("id", userId).eq("role", "customer");
      await supabase.auth.admin.deleteUser(userId).catch(() => null);
    }
  }

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    action: "delete_customer_company_completed",
    entity_type: "company",
    entity_id: companyId,
    metadata: { company_name: company.name, include_orders: includeOrders },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/orders");
}
export async function updateCustomerVip(formData: FormData) {
  const profile = await assertAdmin();
  const supabase = createServiceClient();
  const companyId = String(formData.get("company_id") || "");
  if (!companyId) throw new Error("Missing company id.");
  const isVip = formData.get("is_vip") === "yes";
  const vipLabel = clean(formData.get("vip_label")) || "VIP";
  const vipNotes = clean(formData.get("vip_notes")) || null;

  const { error } = await supabase
    .from("companies")
    .update({ is_vip: isVip, vip_label: vipLabel, vip_notes: vipNotes, updated_at: new Date().toISOString() })
    .eq("id", companyId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    action: "update_customer_vip_status",
    entity_type: "company",
    entity_id: companyId,
    metadata: { is_vip: isVip, vip_label: vipLabel, vip_notes_present: Boolean(vipNotes) },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/orders");
}

