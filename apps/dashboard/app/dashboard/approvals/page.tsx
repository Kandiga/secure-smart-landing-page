import { AppShell } from "@/components/AppShell";
import { getAdminProfile } from "@/lib/dashboard-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ApprovalButtons, TradeApplicationButtons } from "./ApprovalButtons";

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

type TradeApplicationRow = {
  id: string;
  company_id: string | null;
  customer_type: string | null;
  interests: string[];
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "needs_more_info";
  reviewed_at: string | null;
  created_at: string;
  companies: { name: string; country: string | null; registration_number: string | null; vat_number: string | null } | null;
};

function extractContact(notes: string | null) {
  const text = notes || "";
  const ceo = text.match(/CEO:\s*([^/\n]+)\s*\/\s*([^/\n\s]+@[^/\n\s]+)\s*\/\s*([^\n]+)/i);
  if (ceo) return { name: ceo[1].trim(), email: ceo[2].trim(), phone: ceo[3].trim() };
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "—";
  return { name: "—", email, phone: "—" };
}

function briefNotes(notes: string | null): string[] {
  if (!notes) return ["—"];
  const lines = notes.split("\n").filter((line) => /CEO:|Purchasing:|Payments:|Technical:|Business ID type|Employees|Bank transfer/.test(line)).slice(0, 7);
  return lines.length ? lines : ["—"];
}

const STAFF_ACCESS_EMAILS = new Set(
  (process.env.SECURE_SMART_STAFF_ACCESS_EMAILS || "secure.smart.org@gmail.com,geoff@ft-nc.net")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function isAllowedStaffEmail(email: string | null | undefined) {
  return STAFF_ACCESS_EMAILS.has(String(email || "").trim().toLowerCase());
}

export default async function ApprovalsPage() {
  const profile = await getAdminProfile();
  if (!profile) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const [{ data: applications, error: applicationsError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabase
      .from("trade_applications")
      .select("id,company_id,customer_type,interests,notes,status,reviewed_at,created_at,companies(name,country,registration_number,vat_number)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("profiles")
      .select("id,email,first_name,last_name,phone,role,account_status,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const applicationRows = (applications ?? []) as unknown as TradeApplicationRow[];
  const profileRows = (profiles ?? []) as ApprovalProfile[];
  const pendingCount = applicationRows.filter((row) => row.status === "pending" || row.status === "needs_more_info").length;

  return (
    <AppShell active="/dashboard/approvals" userLabel={`${profile.email} · ${profile.role}`}>
      <header className="topbar">
        <div>
          <div className="eyebrow">Admin workflow · Secure invite links</div>
          <h1>Customer Approvals and Access</h1>
        </div>
        <div className="approval-summary">{pendingCount} pending requests</div>
      </header>

      {applicationsError ? <div className="notice warning">Could not load Trade requests: {applicationsError.message}</div> : null}
      {profilesError ? <div className="notice warning">Could not load profiles: {profilesError.message}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Trade Account applications from the website</div>
            <div className="eyebrow">Approve creates a Customer user, connects it to the company, and generates a one-time password setup link</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Company</th><th>Contact</th><th>Request details</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {applicationRows.length ? applicationRows.map((row) => {
                const contact = extractContact(row.notes);
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.companies?.name || "—"}</strong><br />
                      <span className="muted">{row.companies?.country || "—"} · {row.companies?.registration_number || row.companies?.vat_number || "No number"}</span>
                    </td>
                    <td>{contact.name}<br /><span className="muted">{contact.email}</span><br /><span className="muted">{contact.phone}</span></td>
                    <td>{briefNotes(row.notes).map((line) => <div key={line} className="muted">{line}</div>)}</td>
                    <td>{row.status}<br /><span className="muted">{new Date(row.created_at).toLocaleDateString("en-US")}</span></td>
                    <td>{row.status === "pending" || row.status === "needs_more_info" ? <TradeApplicationButtons applicationId={row.id} /> : <span className="muted">Handled</span>}</td>
                  </tr>
                );
              }) : <tr><td colSpan={5}>No Trade requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><div className="panel-title">Existing users</div><div className="eyebrow">Exception management: approve, reject, or promote Admin access</div></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {profileRows.length ? profileRows.map((row) => (
                <tr key={row.id}>
                  <td>{[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td>{row.email}</td><td>{row.phone || "—"}</td><td>{row.account_status}</td><td>{row.role}</td>
                  <td><ApprovalButtons profileId={row.id} role={row.role} accountStatus={row.account_status} isAllowedStaff={isAllowedStaffEmail(row.email)} /></td>
                </tr>
              )) : <tr><td colSpan={6}>No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
