import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mockOrders, type OrderLine } from "@/lib/mock-orders";
import { DEFAULT_SUPPLIER_NAME, invoiceTotalForAvailable, purchaseTotalOrFormula, purchaseUnitOrFormula } from "@/lib/secure-smart-pricing";

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
  account_number: string | null;
  name: string;
  country: string | null;
  registration_number: string | null;
  isVip: boolean;
  vipLabel: string | null;
  vipNotes: string | null;
  members: number;
  memberLabels: string[];
  memberUserIds: string[];
  hasStaffMember: boolean;
  applications: number;
  orders: number;
  totalValue: number;
  latestOrderAt: string | null;
  created_at: string;
};

export type OrderRecord = {
  id: string;
  orderNumber: string | null;
  projectName: string | null;
  status: string;
  customer: string;
  companyId: string | null;
  customerEmail: string | null;
  customerPoNumber: string | null;
  customerVisibleNote: string | null;
  internalAdminNote: string | null;
  customerIsVip: boolean;
  customerVipLabel: string | null;
  totalCustomerValue: number;
  totalPurchaseCost: number;
  grossMargin: number;
  marginPct: number;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    sku: string;
    productTitle: string | null;
    orderQuantity: number;
    customerUnitPrice: number;
    customerTotal: number;
    purchaseUnitPrice: number;
    purchaseTotal: number;
    margin: number;
    marginPct: number;
    stockStatus: OrderLine["stockStatus"];
    notes: string | null;
  }>;
};

export type SettingsOverview = {
  env: Array<{ label: string; ready: boolean }>;
  counts: { customers: number; orders: number; pendingApplications: number; admins: number };
};

export type CustomerActivityRow = {
  id: string;
  action: string;
  eventLabel: string;
  customerEmail: string | null;
  companyName: string | null;
  pageUrl: string | null;
  createdAt: string;
  alert: string | null;
};

export type CockpitLine = OrderLine & {
  orderId: string;
  orderItemId: string;
  orderNumber: string | null;
  companyId: string | null;
  customerEmail: string | null;
  createdAt: string;
  purchaseCostKnown: boolean;
  supplierName: string | null;
  piNo: string | null;
  backorderUnits: number;
};

export type SkuGroup = {
  sku: string;
  product: string;
  totalQty: number;
  customerCount: number;
  customerValue: number;
  purchaseTotal: number;
  margin: number;
  marginPct: number | null;
  purchaseCostKnown: boolean;
  stockStatus: OrderLine["stockStatus"];
  owner: "Netanel" | "Geoff";
  lines: CockpitLine[];
};

export type BatchSummary = {
  id: string;
  batchNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  approvedAt: string | null;
  exportedAt: string | null;
  customerValue: number;
  purchaseTotal: number;
  itemCount: number;
  skuCount: number;
  customerCount: number;
  createdBy: string | null;
  approvedBy: string | null;
  items: Array<{
    id: string;
    sku: string;
    itemName: string | null;
    customerName: string | null;
    orderNumber: string | null;
    projectName: string | null;
    customerQty: number;
    customerTotal: number;
    purchaseTotal: number;
    stockStatus: OrderLine["stockStatus"];
    supplierName: string | null;
    supplierEmail: string | null;
    supplierFormSentAt: string | null;
    supplierFormReturnedAt: string | null;
    supplierApprovedAt: string | null;
    orderConfirmationSentAt: string | null;
    piNo: string | null;
    piReceivedAt: string | null;
    backorderUnits: number;
    purchaseStatus: string;
  }>;
};

export type CockpitData = {
  openLines: CockpitLine[];
  skuGroups: SkuGroup[];
  waitingBatches: BatchSummary[];
  completedBatches: BatchSummary[];
  isMock: boolean;
  batchSchemaReady: boolean;
  error?: string;
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

function displayOrderLabel(value: unknown, fallback = "Customer order") {
  return String(value || fallback)
    .replace(/\bRFQ\b/gi, "order")
    .replace(/\s+/g, " ")
    .trim();
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

export async function getAdminProfile(): Promise<ProfileSummary | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  if (profile.account_status !== "approved") return null;
  if (profile.role !== "admin" && profile.role !== "super_admin") return null;
  return profile;
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
      const ownerName = assigned?.first_name || assigned?.email || "Netanel";
      rows.push({
        id: String(item.id),
        customer: order.companies?.name || "Customer without company",
        project: displayOrderLabel(order.project_name || order.order_number, "order request"),
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
        owner: ownerName.toLowerCase().includes("geoff") ? "Geoff" : "Netanel",
      });
    }
  }
  return { rows: rows.length ? rows : mockOrders, isMock: rows.length === 0 };
}

