// Shared pay-fortnight logic, used by the admin Payroll tab and the
// employee's own "hours this fortnight" view, so both agree on exactly
// where a fortnight starts and ends.

// Returns the start (midnight) of the 14-day period containing `anchor`,
// counting in fixed 14-day blocks from a fixed reference date. This keeps
// fortnight boundaries stable and predictable rather than drifting.
// Reference: Friday 19 June 2026, the start of a pay fortnight.
export function fortnightStart(anchor: Date): Date {
  const referenceFriday = new Date("2026-06-19T00:00:00");
  const dayMs = 86400000;
  const daysSince = Math.floor((anchor.getTime() - referenceFriday.getTime()) / dayMs);
  const fortnightIndex = Math.floor(daysSince / 14);
  return new Date(referenceFriday.getTime() + fortnightIndex * 14 * dayMs);
}

export function fortnightEnd(start: Date): Date {
  return new Date(start.getTime() + 14 * 86400000 - 1000);
}

export function currentFortnightRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = fortnightStart(now);
  return { start, end: fortnightEnd(start) };
}
