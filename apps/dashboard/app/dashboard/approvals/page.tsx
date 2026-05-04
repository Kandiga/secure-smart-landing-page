import { AppShell } from "@/components/AppShell";
import { getCurrentProfile } from "@/lib/dashboard-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ApprovalButtons } from "./ApprovalButtons";

export const dynamic = "force-dynamic";

type ApprovalProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: "customer" | "admin" | "super_admin";
  account_status: "pending" | "approved" | "rejected" | "suspended";
  created_at: string;
};

export default async function ApprovalsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    return (
      <AppShell active="/dashboard/approvals" userLabel={`${profile.email} · ${profile.role}`}>
        <header className="topbar"><div><div className="eyebrow">Approvals</div><h1>אישורים</h1></div></header>
        <div className="notice warning">המסך הזה זמין רק ל־Admin. המשתמש שלך כרגע אינו Admin.</div>
      </AppShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,first_name,last_name,phone,role,account_status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as ApprovalProfile[];

  return (
    <AppShell active="/dashboard/approvals" userLabel={`${profile.email} · ${profile.role}`}>
      <header className="topbar"><div><div className="eyebrow">Admin workflow</div><h1>אישורי לקוחות והרשאות</h1></div></header>
      {error ? <div className="notice warning">לא ניתן לקרוא פרופילים: {error.message}</div> : null}
      <section className="panel">
        <div className="panel-header"><div><div className="panel-title">משתמשים</div><div className="eyebrow">אישור לקוחות Pending וקידום Admin</div></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>שם</th><th>אימייל</th><th>טלפון</th><th>סטטוס</th><th>תפקיד</th><th>פעולות</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td>{row.email}</td><td>{row.phone || "—"}</td><td>{row.account_status}</td><td>{row.role}</td>
                  <td><ApprovalButtons profileId={row.id} /></td>
                </tr>
              )) : <tr><td colSpan={6}>אין משתמשים עדיין. צור משתמש דרך /login ואז אפשר לקדם אותו ל־Admin.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
