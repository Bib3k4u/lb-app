const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatMinor(amountMinor: number, currency = "INR"): string {
  if (currency !== "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      amountMinor / 100,
    );
  }
  return INR_FORMATTER.format(amountMinor / 100);
}

/** Parses a rupee input string (e.g. "1,299" or "1299.00") into integer paise. Never floats over the wire. */
export function rupeesToMinor(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const rupees = Number.parseFloat(cleaned || "0");
  return Math.round(rupees * 100);
}

export function minorToRupeesInput(amountMinor: number): string {
  return (amountMinor / 100).toString();
}