function ownerLabel(assigned: any): "Netanel" | "Geoff" {
  const raw = [assigned?.first_name, assigned?.last_name, assigned?.email].filter(Boolean).join(" ").toLowerCase();
  return raw.includes("geoff") ? "Geoff" : "Netanel";
}

function marginDisplay(customerTotal: number, purchaseTotal: number) {
  const purchaseCostKnown = purchaseTotal > 0;
  const margin = customerTotal - purchaseTotal;
  const marginPct = purchaseCostKnown && customerTotal ? Math.round((margin / customerTotal) * 1000) / 10 : null;
  return { purchaseCostKnown, margin, marginPct };
}

function buildSkuGroups(lines: CockpitLine[]): SkuGroup[] {
  const map = new Map<string, CockpitLine[]>();
  for (const line of lines) {
    const key = line.sku || "UNKNOWN";
    map.set(key, [...(map.get(key) ?? []), line]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }))
    .map(([sku, grouped]) => {
      const customerValue = grouped.reduce((sum, line) => sum + line.customerTotal, 0);
      const purchaseTotal = grouped.reduce((sum, line) => sum + line.purchaseTotal, 0);
      const totalQty = grouped.reduce((sum, line) => sum + line.orderQty, 0);
      const purchaseCostKnown = grouped.every((line) => line.purchaseCostKnown);
      const margin = customerValue - purchaseTotal;
      const marginPct = purchaseCostKnown && customerValue ? Math.round((margin / customerValue) * 1000) / 10 : null;
      const statusRank: Record<OrderLine["stockStatus"], number> = { missing: 4, needs_purchase: 3, partial: 2, in_stock: 1 };
      const stockStatus = grouped.reduce((worst, line) => statusRank[line.stockStatus] > statusRank[worst] ? line.stockStatus : worst, "in_stock" as OrderLine["stockStatus"]);
      return {
        sku,
        product: grouped[0]?.product ?? sku,
        totalQty,
        customerCount: new Set(grouped.map((line) => line.customer)).size,
        customerValue,
        purchaseTotal,
        margin,
        marginPct,
        purchaseCostKnown,
        stockStatus,
        owner: grouped.some((line) => line.owner === "Geoff") ? "Geoff" : "Netanel",
        lines: grouped.sort((a, b) => a.customer.localeCompare(b.customer)),
      };
    });
}

