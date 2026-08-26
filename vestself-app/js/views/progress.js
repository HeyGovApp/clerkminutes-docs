/**
 * Progress — "Progress you can prove". Consistency over time, weekly rates,
 * what the stake has done, and the evidence wall of verified sessions.
 */
import { el, svg, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { formatShort, formatDay, today } from "../lib/date.js";
import { weekBuckets, goalProgress, currentStreak, bestStreak, verifiedCount, phaseProgress, heatmap } from "../stats.js";
import { money, WEEK_PASS } from "../vesting.js";
import { sectionHead, empty, openModal } from "../ui.js";

export function progressView(goal) {
  const root = el("div.view");
  const progress = goalProgress(goal);
  const weeks = weekBuckets(goal);
  const settled = weeks.filter((w) => w.state !== "future");

  mount(root,
    el("div.view-head",
      el("p.eyebrow", "Progress you can prove"),
      el("h1", `${Math.round(progress.adherence * 100)}% on plan`),
      el("p.sub", `${progress.done} of ${progress.planned} actions complete · ${progress.weeksLeft} weeks to go`)),

    el("div.grid-4",
      el("div.stat.is-gold", el("div.n", currentStreak(goal)), el("div.l", "Day streak"), el("div.d", `Best: ${bestStreak(goal)}`)),
      el("div.stat", el("div.n", progress.done), el("div.l", "Sessions done"), el("div.d", `${progress.missed} missed`)),
      el("div.stat.is-green", el("div.n", verifiedCount(goal)), el("div.l", "Verified with proof"), el("div.d", "Photo, note, time or number")),
      el("div.stat.is-blue", el("div.n", `${settled.filter((w) => w.rate >= WEEK_PASS).length}/${settled.length}`), el("div.l", "Weeks passed"), el("div.d", `${Math.round(WEEK_PASS * 100)}% or better`))),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("Consistency", "One square per day for the last 17 weeks. Gold is a day you finished."),
      el("div.card", heatGrid(goal))),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("Week by week", `Bars below ${Math.round(WEEK_PASS * 100)}% didn't vest.`),
      el("div.card", weekChart(weeks))),

    goal.stake.amount > 0 && el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("Money earned back", "Cumulative vesting across the plan."),
      el("div.card", vestChart(goal))),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("By phase", "Where the work actually landed."),
      el("div.card.stack", ...goal.plan.phases.map((phase) => phaseBar(goal, phase)))),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("The evidence", "Everything you've proved, most recent first."),
      evidenceWall(goal)),
  );

  return root;
}

/* ---------- consistency grid ---------- */

function heatGrid(goal) {
  const cells = heatmap(goal, 119);
  const grid = el("div.heatmap");
  for (const cell of cells) {
    grid.appendChild(el("div.heat-cell", {
      dataset: { level: cell.level },
      title: cell.planned ? `${formatDay(cell.date)} — ${cell.done}/${cell.planned} done` : `${formatDay(cell.date)} — rest day`,
    }));
  }
  return el("div.stack",
    grid,
    el("div.vest-legend", { style: { marginTop: "var(--space-4)" } },
      legendSwatch("rgba(255,252,245,0.05)", "Rest"),
      legendSwatch("rgba(229,72,77,0.3)", "Missed"),
      legendSwatch("rgba(230,193,90,0.28)", "Partial"),
      legendSwatch("var(--gold)", "Complete")));
}

function legendSwatch(color, label) {
  return el("span.k", el("span.sw", { style: { background: color } }), el("span", label));
}

/* ---------- weekly bars ---------- */

function weekChart(weeks) {
  const shown = weeks.slice(0, 26);
  if (!shown.length) return empty("progress", "No weeks yet", "Your first week appears here as soon as it starts.");

  const W = 720, H = 220, pad = { top: 12, right: 8, bottom: 28, left: 34 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const barW = Math.max(6, (plotW / shown.length) * 0.62);

  const bars = shown.map((week, i) => {
    const x = pad.left + (plotW / shown.length) * (i + 0.5) - barW / 2;
    const h = Math.max(2, week.rate * plotH);
    const passed = week.rate >= WEEK_PASS;
    return svg("g", {},
      svg("rect", {
        class: `bar${passed ? "" : " low"}`, x, y: pad.top + plotH - h, width: barW, height: h, rx: 3,
        opacity: week.state === "future" ? 0.25 : 1,
      }, svg("title", {}, `Week ${week.index} — ${week.done}/${week.planned} (${Math.round(week.rate * 100)}%)`)),
      i % Math.ceil(shown.length / 8) === 0 && svg("text", { class: "axis-label", x: x + barW / 2, y: H - 8, "text-anchor": "middle" }, `W${week.index}`),
    );
  });

  return svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Weekly completion rate" },
    ...[0, 0.5, WEEK_PASS, 1].map((v) => svg("g", {},
      svg("line", { class: "grid-line", x1: pad.left, x2: W - pad.right, y1: pad.top + plotH * (1 - v), y2: pad.top + plotH * (1 - v),
        "stroke-dasharray": v === WEEK_PASS ? "4 4" : "", stroke: v === WEEK_PASS ? "rgba(230,193,90,0.45)" : "" }),
      svg("text", { class: "axis-label", x: 4, y: pad.top + plotH * (1 - v) + 3 }, `${Math.round(v * 100)}`))),
    ...bars);
}

