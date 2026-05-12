export const DEFAULT_SUPPLIER_NAME = "Discomp";
export const PUBLIC_PRICE_MULTIPLIER = 1.29;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function purchaseUnitFromCustomer(customerUnitPrice: unknown) {
  const customerUnit = numberValue(customerUnitPrice);
  return customerUnit ? roundMoney(customerUnit / PUBLIC_PRICE_MULTIPLIER) : 0;
}

export function purchaseUnitOrFormula(purchaseUnitPrice: unknown, customerUnitPrice: unknown) {
  const purchaseUnit = numberValue(purchaseUnitPrice);
  return purchaseUnit > 0 ? purchaseUnit : purchaseUnitFromCustomer(customerUnitPrice);
}

export function availableQuantity(customerQty: unknown, backorderUnits: unknown) {
  const qty = numberValue(customerQty);
  const backorder = Math.max(0, numberValue(backorderUnits));
  return Math.max(0, qty - backorder);
}

export function purchaseTotalOrFormula(purchaseUnitPrice: unknown, purchaseTotal: unknown, customerUnitPrice: unknown, customerQty: unknown, backorderUnits: unknown = 0) {
  const explicitTotal = numberValue(purchaseTotal);
  if (explicitTotal > 0) return explicitTotal;
  const unit = purchaseUnitOrFormula(purchaseUnitPrice, customerUnitPrice);
  return roundMoney(unit * availableQuantity(customerQty, backorderUnits));
}

export function invoiceTotalForAvailable(customerUnitPrice: unknown, customerQty: unknown, backorderUnits: unknown = 0) {
  return roundMoney(numberValue(customerUnitPrice) * availableQuantity(customerQty, backorderUnits));
}

export function grossMarginPct(customerTotal: unknown, purchaseTotal: unknown) {
  const customer = numberValue(customerTotal);
  const purchase = numberValue(purchaseTotal);
  if (!customer || !purchase) return null;
  return Math.round(((customer - purchase) / customer) * 1000) / 10;
}
