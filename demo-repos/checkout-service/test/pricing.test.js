import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCheckoutTotal } from "../src/pricing.js";

test("calculates checkout total with regional tax", () => {
  const total = calculateCheckoutTotal({
    region: "US",
    discountCents: 500,
    items: [
      { sku: "pro-plan", unitPriceCents: 2000, quantity: 2 },
      { sku: "setup", unitPriceCents: 1500, quantity: 1 },
    ],
  });

  assert.deepEqual(total, {
    subtotalCents: 5500,
    discountCents: 500,
    taxCents: 413,
    totalCents: 5413,
  });
});

test("rejects empty carts", () => {
  assert.throws(
    () => calculateCheckoutTotal({ region: "US", items: [] }),
    /at least one item/,
  );
});