/* ---------- cumulative vesting ---------- */

function vestChart(goal) {
  const entries = [...goal.stake.ledger].reverse();
  if (!entries.length) return empty("wallet", "Nothing settled yet", "The first movement appears once a week ends.");

  const points = [];
  let running = 0;
  for (const entry of entries) {
    running = Math.max(0, running + (entry.type === "risk" ? 0 : entry.amount));
    points.push({ date: entry.date, value: running });
  }

  const W = 720, H = 200, pad = { top: 12, right: 10, bottom: 26, left: 44 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const max = Math.max(goal.stake.amount, ...points.map((p) => p.value)) || 1;
  const x = (i) => pad.left + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v) => pad.top + plotH * (1 - v / max);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(pad.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + plotH).toFixed(1)} Z`;

  return svg("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cumulative amount vested" },
    svg("defs", {}, svg("linearGradient", { id: "areaGold", x1: "0", y1: "0", x2: "0", y2: "1" },
      svg("stop", { offset: "0", "stop-color": "#E6C15A", "stop-opacity": "0.35" }),
      svg("stop", { offset: "1", "stop-color": "#E6C15A", "stop-opacity": "0" }))),
    ...[0, 0.5, 1].map((v) => svg("g", {},
      svg("line", { class: "grid-line", x1: pad.left, x2: W - pad.right, y1: y(max * v), y2: y(max * v) }),
      svg("text", { class: "axis-label", x: 4, y: y(max * v) + 3 }, money(max * v, goal.stake.currency)))),
    svg("path", { class: "area", d: area }),
    svg("path", { class: "line", d: line }),
    ...points.map((p, i) => svg("circle", { cx: x(i), cy: y(p.value), r: 3, fill: "#FFC919" },
      svg("title", {}, `${formatShort(p.date)} — ${money(p.value, goal.stake.currency)}`))));
}

/* ---------- phase bars ---------- */

function phaseBar(goal, phase) {
  const p = phaseProgress(goal, phase);
  const state = phase.endDate < today() ? "done" : phase.startDate <= today() ? "current" : "future";
  return el("div.stack-sm",
    el("div.row-between",
      el("span", { style: { fontSize: "var(--text-sm)", fontWeight: 600 } },
        `${String(phase.index).padStart(2, "0")} · ${phase.name}`,
        state === "current" ? el("span.pill.gold", { style: { marginLeft: "8px" } }, "Now") : null),
      el("span.muted.mono", { style: { fontSize: "var(--text-xs)" } }, `${p.done}/${p.planned}`)),
    el("div.vest-bar", { style: { height: "8px" } },
      el("div.seg.vested", { style: { width: `${p.rate * 100}%`, opacity: state === "future" ? 0.35 : 1 } })));
}

/* ---------- evidence ---------- */

function evidenceWall(goal) {
  const proved = goal.tasks
    .filter((t) => t.status === "done" && t.proof && t.proof.type !== "check")
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))
    .slice(0, 24);

  if (!proved.length) {
    return empty("camera", "No proof yet", "Sessions that ask for a photo, a note, a time or a number show up here once you log them.");
  }

  return el("div.grid-3", ...proved.map((task) => {
    const photo = task.proof.type === "photo" && task.proof.value;
    return el("button.card.card-quiet", {
      type: "button", style: { padding: "var(--space-4)", textAlign: "left", cursor: "pointer" },
      onClick: () => openModal({
        title: task.title,
        body: el("div.stack",
          photo && el("img.proof-preview", { src: task.proof.value, alt: "Proof" }),
          el("p.muted", { style: { fontSize: "var(--text-sm)" } }, task.detail),
          el("p", proofText(task)),
          el("p.hint", formatDay(task.date))),
      }),
    },
      photo
        ? el("img", { src: photo, alt: "", style: { width: "100%", height: "110px", objectFit: "cover", borderRadius: "var(--radius-sm)", marginBottom: "var(--space-3)" } })
        : el("div.row", { style: { marginBottom: "var(--space-3)" } }, icon(task.proof.type === "note" ? "note" : task.proof.type === "timer" ? "timer" : "progress", { class: "gold" })),
      el("div", { style: { fontSize: "var(--text-sm)", fontWeight: 600 } }, task.title),
      el("div.muted", { style: { fontSize: "var(--text-xs)", marginTop: "4px" } }, `${formatShort(task.date)} · ${proofText(task)}`));
  }));
}

function proofText(task) {
  const { proof } = task;
  if (!proof) return "";
  if (proof.type === "note") return proof.value || "Note logged";
  if (proof.type === "timer") return `${proof.value} min`;
  if (proof.type === "metric") return proof.value || "Logged";
  if (proof.type === "photo") return proof.value ? "Photo" : "Photo (cleared)";
  return "Verified";
}
