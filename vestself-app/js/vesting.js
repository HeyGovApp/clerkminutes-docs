/**
 * The stake. "Put something on the line and earn 100% of your money back as
 * you progress."
 *
 * How it works:
 *   · 60% of the stake vests week by week — hit ≥80% of a week's sessions and
 *     that week's share is yours.
 *   · 40% vests on milestones, one tranche per phase.
 *   · A missed week doesn't burn the money immediately; it moves to a
 *     recoverable pool. A following week at 100% wins a share of it back.
 *     What's still in the pool when the goal ends is forfeited.
 *
 * The forgiving middle step is deliberate: a single bad week is the most
 * common point of abandonment, and a plan that punishes it permanently gets
 * deleted rather than resumed.
 *
 * Money that has already been earned never goes down. Whether a week passed is
 * always derived from the tasks, so it stays honest — but a week's *share* of
 * the stake is fixed the first time that week settles. Without that, adjusting
 * the plan (which changes how many weeks and phases the stake divides across)
 * would quietly re-divide money the user had already earned, which is exactly
 * what "adapts when life does" is supposed to rule out. The pass/fail decision
 * itself is never frozen: undo the work and the money goes back at risk.
 *
 * NOTE: no money moves anywhere. This is a local ledger — see README,
 * "What is simulated".
 */
import { today } from "./lib/date.js";
import { weekBuckets, phaseProgress } from "./stats.js";

export const WEEKLY_SHARE = 0.6;
export const MILESTONE_SHARE = 0.4;
export const WEEK_PASS = 0.8;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Recompute the whole ledger from scratch on every change. Cheap (a plan is
 * hundreds of tasks, not millions) and it means the ledger can never drift
 * from the tasks it describes.
 *
 * @param {object} goal mutated in place
 */
export function recomputeVesting(goal) {
  const amount = Number(goal?.stake?.amount) || 0;
  const weeks = weekBuckets(goal);
  const phases = goal?.plan?.phases || [];

  const ledger = [];
  const awards = goal.stake?.awards ? { ...goal.stake.awards } : {};
  let vested = 0;
  let recoverable = 0;

  /**
   * A week's (or milestone's) share of the stake is fixed the first time it
   * settles, and never re-divided afterwards.
   */
  const freeze = (key, amount) => {
    if (awards[key] == null) awards[key] = amount;
    return awards[key];
  };

  if (amount > 0 && weeks.length) {
    const perWeek = round2((amount * WEEKLY_SHARE) / weeks.length);
    const perMilestone = phases.length ? round2((amount * MILESTONE_SHARE) / phases.length) : 0;

    for (const week of weeks) {
      if (week.state === "future") continue;
      if (week.state === "current") {
        // Only settle the current week once its sessions have all resolved.
        if (week.tasks.some((t) => t.status === "pending")) continue;
      }
      if (!week.planned) continue;

      const share = freeze(`week:${week.weekKey}`, perWeek);

      if (week.rate >= WEEK_PASS) {
        vested += share;
        ledger.push({
          id: `w-${week.weekKey}`, date: week.weekKey, type: "vest",
          label: `Week ${week.index} — ${week.done}/${week.planned} sessions`,
          amount: share,
        });

        // A perfect week claws back from the recoverable pool.
        if (week.rate === 1 && recoverable > 0) {
          const won = Math.min(recoverable, share);
          recoverable = round2(recoverable - won);
          vested += won;
          ledger.push({
            id: `r-${week.weekKey}`, date: week.weekKey, type: "recover",
            label: "Perfect week — recovered from at-risk",
            amount: won,
          });
        }
      } else {
        recoverable = round2(recoverable + share);
        ledger.push({
          id: `m-${week.weekKey}`, date: week.weekKey, type: "risk",
          label: `Week ${week.index} — ${week.done}/${week.planned} sessions, below ${Math.round(WEEK_PASS * 100)}%`,
          amount: -share,
        });
      }
    }

    for (const phase of phases) {
      const progress = phaseProgress(goal, phase);
      const due = phase.milestone.dueDate;
      const reached = progress.rate >= WEEK_PASS && (due <= today() || progress.rate === 1);

      phase.milestone.status = reached ? "reached" : due < today() ? "missed" : "pending";

      if (phase.milestone.status === "pending") {
        phase.milestone.amount = perMilestone;
        continue;
      }

      const share = freeze(`milestone:${phase.milestone.id}`, perMilestone);
      phase.milestone.amount = share;

      if (reached) {
        vested += share;
        ledger.push({
          id: `ms-${phase.milestone.id}`, date: due, type: "milestone",
          label: `Milestone — ${phase.milestone.title}`,
          amount: share,
        });
      } else {
        recoverable = round2(recoverable + share);
        ledger.push({
          id: `msm-${phase.milestone.id}`, date: due, type: "risk",
          label: `Milestone missed — ${phase.milestone.title}`,
          amount: -share,
        });
      }
    }
  }

  vested = round2(Math.min(amount, Math.max(0, vested)));
  recoverable = round2(Math.max(0, Math.min(amount - vested, recoverable)));

  goal.stake = {
    ...goal.stake,
    amount,
    awards,
    vested,
    recoverable,
    remaining: round2(Math.max(0, amount - vested - recoverable)),
    ledger: ledger.sort((a, b) => (a.date < b.date ? 1 : -1)),
  };

  return goal.stake;
}

const SYMBOLS = { GBP: "£", USD: "$", EUR: "€", AUD: "A$", CAD: "C$" };

export function currencySymbol(code) {
  return SYMBOLS[code] || "";
}

export function money(amount, currency = "GBP") {
  const value = Number(amount) || 0;
  const whole = Math.abs(value % 1) < 0.005;
  return `${currencySymbol(currency)}${value.toLocaleString(undefined, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
