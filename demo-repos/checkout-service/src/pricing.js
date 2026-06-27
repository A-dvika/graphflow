const taxRates = {
  US: 0.0825,
  EU: 0.21,
  IN: 0.18,
};

export function calculateSubtotal(items) {
  return items.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0);
}

export function calculateCheckoutTotal({ items, region, discountCents = 0 }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("checkout requires at least one item");
  }

  const subtotal = calculateSubtotal(items);
  const taxableAmount = Math.max(subtotal - discountCents, 0);
  const tax = Math.round(taxableAmount * (taxRates[region] ?? 0));

  return {
    subtotalCents: subtotal,
    discountCents,
    taxCents: tax,
    totalCents: taxableAmount + tax,
  };
}
