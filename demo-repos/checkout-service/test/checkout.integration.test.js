import assert from "node:assert/strict";
import { test } from "node:test";
import { createCheckoutResponse } from "../src/server.js";

test("creates a checkout response and triggers step-up for risky payments", () => {
  const response = createCheckoutResponse({
    checkoutId: "chk_demo_001",
    region: "EU",
    accountAgeDays: 2,
    failedAttempts: 2,
    items: [{ sku: "enterprise-seat", unitPriceCents: 60_000, quantity: 1 }],
  });

  assert.equal(response.checkoutId, "chk_demo_001");
  assert.equal(response.requiresStepUp, true);
  assert.equal(response.totalCents, 72_600);
});
