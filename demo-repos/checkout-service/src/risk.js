export function scorePaymentRisk({ amountCents, failedAttempts, accountAgeDays }) {
  let score = 0;

  if (amountCents > 50_000) score += 35;
  if (failedAttempts >= 2) score += 30;
  if (accountAgeDays < 7) score += 25;

  return Math.min(score, 100);
}

export function shouldRequireStepUp(input) {
  return scorePaymentRisk(input) >= 50;
}