function normalizeBatch(row: Record<string, any>): BatchSummary {
  const items = Array.isArray(row.order_batch_items) ? row.order_batch_items : [];
  const normalizedItems = items.map((item: any) => ({
    id: item.id,
    sku: item.sku,
    itemName: item.item_name ?? null,
    customerName: item.customer_name ?? null,
    orderNumber: item.order_number ?? null,
    projectName: displayOrderLabel(item.project_name, "Customer order"),
    customerQty: numberValue(item.customer_qty),
    customerTotal: numberValue(item.customer_total),
    purchaseTotal: numberValue(item.purchase_total),
    stockStatus: normalizeStock(item.stock_status),
    supplierName: item.supplier_name ?? null,
    supplierEmail: item.supplier_email ?? null,
    supplierFormSentAt: item.supplier_form_sent_at ?? null,
    supplierFormReturnedAt: item.supplier_form_returned_at ?? null,
    supplierApprovedAt: item.supplier_approved_at ?? null,
    orderConfirmationSentAt: item.order_confirmation_sent_at ?? null,
    piNo: item.pi_no ?? null,
    piReceivedAt: item.pi_received_at ?? null,
    backorderUnits: numberValue(item.backorder_units),
    purchaseStatus: item.purchase_status ?? "draft",
  }));
  const profileName = (profile: any) => [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || null;
  return {
    id: row.id,
    batchNumber: row.batch_number,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    approvedAt: row.approved_at ?? null,
    exportedAt: row.exported_at ?? null,
    customerValue: numberValue(row.customer_value),
    purchaseTotal: numberValue(row.purchase_total),
    itemCount: normalizedItems.length,
    skuCount: new Set(normalizedItems.map((item) => item.sku)).size,
    customerCount: new Set(normalizedItems.map((item) => item.customerName).filter(Boolean)).size,
    createdBy: profileName(row.created_profile),
    approvedBy: profileName(row.approved_profile),
    items: normalizedItems,
  };
}

export async function getCockpitData(): Promise<CockpitData> {
  const supabase = await createServerSupabaseClient();

  const batchItemsResult = await supabase.from("order_batch_items").select("order_item_id");
  const batchSchemaReady = !batchItemsResult.error || batchItemsResult.error.code !== "42P01";
  const batchedItemIds = new Set(((batchItemsResult.data ?? []) as Array<Record<string, any>>).map((item) => String(item.order_item_id)));

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id,order_number,project_name,status,total_customer_value,total_purchase_cost,company_id,customer_user_id,created_at,updated_at,profiles:assigned_to(first_name,last_name,email),customer_profile:customer_user_id(email),companies(name),order_items(id,sku,product_title,order_quantity,customer_unit_price,customer_total,purchase_unit_price,purchase_total,stock_status,supplier_name,missing_quantity)")
    .order("created_at", { ascending: false })
    .limit(150);

  if (ordersError) return { openLines: [], skuGroups: [], waitingBatches: [], completedBatches: [], isMock: true, batchSchemaReady, error: ordersError.message };

  const openLines: CockpitLine[] = [];
  for (const order of ((orders ?? []) as Array<Record<string, any>>)) {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of items) {
      if (batchedItemIds.has(String(item.id))) continue;
      if (["new", "delivered", "cancelled"].includes(String(order.status))) continue;
      const customerTotal = invoiceTotalForAvailable(item.customer_unit_price, item.order_quantity, item.missing_quantity);
      const purchaseUnitPrice = purchaseUnitOrFormula(item.purchase_unit_price, item.customer_unit_price);
      const purchaseTotal = purchaseTotalOrFormula(item.purchase_unit_price, item.purchase_total, item.customer_unit_price, item.order_quantity, item.missing_quantity);
      const marginInfo = marginDisplay(customerTotal, purchaseTotal);
      const assigned = order.profiles;
      openLines.push({
        id: String(item.id),
        orderId: String(order.id),
        orderItemId: String(item.id),
        orderNumber: order.order_number ?? null,
        companyId: order.company_id ?? null,
        customerEmail: order.customer_profile?.email ?? null,
        createdAt: order.created_at,
        customer: order.companies?.name || order.customer_profile?.email || "Customer without company",
        project: order.project_name || order.order_number || "Customer order",
        sku: item.sku,
        product: item.product_title || item.sku,
        orderQty: numberValue(item.order_quantity),
        customerUnitPrice: numberValue(item.customer_unit_price),
        customerTotal,
        purchaseUnitPrice,
        purchaseTotal,
        margin: marginInfo.margin,
        marginPct: marginInfo.marginPct ?? 0,
        purchaseCostKnown: purchaseTotal > 0,
        supplierName: item.supplier_name || DEFAULT_SUPPLIER_NAME,
        piNo: null,
        backorderUnits: numberValue(item.missing_quantity),
        stockStatus: normalizeStock(item.stock_status),
        orderStatus: order.status === "approved" ? "approved" : order.status === "review" ? "review" : "new",
        owner: ownerLabel(assigned),
      });
    }
  }

  let waitingBatches: BatchSummary[] = [];
  let completedBatches: BatchSummary[] = [];
  if (batchSchemaReady) {
    const { data: batches, error: batchesError } = await supabase
      .from("order_batches")
      .select("id,batch_number,status,created_at,updated_at,approved_at,exported_at,customer_value,purchase_total,created_profile:created_by(first_name,last_name,email),approved_profile:approved_by(first_name,last_name,email),order_batch_items(id,sku,item_name,customer_name,order_number,project_name,customer_qty,customer_total,purchase_total,stock_status,supplier_name,supplier_email,supplier_form_sent_at,supplier_form_returned_at,supplier_approved_at,order_confirmation_sent_at,pi_no,pi_received_at,backorder_units,purchase_status)")
      .order("created_at", { ascending: false })
      .limit(30);
    if (batchesError && batchesError.code !== "42P01") {
      return { openLines, skuGroups: buildSkuGroups(openLines), waitingBatches: [], completedBatches: [], isMock: false, batchSchemaReady, error: batchesError.message };
    }
    const normalized = ((batches ?? []) as Array<Record<string, any>>).map(normalizeBatch);
    waitingBatches = normalized.filter((batch) => ["generated", "waiting_approval", "approved", "executing"].includes(batch.status));
    completedBatches = normalized.filter((batch) => ["completed", "cancelled"].includes(batch.status));
  }

  return { openLines, skuGroups: buildSkuGroups(openLines), waitingBatches, completedBatches, isMock: openLines.length === 0 && waitingBatches.length === 0, batchSchemaReady, error: batchItemsResult.error && batchSchemaReady ? batchItemsResult.error.message : undefined };
}

