import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mockOrders, type OrderLine } from "@/lib/mock-orders";

export type ProfileSummary = {
  id: string;
  email: string;
  role: "customer" | "admin" | "super_admin";
  account_status: "pending" | "approved" | "rejected" | "suspended";
  first_name: string | null;
  last_name: string | null;
};

export type CustomerRow = {
  id: string;
  name: string;
  country: string | null;
  members: number;
  applications: number;
  created_at: string;
};

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function normalizeStock(value: unknown): OrderLine["stockStatus"] {
  if (value === "in_stock" || value === "partial" || value === "missing" || value === "needs_purchase") return value;
  return "needs_purchase";
}

export async function getCurrentProfile(): Promise<ProfileSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,email,role,account_status,first_name,last_name")
    .eq("id", user.id)
    .maybeSingle();
  return (data as ProfileSummary | null) ?? {
    id: user.id,
    email: user.email ?? "",
    role: "customer",
    account_status: "pending",
    first_name: null,
    last_name: null,
  };
}

export async function getOrderLines(): Promise<{ rows: OrderLine[]; isMock: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,order_number,project_name,status,total_customer_value,total_purchase_cost,gross_margin,margin_pct,profiles:assigned_to(first_name,last_name,email),companies(name),order_items(id,sku,product_title,order_quantity,customer_unit_price,customer_total,purchase_unit_price,purchase_total,margin,margin_pct,stock_status)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (ordersError) return { rows: mockOrders, isMock: true, error: ordersError.message };
  const source = (orders ?? []) as Array<Record<string, any>>;
  if (!source.length) return { rows: mockOrders, isMock: true };

  const rows: OrderLine[] = [];
  for (const order of source) {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of items) {
      const customerTotal = numberValue(item.customer_total);
      const purchaseTotal = numberValue(item.purchase_total);
      const margin = item.margin == null ? customerTotal - purchaseTotal : numberValue(item.margin);
      const marginPct = item.margin_pct == null ? (customerTotal ? (margin / customerTotal) * 100 : 0) : numberValue(item.margin_pct);
      const assigned = order.profiles;
      const ownerName = assigned?.first_name || assigned?.email || "נתנאל";
      rows.push({
        id: String(item.id),
        customer: order.companies?.name || "לקוח ללא חברה",
        project: order.project_name || order.order_number || "RFQ",
        sku: item.sku,
        product: item.product_title || item.sku,
        orderQty: numberValue(item.order_quantity),
        customerUnitPrice: numberValue(item.customer_unit_price),
        customerTotal,
        purchaseUnitPrice: numberValue(item.purchase_unit_price),
        purchaseTotal,
        margin,
        marginPct: Math.round(marginPct * 10) / 10,
        stockStatus: normalizeStock(item.stock_status),
        orderStatus: order.status === "approved" ? "approved" : order.status === "review" ? "review" : "new",
        owner: ownerName.includes("ג׳ף") ? "ג׳ף" : "נתנאל",
      });
    }
  }
  return { rows: rows.length ? rows : mockOrders, isMock: rows.length === 0 };
}

export async function getCustomers(): Promise<{ rows: CustomerRow[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id,name,country,created_at,company_members(user_id),trade_applications(id)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { rows: [], error: error.message };
  return {
    rows: ((data ?? []) as Array<Record<string, any>>).map((row) => ({
      id: row.id,
      name: row.name,
      country: row.country,
      created_at: row.created_at,
      members: Array.isArray(row.company_members) ? row.company_members.length : 0,
      applications: Array.isArray(row.trade_applications) ? row.trade_applications.length : 0,
    })),
  };
}
