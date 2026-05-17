import assert from "node:assert/strict";
import {
  orderLineMoney,
  parsePurchaseUnitInput,
  validatePurchaseUnitForOrderEdit,
} from "./secure-smart-pricing";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("blank purchase-unit input is treated as unknown cost, not zero cost", () => {
  assert.equal(parsePurchaseUnitInput(""), null);
  assert.equal(parsePurchaseUnitInput("   "), null);
  assert.equal(parsePurchaseUnitInput(null), null);
  assert.deepEqual(orderLineMoney({ quantity: 5, customerUnit: 210.37, purchaseUnit: null }), {
    customerTotal: 1051.85,
    purchaseTotal: null,
    margin: null,
    marginPct: null,
  });
});

test("implausibly low purchase unit is blocked unless explicitly confirmed", () => {
  assert.throws(
    () => validatePurchaseUnitForOrderEdit({ purchaseUnit: 5, customerUnit: 210.37, lowCostConfirmed: false }),
    /unusually low/i,
  );
  assert.doesNotThrow(() => validatePurchaseUnitForOrderEdit({ purchaseUnit: 5, customerUnit: 210.37, lowCostConfirmed: true }));
});

test("normal supplier cost passes validation", () => {
  assert.doesNotThrow(() => validatePurchaseUnitForOrderEdit({ purchaseUnit: 163.08, customerUnit: 210.37, lowCostConfirmed: false }));
});
