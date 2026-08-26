/**
 * Settings — profile, the goals you're running, and your data.
 */
import { el, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { formatShort } from "../lib/date.js";
import { getState, updateProfile, setActiveGoal, deleteGoal, exportState, importState, resetAll } from "../store.js";
import { goalProgress } from "../stats.js";
import { money } from "../vesting.js";
import { sectionHead, toast, confirmModal } from "../ui.js";

export function settingsView({ onNavigate, rerender }) {
  const state = getState();
  const root = el("div.view");

  mount(root,
    el("div.view-head",
      el("p.eyebrow", "Settings"),
      el("h1", "Your setup")),

    el("div.card",
      sectionHead("You", "Used for greetings and the digest signature."),
      el("div.grid-2",
        el("div.field",
          el("label", "Name"),
          el("input.input", { type: "text", value: state.profile.name || "", placeholder: "Your name",
            onChange: (ev) => { updateProfile({ name: ev.target.value.trim() }); toast("Saved"); } })),
        el("div.field",
          el("label", "Currency"),
          el("select.select", { onChange: (ev) => { updateProfile({ currency: ev.target.value }); toast("Saved"); rerender(); } },
            ...["GBP", "USD", "EUR", "AUD", "CAD"].map((c) => el("option", { value: c, selected: c === state.profile.currency }, c)))))),

    el("div", { style: { marginTop: "var(--space-8)" } },
      sectionHead("Your goals", `${state.goals.length} in flight`,
        el("button.btn.btn-gold.btn-sm", { type: "button", onClick: () => onNavigate("new") }, icon("plus"), "New goal")),
      el("div.stack", ...state.goals.map((goal) => goalRow(goal, rerender)))),

    el("div", { style: { marginTop: "var(--space-8)" } },
      sectionHead("Your data", "Everything lives in this browser. Nothing is uploaded."),
      el("div.card.stack",
        el("div.row.wrap",
          el("button.btn.btn-ghost", { type: "button", onClick: doExport }, icon("download"), "Export"),
          el("button.btn.btn-ghost", { type: "button", onClick: () => doImport(rerender) }, icon("inbox"), "Import"),
          el("button.btn.btn-danger", { type: "button", onClick: () => confirmModal({
            title: "Erase everything?",
            message: "Every goal, plan, session and ledger entry on this device is deleted. This cannot be undone.",
            confirmLabel: "Erase everything", danger: true,
            onConfirm: () => { resetAll(); toast("All data erased"); rerender(); },
          }) }, icon("trash"), "Erase all")),
        el("p.hint", "Clearing your browser's site data will also erase it — export first if you care about it."))),

    el("div.card.card-quiet", { style: { marginTop: "var(--space-8)" } },
      el("div.stack-sm",
        el("h4", "What's real and what isn't"),
        el("p.muted", { style: { fontSize: "var(--text-sm)" } },
          "The plan, the tracking, the verification, the vesting maths and the sharing all work for real. What's simulated is money movement — no payment is taken, and the digest isn't emailed to your partner. Both need a server; see the README."))),
  );

  return root;
}

function goalRow(goal, rerender) {
  const state = getState();
  const progress = goalProgress(goal);
  const active = state.activeGoalId === goal.id;

  return el(`div.card${active ? "" : ".card-quiet"}`, { style: { padding: "var(--space-5)" } },
    el("div.row-between", { style: { flexWrap: "wrap", gap: "var(--space-4)" } },
      el("div.stack-sm.grow",
        el("div.row.wrap", { style: { gap: "var(--space-2)" } },
          el("h4", goal.title),
          active && el("span.pill.gold", "Active"),
          goal.status === "paused" && el("span.pill.orange", "Paused")),
        el("p.muted", { style: { fontSize: "var(--text-xs)" } },
          `${goal.plan.phases.length} phases · ${progress.done}/${progress.planned} done · target ${formatShort(goal.targetDate)}`,
          goal.stake.amount ? ` · ${money(goal.stake.vested, goal.stake.currency)} of ${money(goal.stake.amount, goal.stake.currency)} vested` : "")),
      el("div.row",
        !active && el("button.btn.btn-ghost.btn-sm", { type: "button", onClick: () => { setActiveGoal(goal.id); toast("Switched"); rerender(); } }, "Switch to"),
        el("button.btn.btn-quiet.btn-sm", { type: "button", "aria-label": `Delete ${goal.title}`,
          onClick: () => confirmModal({
            title: "Delete this goal?",
            message: `"${goal.title}" and all ${goal.tasks.length} of its actions will be removed. This cannot be undone.`,
            confirmLabel: "Delete goal", danger: true,
            onConfirm: () => { deleteGoal(goal.id); toast("Goal deleted"); rerender(); },
          }) }, icon("trash")))));
}

function doExport() {
  const blob = new Blob([exportState()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: `vest-self-export-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Exported", "download");
}

function doImport(rerender) {
  const input = el("input", { type: "file", accept: "application/json", style: { display: "none" },
    onChange: async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      try {
        importState(await file.text());
        toast("Imported");
        rerender();
      } catch {
        toast("That file could not be read", "warning");
      }
    } });
  document.body.appendChild(input);
  input.click();
  setTimeout(() => input.remove(), 1000);
}
