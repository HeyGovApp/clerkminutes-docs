/**
 * Today — step 3 of the product, "Track & verify".
 *
 * The only screen most users see most days: what is due, proof that it
 * happened, and what it just earned back.
 */
import { el, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { today, addDays, formatLong, formatDay, weekdayIndex, WEEKDAYS, relativeDays, startOfWeek } from "../lib/date.js";
import { completeTask, undoTask, skipTask, moveTask, addTask, removeTask, tasksOn } from "../store.js";
import { currentStreak, goalProgress, currentPhase, weekBuckets } from "../stats.js";
import { money } from "../vesting.js";
import { ring, toast, captureProof, openModal, empty, VERIFY_LABELS } from "../ui.js";

export function todayView(goal, { profile, onNavigate, rerender }) {
  let selected = today();

  const root = el("div.view");
  const dayHost = el("div.day-strip");

  function render() {
    const dayTasks = tasksOn(goal, selected).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
    const done = dayTasks.filter((t) => t.status === "done").length;
    const counted = dayTasks.filter((t) => t.status !== "skipped").length;
    const progress = goalProgress(goal);
    const phase = currentPhase(goal);
    const streak = currentStreak(goal);
    const week = weekBuckets(goal).find((w) => w.weekKey === startOfWeek(today()));

    mount(root,
      hero({ goal, profile, done, counted, streak, phase, progress }),
      week && weekBanner(week, goal),
      el("div.row-between", { style: { margin: "var(--space-8) 0 var(--space-4)" } },
        el("div.stack-sm",
          el("h3", selected === today() ? "Today" : formatLong(selected)),
          el("p.muted", { style: { fontSize: "var(--text-sm)" } },
            counted ? `${done} of ${counted} done` : "Nothing scheduled — a rest day is part of the plan")),
        el("button.btn.btn-ghost.btn-sm", { type: "button", onClick: addCustom }, icon("plus"), "Add action")),
      dayStrip(),
      el("div.stack", { style: { marginTop: "var(--space-4)" } },
        ...(dayTasks.length
          ? dayTasks.map(taskRow)
          : [empty("calendar", "Nothing due", selected === today()
              ? "Recovery is part of the plan. Come back tomorrow — or add something if you're keen."
              : "No sessions were scheduled for this day.")])),
    );
  }

  /* ---------- pieces ---------- */

  function hero({ goal, profile, done, counted, streak, phase, progress }) {
    const pct = counted ? done / counted : (tasksOn(goal, today()).length ? 0 : 1);
    const greeting = profile?.name ? `Morning, ${profile.name.split(" ")[0]}.` : "Let's go.";
    return el("div.card.neon.today-hero",
      el("div.row-between", { style: { alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-6)" } },
        el("div", { style: { minWidth: "min(100%, 260px)", flex: "1" } },
          el("p.date", formatLong(today())),
          el("h1", greeting),
          el("p.goal-line", goal.title),
          el("div.row.wrap", { style: { marginTop: "var(--space-5)", gap: "var(--space-2)" } },
            phase && el("span.pill.gold", icon("focus"), `Phase ${phase.index} — ${phase.name}`),
            el("span.pill", icon("flame"), `${streak} day streak`),
            goal.stake.amount > 0 && el("span.pill.green", icon("wallet"), `${money(goal.stake.vested, goal.stake.currency)} vested`),
            el("span.pill", icon("calendar"), `${progress.daysLeft} days left`))),
        el("div.ring-wrap",
          ring(pct, { label: "of today done" }),
          el("div.stack-sm",
            el("div.ring-value", `${done}/${counted || 0}`),
            el("div.ring-label", "sessions today"),
            el("div.ring-label", `${Math.round(progress.adherence * 100)}% on plan overall`)))),
    );
  }

  function weekBanner(week, goal) {
    if (!goal.stake.amount) return null;
    const need = Math.ceil(week.planned * 0.8);
    const short = Math.max(0, need - week.done);
    const perWeek = (goal.stake.amount * 0.6) / (weekBuckets(goal).length || 1);
    return el("div.card.card-quiet", { style: { marginTop: "var(--space-4)", padding: "var(--space-4) var(--space-5)" } },
      el("div.row-between", { style: { flexWrap: "wrap" } },
        el("div.row", icon(short ? "wallet" : "verified", { class: short ? "" : "gold" }),
          el("p", { style: { fontSize: "var(--text-sm)" } },
            short
              ? el("span", `${short} more session${short === 1 ? "" : "s"} this week to vest `, el("b.gold", money(perWeek, goal.stake.currency)), ".")
              : el("span", "This week's ", el("b.gold", money(perWeek, goal.stake.currency)), " is secured. Anything more is a perfect week."))),
        el("button.btn.btn-quiet.btn-sm", { type: "button", onClick: () => onNavigate("vest") }, "See ledger", icon("arrowRight"))));
  }

  function dayStrip() {
    const days = Array.from({ length: 11 }, (_, i) => addDays(today(), i - 4));
    mount(dayHost, ...days.map((day) => {
      const tasks = tasksOn(goal, day);
      const counted = tasks.filter((t) => t.status !== "skipped");
      const done = tasks.filter((t) => t.status === "done").length;
      const cls = !counted.length ? "none" : done >= counted.length ? "full" : done ? "part" : "todo";
      return el("button.day-cell", { type: "button", "aria-pressed": day === selected,
        onClick: () => { selected = day; render(); } },
        el("span", WEEKDAYS[weekdayIndex(day)]),
        el("span.dn", formatDay(day, { day: "numeric" })),
        el(`span.dot.${cls}`));
    }));
    return dayHost;
  }

  function taskRow(task) {
    const meta = VERIFY_LABELS[task.verify] || VERIFY_LABELS.check;
    const isDone = task.status === "done";

    return el(`div.task${isDone ? ".is-done" : ""}${task.status === "missed" ? ".is-missed" : ""}`,
      el("button.task-check", {
        type: "button",
        "aria-label": isDone ? `Undo ${task.title}` : `Complete ${task.title}`,
        onClick: () => {
          if (isDone) { undoTask(goal.id, task.id); rerender(); return; }
          captureProof(task, (proof) => {
            completeTask(goal.id, task.id, proof);
            toast("Logged. That's the week moving.", "check");
            rerender();
          });
        },
      }, icon("check")),

      el("div.task-body",
        el("div.task-title", task.title),
        task.detail && el("div.task-detail", task.detail),
        el("div.task-meta",
          el("span.pill", icon(meta.icon), meta.label),
          task.minutes && el("span.pill", icon("clock"), `${task.minutes} min`),
          task.status === "missed" && el("span.pill.red", icon("warning"), "Missed"),
          task.status === "skipped" && el("span.pill", "Skipped")),
        isDone && task.proof && proofLine(task)),

      el("button.btn.btn-quiet.btn-sm", { type: "button", "aria-label": `Options for ${task.title}`, onClick: () => taskMenu(task) },
        icon("more", { strokeWidth: 2.6 })));
  }

  function proofLine(task) {
    const { proof } = task;
    if (proof.type === "photo" && proof.value) {
      return el("div.task-proof", el("img", { src: proof.value, alt: "Proof photo" }), el("span", "Photo verified"));
    }
    if (proof.type === "photo" && proof.shed) {
      return el("div.task-proof", icon("camera"), el("span", "Photo cleared to save space"));
    }
    const text = proof.type === "note" ? proof.value
      : proof.type === "timer" ? `${proof.value} minutes logged`
      : proof.type === "metric" ? `Logged: ${proof.value}`
      : "Self-verified";
    return el("div.task-proof", icon(VERIFY_LABELS[proof.type]?.icon || "check"), el("span", text));
  }

  function taskMenu(task) {
    const dialog = openModal({
      title: task.title,
      body: el("div.stack",
        task.detail && el("p.muted", { style: { fontSize: "var(--text-sm)" } }, task.detail),
        el("div.stack-sm",
          el("button.btn.btn-ghost.btn-block", { type: "button",
            onClick: () => { dialog.close(); moveTask(goal.id, task.id, addDays(task.date, 1)); toast("Moved to " + relativeDays(addDays(task.date, 1))); rerender(); } },
            icon("calendar"), "Move to tomorrow"),
          el("button.btn.btn-ghost.btn-block", { type: "button",
            onClick: () => { dialog.close(); skipDialog(task); } },
            icon("pause"), "Skip it — life happened"),
          task.custom && el("button.btn.btn-danger.btn-block", { type: "button",
            onClick: () => { dialog.close(); removeTask(goal.id, task.id); rerender(); } },
            icon("trash"), "Delete this action")),
        el("p.hint", "Skipped sessions don't count against your week. Missed ones do.")),
    });
  }

  function skipDialog(task) {
    const reason = el("input.input", { type: "text", placeholder: "Why? (optional, for your own record)" });
    const dialog = openModal({
      title: "Skip this session",
      body: el("div.stack",
        el("p.muted", { style: { fontSize: "var(--text-sm)" } },
          "A skip is honest and it's fine — it comes out of the week's denominator rather than counting as a miss. Use it when the session genuinely couldn't happen, not when you didn't fancy it."),
        el("div.field", reason)),
      actions: [
        el("button.btn.btn-quiet", { type: "button", onClick: () => dialog.close() }, "Cancel"),
        el("button.btn.btn-gold", { type: "button", onClick: () => { dialog.close(); skipTask(goal.id, task.id, reason.value); rerender(); } }, "Skip it"),
      ],
    });
  }

  function addCustom() {
    const title = el("input.input", { type: "text", placeholder: "What are you doing?" });
    const minutes = el("input.input", { type: "number", min: 5, max: 300, value: goal.minutesPerSession });
    const verify = el("select.select", ...Object.entries(VERIFY_LABELS).map(([key, v]) => el("option", { value: key }, v.label)));
    const dialog = openModal({
      title: "Add your own action",
      body: el("div.stack",
        el("div.field", el("label", "Action"), title),
        el("div.grid-2",
          el("div.field", el("label", "Minutes"), minutes),
          el("div.field", el("label", "How will you verify it?"), verify)),
        el("p.hint", `It'll be added to ${selected === today() ? "today" : formatDay(selected)} and counts toward this week.`)),
      actions: [
        el("button.btn.btn-quiet", { type: "button", onClick: () => dialog.close() }, "Cancel"),
        el("button.btn.btn-gold", { type: "button", onClick: () => {
          if (!title.value.trim()) { toast("Give it a name first", "warning"); return; }
          dialog.close();
          addTask(goal.id, { title: title.value, date: selected, minutes: minutes.value, verify: verify.value });
          rerender();
        } }, "Add it"),
      ],
    });
    setTimeout(() => title.focus());
  }

  render();
  return root;
}
