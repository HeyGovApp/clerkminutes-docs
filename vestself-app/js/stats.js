/**
 * Derived numbers. Nothing here is stored — completion, streaks and weekly
 * rates are always computed from the tasks themselves, so they can never drift
 * out of sync with what the user actually did.
 */
import { today, addDays, startOfWeek, daysBetween } from "./lib/date.js";

/** A task counts toward the denominator unless it was deliberately skipped. */
const counts = (t) => t.status !== "skipped";

export function weekBuckets(goal) {
  if (!goal?.tasks?.length) return [];
  const byWeek = new Map();
  for (const task of goal.tasks) {
    const key = startOfWeek(task.date);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(task);
  }

  const now = today();
  const thisWeek = startOfWeek(now);

  return [...byWeek.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekKey, tasks], i) => {
      const planned = tasks.filter(counts).length;
      const done = tasks.filter((t) => t.status === "done").length;
      const missed = tasks.filter((t) => t.status === "missed").length;
      return {
        weekKey,
        index: i + 1,
        tasks,
        planned,
        done,
        missed,
        skipped: tasks.length - planned,
        rate: planned ? done / planned : 0,
        state: weekKey < thisWeek ? "complete" : weekKey === thisWeek ? "current" : "future",
      };
    });
}

export function goalProgress(goal) {
  const tasks = goal?.tasks || [];
  const planned = tasks.filter(counts).length;
  const done = tasks.filter((t) => t.status === "done").length;
  const missed = tasks.filter((t) => t.status === "missed").length;
  const elapsed = tasks.filter((t) => counts(t) && t.date <= today()).length;
  return {
    planned,
    done,
    missed,
    rate: planned ? done / planned : 0,
    /** Consistency against what was due so far — the number that matters mid-plan. */
    adherence: elapsed ? done / elapsed : 0,
    daysLeft: Math.max(0, daysBetween(today(), goal?.targetDate || today())),
    weeksLeft: Math.max(0, Math.ceil(daysBetween(today(), goal?.targetDate || today()) / 7)),
  };
}

/**
 * Consecutive days where everything scheduled got done. Days with nothing
 * scheduled are neutral — a rest day does not break a streak, a missed
 * session does.
 */
export function currentStreak(goal) {
  const byDay = new Map();
  for (const task of goal?.tasks || []) {
    if (!counts(task)) continue;
    if (!byDay.has(task.date)) byDay.set(task.date, []);
    byDay.get(task.date).push(task);
  }

  let streak = 0;
  let cursor = today();
  // Today only counts once it is actually finished; an unfinished today is neutral.
  for (let i = 0; i < 400; i++) {
    const tasks = byDay.get(cursor);
    if (tasks?.length) {
      const allDone = tasks.every((t) => t.status === "done");
      if (allDone) streak++;
      else if (cursor !== today()) break;
    }
    cursor = addDays(cursor, -1);
    if (goal?.startDate && cursor < goal.startDate) break;
  }
  return streak;
}

export function bestStreak(goal) {
  const days = [...new Set((goal?.tasks || []).filter(counts).map((t) => t.date))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    const tasks = (goal.tasks || []).filter((t) => t.date === day && counts(t));
    const allDone = tasks.every((t) => t.status === "done");
    const contiguous = prev == null || daysBetween(prev, day) <= 7;
    run = allDone && contiguous ? run + 1 : allDone ? 1 : 0;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

export function verifiedCount(goal) {
  return (goal?.tasks || []).filter((t) => t.status === "done" && t.proof && t.proof.type !== "check").length;
}

/** One cell per day for the consistency grid, oldest first. */
export function heatmap(goal, days = 119) {
  // Snap to a Monday so each column is a whole week and the rows are weekdays.
  const start = startOfWeek(addDays(today(), -(days - 1)));
  const byDay = new Map();
  for (const task of goal?.tasks || []) {
    if (task.date < start || task.date > today()) continue;
    if (!byDay.has(task.date)) byDay.set(task.date, []);
    byDay.get(task.date).push(task);
  }

  const cells = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const tasks = byDay.get(date) || [];
    const planned = tasks.filter(counts).length;
    const done = tasks.filter((t) => t.status === "done").length;
    let level = "0";
    if (planned && done === 0) level = "miss";
    else if (planned) level = done >= planned ? "3" : done / planned >= 0.5 ? "2" : "1";
    cells.push({ date, planned, done, level });
  }
  return cells;
}

export function phaseProgress(goal, phase) {
  const tasks = (goal?.tasks || []).filter((t) => t.phaseId === phase.id && counts(t));
  const done = tasks.filter((t) => t.status === "done").length;
  return { planned: tasks.length, done, rate: tasks.length ? done / tasks.length : 0 };
}

export function currentPhase(goal) {
  const now = today();
  return (goal?.plan?.phases || []).find((p) => now >= p.startDate && now <= p.endDate)
    || (goal?.plan?.phases || []).find((p) => p.endDate >= now)
    || (goal?.plan?.phases || []).at(-1)
    || null;
}
