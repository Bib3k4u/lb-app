/**
 * Local-calendar-date helpers. Deliberately never round-trip through
 * `.toISOString()` for a date-only value — that converts to UTC, and for any
 * timezone ahead of UTC (IST included) constructing a local midnight Date
 * and then calling `.toISOString()` lands on the PREVIOUS UTC calendar day,
 * silently shifting every "today"/date-nav computation back by one. The
 * backend's own "today" (LocalDate.now(Asia/Kolkata)) is a local-calendar
 * concept too, so these need to match it, not UTC.
 */

export function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoToday(): string {
  return toIsoDate(new Date());
}

export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}
