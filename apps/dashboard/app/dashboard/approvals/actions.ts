"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ActionState = { error?: string; success?: string };

function service() {
  try {
    return createServiceClient();
  } catch {
    throw new Error("Service role is not configured");
  }
}

export async function approveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("profileId") || "");
  if (!id) return { error: "Missing profile id." };
  const supabase = service();
  const { error } = await supabase
    .from("profiles")
    .update({ account_status: "approved" })
    .eq("id", id);
  if (error) return { error: "Could not approve profile." };
  await supabase.from("audit_logs").insert({ action: "approve_profile", entity_type: "profile", entity_id: id, metadata: {} });
  revalidatePath("/dashboard/approvals");
  return { success: "המשתמש אושר." };
}

export async function rejectProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("profileId") || "");
  if (!id) return { error: "Missing profile id." };
  const supabase = service();
  const { error } = await supabase
    .from("profiles")
    .update({ account_status: "rejected" })
    .eq("id", id);
  if (error) return { error: "Could not reject profile." };
  await supabase.from("audit_logs").insert({ action: "reject_profile", entity_type: "profile", entity_id: id, metadata: {} });
  revalidatePath("/dashboard/approvals");
  return { success: "המשתמש נדחה." };
}

export async function promoteProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("profileId") || "");
  const role = String(formData.get("role") || "admin");
  if (!id || !["admin", "super_admin", "customer"].includes(role)) return { error: "Missing profile id or invalid role." };
  const supabase = service();
  const { error } = await supabase
    .from("profiles")
    .update({ role, account_status: role === "customer" ? "pending" : "approved" })
    .eq("id", id);
  if (error) return { error: "Could not update role." };
  await supabase.from("audit_logs").insert({ action: "update_profile_role", entity_type: "profile", entity_id: id, metadata: { role } });
  revalidatePath("/dashboard/approvals");
  return { success: "התפקיד עודכן." };
}
