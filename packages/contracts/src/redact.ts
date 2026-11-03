/**
 * Sensitive numbers never reach storage: payment card numbers (13–19 digits
 * passing the Luhn check), US SSN-shaped numbers, and unbroken runs of nine or
 * more digits (account and routing numbers). Phone numbers and amounts stay,
 * because the verdict needs them to compare a claim with the screen.
 */
export function redact(text: string): { text: string; changed: boolean } {
  const out = text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted]")
    .replace(/\b\d(?:[ -]?\d){12,18}\b/g, (m) => (luhn(m.replace(/\D/g, "")) ? "[redacted]" : m))
    .replace(/\b\d{9,}\b/g, "[redacted]");
  return { text: out, changed: out !== text };
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 13 && sum % 10 === 0;
}
