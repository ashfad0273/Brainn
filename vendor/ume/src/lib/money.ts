import { MINUS } from "./format"

/* Taka, the way every Squidx app shows money: the ৳ sign, Bangladeshi lakh
   grouping (৳17,55,000), whole taka, and the real minus sign (U+2212), which
   lines up with "+" in tabular figures where a hyphen doesn't. Use these
   rather than formatting a figure by hand. An app that stores other
   currencies converts to taka first (Ledger: src/lib/currency.ts). */

const LOCALE = "en-IN"

const whole = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
})

const compact = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/* Whether a formatted figure shows anything but zeros: a float crumb
   (−1e-17) or −0.4 rounds to ৳0, which must never read "−৳0". */
const nonZero = (body: string) => /[1-9]/.test(body)

/* "৳1,20,000", "−৳45,000", "৳0". */
export function taka(n: number): string {
  const body = whole.format(Math.abs(n))
  return n < 0 && nonZero(body) ? `${MINUS}${body}` : body
}

/* "+" for money in, "−" for money out, nothing for zero. */
export const signFor = (n: number): string => (n > 0 ? "+" : n < 0 ? MINUS : "")

/* "+৳1,200", "−৳4,500", "৳0": a change or a movement of money. */
export function takaSigned(n: number): string {
  const body = whole.format(Math.abs(n))
  return nonZero(body) ? `${signFor(n)}${body}` : body
}

/* A figure in a few characters, for pills and axis labels: ৳950, ৳1.2L,
   ৳3.4Cr in lakh and crore, as Intl's en-IN compact notation writes them. */
export function takaShort(n: number): string {
  const body = compact.format(Math.abs(n))
  return n < 0 && nonZero(body) ? `${MINUS}${body}` : body
}

export { MINUS }