function normalizeOrderRecords(data: any[]): { rows: OrderRecord[]; isMock: boolean } {
  const rows = ((data ?? []) as Array<Record<string, any>>).map((order) => {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    return {
      id: order.id,
      orderNumber: order.order_number,
      projectName: order.project_name,
      status: order.status,
      customer: order.companies?.name || order.profiles?.email || "Customer without company",
      companyId: order.company_id,
      customerEmail: order.profiles?.email ?? null,
      customerPoNumber: order.customer_po_number ?? null,
      customerVisibleNote: order.customer_visible_note ?? null,
      internalAdminNote: order.internal_admin_note ?? null,
      customerIsVip: Boolean(order.companies?.is_vip),
      customerVipLabel: order.companies?.vip_label ?? (order.companies?.is_vip ? "VIP" : null),
      totalCustomerValue: numberValue(order.total_customer_value),
      totalPurchaseCost: numberValue(order.total_purchase_cost),
      grossMargin: numberValue(order.gross_margin),
      marginPct: numberValue(order.margin_pct),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: items.map((item: any) => {
        const customerTotal = numberValue(item.customer_total);
        const purchaseTotal = numberValue(item.purchase_total);
        const margin = item.margin == null ? customerTotal - purchaseTotal : numberValue(item.margin);
        const marginPct = item.margin_pct == null ? (customerTotal ? (margin / customerTotal) * 100 : 0) : numberValue(item.margin_pct);
        return {
          id: item.id,
          sku: item.sku,
          productTitle: item.product_title,
          orderQuantity: numberValue(item.order_quantity),
          customerUnitPrice: numberValue(item.customer_unit_price),
          customerTotal,
          purchaseUnitPrice: numberValue(item.purchase_unit_price),
          purchaseTotal,
          margin,
          marginPct: Math.round(marginPct * 100) / 100,
          stockStatus: normalizeStock(item.stock_status),
          notes: item.notes ?? null,
        };
      }),
    } satisfies OrderRecord;
  });
  return { rows, isMock: rows.length === 0 };
}

export async function getOrderRecords(): Promise<{ rows: OrderRecord[]; isMock: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,project_name,status,total_customer_value,total_purchase_cost,gross_margin,margin_pct,company_id,customer_user_id,customer_po_number,customer_visible_note,internal_admin_note,created_at,updated_at,companies(name,is_vip,vip_label),profiles:customer_user_id(email),order_items(id,sku,product_title,order_quantity,customer_unit_price,customer_total,purchase_unit_price,purchase_total,margin,margin_pct,stock_status,notes)")
    .order("created_at", { ascending: false })
    .limit(75);
  if (error?.code === "42703") {
    const fallback = await supabase
      .from("orders")
      .select("id,order_number,project_name,status,total_customer_value,total_purchase_cost,gross_margin,margin_pct,company_id,customer_user_id,created_at,updated_at,companies(name),profiles:customer_user_id(email),order_items(id,sku,product_title,order_quantity,customer_unit_price,customer_total,purchase_unit_price,purchase_total,margin,margin_pct,stock_status,notes)")
      .order("created_at", { ascending: false })
      .limit(75);
    if (fallback.error) return { rows: [], isMock: true, error: fallback.error.message };
    return normalizeOrderRecords(fallback.data ?? []);
  }
  if (error) return { rows: [], isMock: true, error: error.message };
  return normalizeOrderRecords(data ?? []);
}

