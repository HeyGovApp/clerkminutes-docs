/**
 * Plan — step 2 made inspectable. The whole arc, why it looks like this, and
 * the controls that let it bend ("Adapts when life does") instead of breaking.
 */
import { el, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { today, formatShort, addDays, daysBetween } from "../lib/date.js";
import { adaptPlan, pauseGoal } from "../store.js";
import { phaseProgress, currentPhase, goalProgress } from "../stats.js";
import { money } from "../vesting.js";
import { openModal, toast, sectionHead } from "../ui.js";

export function planView(goal, { rerender }) {
  const root = el("div.view");
  const phase = currentPhase(goal);
  const progress = goalProgress(goal);

  mount(root,
    el("div.view-head",
      el("p.eyebrow", goal.plan.rationale ? "Your personalised plan" : "Plan"),
      el("h1", goal.title),
      el("p.sub", `${goal.plan.phases.length} phases · ${goal.tasks.length} actions · ${formatShort(goal.startDate)} → ${formatShort(goal.targetDate)}`)),

    el("div.grid-4", { style: { marginBottom: "var(--space-8)" } },
      tile(`${Math.round(progress.rate * 100)}%`, "Plan complete", "gold"),
      tile(`${progress.done}`, "Actions done"),
      tile(`${progress.weeksLeft}`, "Weeks remaining"),
      tile(phase ? phase.name : "—", "Current phase")),

    whyCard(goal),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("The arc", "Each phase ends in a milestone. Milestones release part of your stake.",
        el("button.btn.btn-ghost.btn-sm", { type: "button", onClick: () => adaptDialog(goal, rerender) }, icon("refresh"), "Adjust plan")),
      el("div", ...goal.plan.phases.map((p) => phaseBlock(goal, p)))),

    dangerZone(goal, rerender),
  );

  return root;
}

/** Cadence in words, because "0.75×/week" means nothing to anyone. */
function cadenceLabel(perWeek) {
  if (perWeek >= 1.6) return `${Math.round(perWeek)}×/week`;
  if (perWeek >= 0.95) return "every week";
  if (perWeek >= 0.45) return "most weeks";
  return "some weeks";
}

function tile(value, label, tone) {
  return el(`div.stat${tone ? `.is-${tone}` : ""}`, el("div.n", value), el("div.l", label));
}

function whyCard(goal) {
  if (!goal.plan.rationale?.length) return null;
  return el("div.card.neon", { style: { padding: "var(--space-6)" } },
    el("div.row", { style: { marginBottom: "var(--space-4)" } },
      icon("sparkle", { class: "gold" }),
      el("h3", "Why this plan")),
    el("ul", { style: { margin: 0, paddingLeft: "18px", display: "grid", gap: "8px", color: "var(--fg-2)", fontSize: "var(--text-sm)" } },
      ...goal.plan.rationale.map((line) => el("li", line))));
}

function phaseBlock(goal, phase) {
  const now = today();
  const state = phase.endDate < now ? "is-done" : phase.startDate <= now ? "is-current" : "";
  const progress = phaseProgress(goal, phase);
  const actions = goal.plan.actions.filter((a) => a.phaseId === phase.id);
  const ms = phase.milestone;

  return el(`div.phase.${state || "is-future"}`,
    el("div.phase-head",
      el("h3", `${String(phase.index).padStart(2, "0")} · ${phase.name}`),
      el("span.phase-weeks", `${phase.startWeek === phase.endWeek ? `week ${phase.startWeek}` : `weeks ${phase.startWeek}–${phase.endWeek}`} · ${formatShort(phase.startDate)}–${formatShort(phase.endDate)}`),
      progress.planned > 0 && el("span.pill", `${progress.done}/${progress.planned} done`)),
    el("p.phase-summary", phase.summary),

    el("div.stack-sm",
      ...actions.map((action) => el("div.action-line",
        icon(action.verify === "photo" ? "camera" : action.verify === "note" ? "note" : action.verify === "metric" ? "progress" : action.verify === "timer" ? "timer" : "check"),
        el("span.grow", action.title),
        el("span.cadence", cadenceLabel(action.perWeek))))),

    el("div.milestone",
      icon(ms.status === "reached" ? "verified" : ms.status === "missed" ? "warning" : "goal"),
      el("div",
        el("div.m-title", ms.title),
        el("div.m-meta", ms.status === "reached" ? "Reached" : ms.status === "missed" ? "Missed" : `Due ${formatShort(ms.dueDate)}`)),
      goal.stake.amount > 0 && el("div.m-amount", money(ms.amount || 0, goal.stake.currency))),
  );
}

/* ============================================================
   "Adapts when life does"
   ============================================================ */

function adaptDialog(goal, rerender) {
  const days = el("input", { type: "range", min: 1, max: 7, value: goal.daysPerWeek,
    onInput: (ev) => { daysOut.textContent = `${ev.target.value} days`; } });
  const daysOut = el("span.gold.mono", `${goal.daysPerWeek} days`);

  const mins = el("input", { type: "range", min: 10, max: 120, step: 5, value: goal.minutesPerSession,
    onInput: (ev) => { minsOut.textContent = `${ev.target.value} min`; } });
  const minsOut = el("span.gold.mono", `${goal.minutesPerSession} min`);

  const target = el("input.input", { type: "date", value: goal.targetDate, min: addDays(today(), 7) });
  const note = el("input.input", { type: "text", placeholder: "What changed? (optional)" });

  const dialog = openModal({
    title: "Adjust the plan",
    body: el("div.stack",
      el("p.muted", { style: { fontSize: "var(--text-sm)" } },
        "Everything you've already done stays exactly as it is. Only the sessions from today onward are rebuilt — and your vesting follows the new shape."),
      el("div.range-row", el("div.row-between", el("span.field-label", "Sessions per week"), daysOut), days),
      el("div.range-row", el("div.row-between", el("span.field-label", "Minutes per session"), minsOut), mins),
      el("div.field", el("label", "Target date"), target),
      el("div.field", note)),
    actions: [
      el("button.btn.btn-quiet", { type: "button", onClick: () => dialog.close() }, "Cancel"),
      el("button.btn.btn-gold", { type: "button", onClick: () => {
        if (daysBetween(today(), target.value) < 7) { toast("Give yourself at least a week", "warning"); return; }
        dialog.close();
        adaptPlan(goal.id, {
          daysPerWeek: Number(days.value),
          minutesPerSession: Number(mins.value),
          targetDate: target.value,
          note: note.value,
        });
        toast("Plan rebuilt from today", "refresh");
        rerender();
      } }, "Rebuild from today"),
    ],
  });
}

function dangerZone(goal, rerender) {
  const paused = goal.status === "paused";
  return el("div.card.card-quiet", { style: { marginTop: "var(--space-10)" } },
    el("div.row-between", { style: { flexWrap: "wrap" } },
      el("div.stack-sm",
        el("h4", paused ? "This goal is paused" : "Need to step away?"),
        el("p.muted", { style: { fontSize: "var(--text-sm)" } },
          paused
            ? "Nothing is counting against you while it's paused. Resume whenever you're ready."
            : "Pausing stops sessions counting as missed. Better an honest pause than a quiet abandonment.")),
      el("button.btn.btn-ghost", { type: "button",
        onClick: () => { pauseGoal(goal.id, !paused); toast(paused ? "Resumed" : "Paused"); rerender(); } },
        icon(paused ? "arrowRight" : "pause"), paused ? "Resume goal" : "Pause goal")));
}
