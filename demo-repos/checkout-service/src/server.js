import { calculateCheckoutTotal } from "./pricing.js";
import { shouldRequireStepUp } from "./risk.js";

export function createCheckoutResponse(request) {
  const totals = calculateCheckoutTotal(request);
  const requiresStepUp = shouldRequireStepUp({
    amountCents: totals.totalCents,
    failedAttempts: request.failedAttempts ?? 0,
    accountAgeDays: request.accountAgeDays ?? 365,
  });

  return {
    checkoutId: request.checkoutId,
    currency: request.currency ?? "USD",
    requiresStepUp,
    ...totals,
  };
}
