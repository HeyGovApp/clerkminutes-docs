/**
 * Date helpers. Everything the app persists uses a local "YYYY-MM-DD" day key,
 * so a plan never shifts under a user because of timezone maths.
 */

export const DAY_MS = 86400000;

export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parse a day key into a local-midnight Date (never UTC-shifted). */
export function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / DAY_MS);
}

export function today() {
  return dayKey(new Date());
}

/** Monday-based weekday index: Mon=0 … Sun=6. */
export function weekdayIndex(key) {
  return (fromKey(key).getDay() + 6) % 7;
}

export function startOfWeek(key) {
  return addDays(key, -weekdayIndex(key));
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function formatDay(key, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return fromKey(key).toLocaleDateString(undefined, opts);
}

export function formatLong(key) {
  return fromKey(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function formatShort(key) {
  return fromKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** "in 12 weeks" / "3 days ago" — coarse, human, never precise-to-the-minute. */
export function relativeDays(key, from = today()) {
  const diff = daysBetween(from, key);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  const abs = Math.abs(diff);
  const unit = abs >= 14 ? [Math.round(abs / 7), "week"] : [abs, "day"];
  const label = `${unit[0]} ${unit[1]}${unit[0] === 1 ? "" : "s"}`;
  return diff > 0 ? `in ${label}` : `${label} ago`;
}
