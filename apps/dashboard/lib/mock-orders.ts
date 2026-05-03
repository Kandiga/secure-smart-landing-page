export type OrderLine = {
  id: string;
  customer: string;
  project?: string;
  sku: string;
  product: string;
  orderQty: number;
  customerUnitPrice: number;
  customerTotal: number;
  purchaseUnitPrice: number;
  purchaseTotal: number;
  margin: number;
  marginPct: number;
  stockStatus: "in_stock" | "partial" | "missing" | "needs_purchase";
  orderStatus: "new" | "review" | "approved" | "ready";
  owner: "נתנאל" | "ג׳ף";
};

export const mockOrders: OrderLine[] = [
  { id: "SS-1007", customer: "גרנד", project: "WiFi rollout", sku: "U7-LR", product: "UniFi U7 LR", orderQty: 31, customerUnitPrice: 183, customerTotal: 5673, purchaseUnitPrice: 133.4, purchaseTotal: 4135.4, margin: 1537.6, marginPct: 27.1, stockStatus: "in_stock", orderStatus: "review", owner: "נתנאל" },
  { id: "SS-1008", customer: "גרנד", project: "Switching", sku: "USW-PRO-MAX-16-POE", product: "USW Pro Max 16 PoE", orderQty: 5, customerUnitPrice: 454, customerTotal: 2270, purchaseUnitPrice: 346.5, purchaseTotal: 1732.5, margin: 537.5, marginPct: 23.7, stockStatus: "in_stock", orderStatus: "new", owner: "ג׳ף" },
  { id: "SS-1009", customer: "גדי", project: "Protect cameras", sku: "UVC-G6-TURRET-W", product: "UVC G6 Turret White", orderQty: 6, customerUnitPrice: 230, customerTotal: 1380, purchaseUnitPrice: 175, purchaseTotal: 1050, margin: 330, marginPct: 23.9, stockStatus: "partial", orderStatus: "review", owner: "נתנאל" },
  { id: "SS-1010", customer: "סיסטם", project: "Core gateway", sku: "UDM-PRO-MAX", product: "UDM Pro Max", orderQty: 1, customerUnitPrice: 701, customerTotal: 701, purchaseUnitPrice: 524, purchaseTotal: 524, margin: 177, marginPct: 25.2, stockStatus: "in_stock", orderStatus: "approved", owner: "ג׳ף" },
];

export function money(value: number, currency = "$") {
  return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function stockLabel(status: OrderLine["stockStatus"]) {
  const labels = { in_stock: "במלאי", partial: "חלקי", missing: "חסר", needs_purchase: "צריך רכש" };
  return labels[status];
}

export function stockClass(status: OrderLine["stockStatus"]) {
  if (status === "in_stock") return "success";
  if (status === "partial" || status === "needs_purchase") return "warning";
  return "danger";
}
