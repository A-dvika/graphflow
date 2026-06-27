import assert from "node:assert/strict";
import { createCheckoutResponse } from "../src/server.js";

const response = createCheckoutResponse({
  checkoutId: "smoke_checkout",
  region: "IN",
  items: [{ sku: "smoke-item", unitPriceCents: 1500, quantity: 2 }],
});

assert.equal(response.totalCents, 3540);
console.log("Smoke test passed.");
