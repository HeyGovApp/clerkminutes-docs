/**
 * vest self — app shell.
 *
 * Routing is a hash, state is one store, and every view is a function from
 * (goal, context) to a DOM node. A store change re-renders the current view.
 */
import { el, mount } from "./lib/dom.js";
import { icon, brandMark } from "./lib/icons.js";
import { today } from "./lib/date.js";
import { getState, subscribe, activeGoal, setActiveGoal, refreshAll, tasksOn } from "./store.js";
import { onboardingView } from "./views/onboarding.js";
import { todayView } from "./views/today.js";
import { planView } from "./views/plan.js";
import { vestView } from "./views/vest.js";
import { progressView } from "./views/progress.js";
import { partnerView } from "./views/partner.js";
import { settingsView } from "./views/settings.js";
import { openModal } from "./ui.js";

const ROUTES = [
  { key: "today",    label: "Today",    icon: "today" },
  { key: "plan",     label: "Plan",     icon: "plan" },
  { key: "vest",     label: "Vest",     icon: "vest" },
  { key: "progress", label: "Progress", icon: "progress" },
  { key: "partner",  label: "Partner",  icon: "partner" },
];

const root = document.getElementById("app");
let route = readRoute();

function readRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  return hash || "today";
}

function navigate(next) {
  route = next;
  location.hash = `/${next}`;
  render();
}

window.addEventListener("hashchange", () => {
  const next = readRoute();
  if (next !== route) { route = next; render(); }
});

function render() {
  const state = getState();
  const goal = activeGoal();

  // No goals yet, or explicitly starting another one: onboarding owns the screen.
  if (!goal || route === "new") {
    mount(root, onboardingView({
      allowCancel: Boolean(goal),
      onCancel: () => navigate("today"),
      onDone: () => navigate("today"),
    }));
    return;
  }

  const context = {
    profile: state.profile,
    onNavigate: navigate,
    rerender: render,
  };

  let view;
  switch (route) {
    case "plan":     view = planView(goal, context); break;
    case "vest":     view = vestView(goal, context); break;
    case "progress": view = progressView(goal, context); break;
    case "partner":  view = partnerView(goal, context); break;
    case "settings": view = settingsView(context); break;
    default:         view = todayView(goal, context); route = "today"; break;
  }

  mount(root, el("div.app", sidebar(state, goal), el("main.main", view)));
  document.title = `${goal.title} — vest self`;
}

function sidebar(state, goal) {
  const dueToday = tasksOn(goal, today()).filter((t) => t.status === "pending").length;

  return el("aside.sidebar",
    el("a.brand", { href: "#/today" },
      brandMark(32),
      el("span.brand-word", el("span.b", "vest"), " ", el("span.s", "self"))),

    el("nav.nav", { "aria-label": "Main" },
      ...ROUTES.map((item) => el("button.nav-item", {
        type: "button",
        class: route === item.key ? "active" : "",
        "aria-current": route === item.key ? "page" : null,
        onClick: () => navigate(item.key),
      }, icon(item.icon), el("span", item.label),
        item.key === "today" && dueToday > 0 && el("span.nav-badge", dueToday)))),

    el("div.sidebar-foot",
      state.goals.length > 1 && el("button.goal-switch", { type: "button", onClick: () => goalSwitcher(state) },
        el("span.gs-label", "Active goal"),
        el("span.gs-title", goal.title)),
      el("button.nav-item", { type: "button", class: route === "settings" ? "active" : "", onClick: () => navigate("settings") },
        icon("settings"), el("span", "Settings"))));
}

function goalSwitcher(state) {
  const dialog = openModal({
    title: "Switch goal",
    body: el("div.stack-sm",
      ...state.goals.map((goal) => el("button.btn.btn-ghost.btn-block", {
        type: "button",
        style: { justifyContent: "flex-start", textAlign: "left" },
        onClick: () => { dialog.close(); setActiveGoal(goal.id); navigate("today"); },
      }, goal.id === state.activeGoalId ? icon("check") : icon("goal"), goal.title)),
      el("button.btn.btn-gold.btn-block", { type: "button", onClick: () => { dialog.close(); navigate("new"); } }, icon("plus"), "Start another goal")),
  });
}

/* ---------- boot ---------- */

// Roll any elapsed pending sessions into "missed" and settle vesting before
// the first paint, so the numbers are honest the moment the app opens.
refreshAll();
subscribe(() => {});
render();

// A session left open overnight should notice the date has moved on.
let lastDay = today();
setInterval(() => {
  if (today() !== lastDay) { lastDay = today(); refreshAll(); render(); }
}, 60_000);
