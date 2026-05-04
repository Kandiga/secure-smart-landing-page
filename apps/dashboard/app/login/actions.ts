"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuthState = { error?: string; success?: string };

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "צריך אימייל וסיסמה." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "הכניסה נכשלה. בדוק אימייל/סיסמה או אימות אימייל." };
  redirect("/dashboard");
}

export async function signUpTradeAccount(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!email || password.length < 8) return { error: "צריך אימייל וסיסמה באורך 8 תווים לפחות." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    phone: phone || undefined,
    options: { data: { first_name: firstName, last_name: lastName } },
  });
  if (error) return { error: "לא הצלחתי ליצור משתמש. ייתכן שהאימייל כבר קיים או שהסיסמה חלשה מדי." };
  return { success: "נוצר משתמש. אם Supabase דורש אימות אימייל, בדוק מייל. החשבון יישאר Pending עד אישור Admin." };
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { error: "צריך אימייל לשליחת Magic Link." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:17630"}/dashboard` },
  });
  if (error) return { error: "לא הצלחתי לשלוח Magic Link כרגע." };
  return { success: "Magic Link נשלח אם האימייל קיים/מותר בפרויקט." };
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
