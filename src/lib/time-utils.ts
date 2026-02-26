/**
 * Time utilities for handling overnight shifts (e.g., 16:00 to 01:00)
 */

/** Convert "HH:mm" to minutes since midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Convert minutes since midnight to "HH:mm" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(((minutes % 1440) + 1440) % 1440 / 60);
  const m = ((minutes % 1440) + 1440) % 1440 % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/** Calculate shift duration in hours, handling overnight wrap */
export function shiftDuration(start: string, end: string): number {
  let startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin <= startMin) endMin += 1440; // next day
  return (endMin - startMin) / 60;
}

/** Check if two time windows overlap, handling overnight shifts */
export function timesOverlap(
  s1Start: string, s1End: string,
  s2Start: string, s2End: string
): boolean {
  let a1 = timeToMinutes(s1Start);
  let a2 = timeToMinutes(s1End);
  let b1 = timeToMinutes(s2Start);
  let b2 = timeToMinutes(s2End);

  // Handle overnight wrapping
  if (a2 <= a1) a2 += 1440;
  if (b2 <= b1) b2 += 1440;

  // Check both the original and +24hr shifted versions for overnight overlap
  return (a1 < b2 && b1 < a2) ||
         (a1 < b2 + 1440 && b1 + 1440 < a2) ||
         (a1 + 1440 < b2 && b1 < a2 + 1440);
}

/** Check if a shift time window fits within an availability window */
export function fitsInWindow(
  shiftStart: string, shiftEnd: string,
  availFrom: string, availTo: string
): boolean {
  let ss = timeToMinutes(shiftStart);
  let se = timeToMinutes(shiftEnd);
  let af = timeToMinutes(availFrom);
  let at = timeToMinutes(availTo);

  if (se <= ss) se += 1440;
  if (at <= af) at += 1440;

  // Shift start must be >= avail start, shift end must be <= avail end
  // But we need to handle the case where both cross midnight
  return ss >= af && se <= at;
}

/** Calculate hours between end of one shift and start of next, accounting for dates */
export function hoursBetweenShifts(
  prevDate: string, prevEnd: string,
  nextDate: string, nextStart: string
): number {
  const prevEndDate = new Date(`${prevDate}T${prevEnd}:00`);
  const nextStartDate = new Date(`${nextDate}T${nextStart}:00`);

  // If prev end time is before, say, 06:00 it's actually the next calendar day
  const prevEndMinutes = timeToMinutes(prevEnd);
  if (prevEndMinutes < 360) { // before 6am = overnight shift end
    prevEndDate.setDate(prevEndDate.getDate() + 1);
  }

  const diffMs = nextStartDate.getTime() - prevEndDate.getTime();
  return diffMs / (1000 * 60 * 60);
}

/** Format a time range for display (e.g., "4:00 PM - 1:00 AM") */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/** Format "HH:mm" to "h:mm AM/PM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/** Get day of week from a date string */
export function getDayOfWeek(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateStr + 'T12:00:00');
  return days[date.getDay()];
}

/** Get dates for a week starting from a Monday */
export function getWeekDates(weekStart: string): Record<string, string> {
  const start = new Date(weekStart + 'T12:00:00');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const result: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    result[days[i]] = d.toISOString().split('T')[0];
  }
  return result;
}

/** Format HH:mm to compact display: "4PM", "11AM", "2:30PM" */
export function formatTimeCompact(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
}

/** Format an array of AssignedShift for display.
 *  Single:  "4PM-2AM"
 *  Double:  "11AM-4PM + 9PM-2AM"
 *  Empty:   ""
 */
export function formatAssignedShifts(shifts: { start: string; end: string }[]): string {
  if (shifts.length === 0) return '';
  return shifts
    .map(s => `${formatTimeCompact(s.start)}-${formatTimeCompact(s.end)}`)
    .join(' + ');
}

/** Get the Monday of the current week */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}
