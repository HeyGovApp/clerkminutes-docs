/**
 * Vest — step 4, "Invest in yourself". The stake, what it has earned back,
 * what is still at risk, and every movement that got it there.
 */
import { el, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { formatShort } from "../lib/date.js";
import { money, WEEK_PASS, WEEKLY_SHARE, MILESTONE_SHARE } from "../vesting.js";
import { weekBuckets } from "../stats.js";
import { openModal, toast, sectionHead, empty } from "../ui.js";
import { getState, setStake } from "../store.js";

export function vestView(goal, { rerender }) {
  const root = el("div.view");
  const { stake } = goal;

  if (!stake.amount) return mount(root, noStake(goal, rerender));

  const pctVested = stake.vested / stake.amount;
  const pctRisk = stake.recoverable / stake.amount;
  const weeks = weekBuckets(goal);
  const perWeek = (stake.amount * WEEKLY_SHARE) / (weeks.length || 1);

  mount(root,
    el("div.view-head",
      el("p.eyebrow", "Invest in yourself"),
      el("h1", money(stake.vested, stake.currency), el("span.muted", { style: { fontSize: "var(--text-h3)" } }, ` of ${money(stake.amount, stake.currency)} earned back`)),
      el("p.sub", `${Math.round(pctVested * 100)}% vested · every session you complete moves this number.`)),

    el("div.card",
      el("div.vest-bar",
        el("div.seg.vested", { style: { width: `${pctVested * 100}%` } }),
        el("div.seg.risk", { style: { width: `${pctRisk * 100}%` } })),
      el("div.vest-legend", { style: { marginTop: "var(--space-4)" } },
        legend("var(--gold)", "Vested", money(stake.vested, stake.currency)),
        legend("rgba(234,103,27,0.5)", "At risk, recoverable", money(stake.recoverable, stake.currency)),
        legend("var(--surface-3)", "Still to earn", money(stake.remaining, stake.currency)))),

    el("div.grid-3", { style: { marginTop: "var(--space-6)" } },
      el("div.stat.is-gold", el("div.n", money(perWeek, stake.currency)), el("div.l", "Per week"), el("div.d", `Hit ${Math.round(WEEK_PASS * 100)}% of the week's sessions`)),
      el("div.stat", el("div.n", money((stake.amount * MILESTONE_SHARE) / (goal.plan.phases.length || 1), stake.currency)), el("div.l", "Per milestone"), el("div.d", `${goal.plan.phases.length} milestones in this plan`)),
      el("div.stat.is-green", el("div.n", `${weeks.filter((w) => w.state === "complete" && w.rate >= WEEK_PASS).length}`), el("div.l", "Weeks passed"), el("div.d", `of ${weeks.filter((w) => w.state === "complete").length} weeks finished`))),

    stake.recoverable > 0 && el("div.card.card-quiet", { style: { marginTop: "var(--space-6)" } },
      el("div.row", icon("refresh", { class: "gold" }),
        el("p", { style: { fontSize: "var(--text-sm)" } },
          el("b", money(stake.recoverable, stake.currency)), " is at risk but not gone. A week where you complete ",
          el("b", "every"), " session wins some of it back. Anything still here when the goal ends is forfeited."))),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("Ledger", "Every movement, oldest at the bottom."),
      stake.ledger.length
        ? el("div.card", { style: { padding: "var(--space-3)" } }, el("div.ledger", ...stake.ledger.map(ledgerRow(stake.currency))))
        : empty("wallet", "Nothing settled yet", "Your first week settles as soon as it ends.")),

    el("div.card.card-quiet", { style: { marginTop: "var(--space-8)" } },
      el("div.row", icon("warning", { class: "muted" }),
        el("p.muted", { style: { fontSize: "var(--text-xs)" } },
          "No payment is taken and no money moves — this is the vesting mechanic running on a local ledger. Wiring it to a real payment processor is the one piece that needs a backend."))),
  );

  return root;
}

function legend(color, label, value) {
  return el("span.k", el("span.sw", { style: { background: color } }), el("span", label), el("b", { style: { color: "var(--fg-1)" } }, value));
}

const LEDGER_ICONS = { vest: "check", recover: "refresh", milestone: "crown", risk: "warning" };

function ledgerRow(currency) {
  return (entry) => el("div.ledger-row",
    el("div.row", { style: { gap: "var(--space-3)" } },
      icon(LEDGER_ICONS[entry.type] || "wallet", { class: entry.amount < 0 ? "" : "gold" }),
      el("span", entry.label)),
    el("span.when", formatShort(entry.date)),
    el(`span.amt.${entry.amount < 0 ? "neg" : "pos"}`, `${entry.amount < 0 ? "−" : "+"}${money(Math.abs(entry.amount), currency)}`));
}

function noStake(goal, rerender) {
  return el("div.stack",
    el("div.view-head",
      el("p.eyebrow", "Invest in yourself"),
      el("h1", "No stake on this goal"),
      el("p.sub", "Real stakes, real motivation — people who put something on the line finish far more often.")),
    empty("wallet", "Add a stake", "Your money vests back to you week by week as you complete sessions.",
      el("button.btn.btn-gold", { type: "button", onClick: () => addStakeDialog(goal, rerender) }, icon("wallet"), "Put something on the line")));
}

function addStakeDialog(goal, rerender) {
  const amount = el("input.input", { type: "number", min: 5, max: 10000, step: 5, value: 100 });
  const dialog = openModal({
    title: "Put something on the line",
    body: el("div.stack",
      el("p.muted", { style: { fontSize: "var(--text-sm)" } },
        `${Math.round(WEEKLY_SHARE * 100)}% vests week by week, ${Math.round(MILESTONE_SHARE * 100)}% at milestones. Complete the plan and you get all of it back.`),
      el("div.field", el("label", `Stake (${getState().profile.currency || "GBP"})`), amount)),
    actions: [
      el("button.btn.btn-quiet", { type: "button", onClick: () => dialog.close() }, "Cancel"),
      el("button.btn.btn-gold", { type: "button", onClick: () => {
        const value = Number(amount.value);
        if (!(value > 0)) { toast("Pick an amount", "warning"); return; }
        dialog.close();
        setStake(goal.id, value, getState().profile.currency);
        toast("Stake set. It's yours to earn back.", "wallet");
        rerender();
      } }, "Set stake"),
    ],
  });
}