export async function getCustomers(): Promise<{ rows: CustomerRow[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const customersWithNumbers = await supabase
    .from("companies")
    .select("id,account_number,name,country,registration_number,is_vip,vip_label,vip_notes,created_at,company_members(user_id,member_role,profiles(email,first_name,last_name,role,account_status,customer_number)),trade_applications(id,status,created_at),orders(id,status,total_customer_value,created_at)")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data, error } = customersWithNumbers.error?.code === "42703"
    ? await supabase
        .from("companies")
        .select("id,name,country,registration_number,created_at,company_members(user_id,member_role,profiles(email,first_name,last_name,role,account_status)),trade_applications(id,status,created_at),orders(id,status,total_customer_value,created_at)")
        .order("created_at", { ascending: false })
        .limit(100)
    : customersWithNumbers;
  if (error) return { rows: [], error: error.message };
  return {
    rows: ((data ?? []) as Array<Record<string, any>>).map((row) => {
      const members = Array.isArray(row.company_members) ? row.company_members : [];
      const orders = Array.isArray(row.orders) ? row.orders : [];
      const totalValue = orders.reduce((sum: number, order: any) => sum + numberValue(order.total_customer_value), 0);
      const latestOrderAt = orders
        .map((order: any) => order.created_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const memberLabels = members.map((member: any) => {
        const profile = member.profiles;
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
        return [name || profile?.email || member.user_id, profile?.customer_number, profile?.role, profile?.account_status].filter(Boolean).join(" · ");
      });
      return {
        id: row.id,
        account_number: row.account_number ?? null,
        name: row.name,
        country: row.country,
        registration_number: row.registration_number,
        isVip: Boolean(row.is_vip),
        vipLabel: row.vip_label ?? (row.is_vip ? "VIP" : null),
        vipNotes: row.vip_notes ?? null,
        created_at: row.created_at,
        members: members.length,
        memberLabels,
        memberUserIds: members.map((member: any) => member.user_id).filter(Boolean),
        hasStaffMember: members.some((member: any) => member.profiles?.role === "admin" || member.profiles?.role === "super_admin"),
        applications: Array.isArray(row.trade_applications) ? row.trade_applications.length : 0,
        orders: orders.length,
        totalValue,
        latestOrderAt,
      };
    }),
  };
}

export async function getCustomerActivity(limit = 30): Promise<{ rows: CustomerActivityRow[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,action,metadata,created_at")
    .like("action", "customer_activity_%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { rows: [], error: error.message };
  return {
    rows: ((data ?? []) as Array<Record<string, any>>).map((row) => {
      const metadata = row.metadata || {};
      return {
        id: row.id,
        action: row.action,
        eventLabel: metadata.eventLabel || String(row.action || "customer activity").replace("customer_activity_", "").replaceAll("_", " "),
        customerEmail: metadata.customer_email ?? null,
        companyName: metadata.company_name ?? null,
        pageUrl: metadata.pageUrl ?? null,
        createdAt: row.created_at,
        alert: metadata.errorMessage ?? null,
      };
    }),
  };
}

export async function getSettingsOverview(): Promise<SettingsOverview> {
  const supabase = await createServerSupabaseClient();
  const [companies, orders, pendingApplications, admins] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("trade_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ["admin", "super_admin"]),
  ]);
  return {
    env: [
      { label: "Supabase URL", ready: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
      { label: "Supabase anon key", ready: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
      { label: "Service role key", ready: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
      { label: "Resend email API", ready: Boolean(process.env.RESEND_API_KEY) },
    ],
    counts: {
      customers: companies.count ?? 0,
      orders: orders.count ?? 0,
      pendingApplications: pendingApplications.count ?? 0,
      admins: admins.count ?? 0,
    },
  };
}
