/**
 * Application state: one plain object, persisted to localStorage, with a
 * pub/sub so views re-render on change.
 *
 * Everything the app knows lives on the device. There is no backend and no
 * network call anywhere in this codebase — see README for what changes when a
 * server is added.
 */
import { uid } from "./lib/dom.js";
import { today } from "./lib/date.js";
import { buildPlan } from "./planner.js";
import { recomputeVesting } from "./vesting.js";

const STORAGE_KEY = "vestself.state.v1";
const SCHEMA_VERSION = 1;

function blankState() {
  return {
    version: SCHEMA_VERSION,
    profile: { name: "", currency: "GBP", partner: null, reminderTime: "08:00" },
    goals: [],
    activeGoalId: null,
    createdAt: new Date().toISOString(),
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (err) {
    console.warn("[vest self] could not read saved state, starting fresh:", err);
    return blankState();
  }
}

/** Future schema bumps land here; v1 is the first shape so this is a pass-through. */
function migrate(parsed) {
  if (!parsed || typeof parsed !== "object") return blankState();
  if (parsed.version !== SCHEMA_VERSION) {
    return { ...blankState(), ...parsed, version: SCHEMA_VERSION };
  }
  return parsed;
}

let saveFailed = false;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveFailed = false;
  } catch (err) {
    // Almost always the ~5MB quota, and almost always photo proof. Shed the
    // oldest images and retry once rather than losing the whole session.
    if (!saveFailed && shedOldestPhotos()) {
      saveFailed = true;
      persist();
      return;
    }
    console.warn("[vest self] could not save state:", err);
  }
}

function shedOldestPhotos() {
  const withPhotos = [];
  for (const goal of state.goals) {
    for (const task of goal.tasks) {
      if (task.proof?.type === "photo" && task.proof.value?.startsWith("data:")) withPhotos.push(task);
    }
  }
  if (!withPhotos.length) return false;
  withPhotos.sort((a, b) => (a.completedAt || "").localeCompare(b.completedAt || ""));
  for (const task of withPhotos.slice(0, Math.ceil(withPhotos.length / 3))) {
    task.proof = { ...task.proof, value: null, shed: true };
  }
  return true;
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  persist();
  for (const fn of listeners) fn(state);
}

/** Mutate through here so every write persists and notifies exactly once. */
function update(fn) {
  fn(state);
  commit();
}

/* ============================================================
   Selectors
   ============================================================ */

export function activeGoal() {
  return state.goals.find((g) => g.id === state.activeGoalId) || state.goals[0] || null;
}

export function goalById(id) {
  return state.goals.find((g) => g.id === id) || null;
}

export function tasksOn(goal, dayKey) {
  if (!goal) return [];
  return goal.tasks.filter((t) => t.date === dayKey);
}

export function tasksBetween(goal, fromKey, toKey) {
  if (!goal) return [];
  return goal.tasks.filter((t) => t.date >= fromKey && t.date <= toKey);
}

/* ============================================================
   Goal lifecycle
   ============================================================ */

/**
 * Turn an onboarding draft into a full goal: plan, dated tasks and a stake
 * schedule. The draft is what the user typed; everything else is derived.
 */
export function createGoal(draft) {
  const plan = buildPlan(draft);
  const goal = {
    id: uid("goal"),
    title: draft.title.trim(),
    category: plan.category,
    baseline: draft.baseline || "",
    success: draft.success || "",
    startDate: draft.startDate || today(),
    targetDate: draft.targetDate,
    daysPerWeek: draft.daysPerWeek,
    minutesPerSession: draft.minutesPerSession,
    preferredDays: draft.preferredDays,
    partner: draft.partner || null,
    stake: {
      amount: Number(draft.stakeAmount) || 0,
      currency: draft.currency || state.profile.currency || "GBP",
      vested: 0,
      atRisk: 0,
      recoverable: 0,
      ledger: [],
    },
    plan: { phases: plan.phases, actions: plan.actions, rationale: plan.rationale },
    tasks: plan.tasks,
    checkins: [],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  recomputeVesting(goal);

  update((s) => {
    s.goals.push(goal);
    s.activeGoalId = goal.id;
    if (draft.partner) s.profile.partner = draft.partner;
    if (draft.currency) s.profile.currency = draft.currency;
    if (draft.name) s.profile.name = draft.name;
  });

  return goal;
}

export function setActiveGoal(id) {
  update((s) => { s.activeGoalId = id; });
}

export function deleteGoal(id) {
  update((s) => {
    s.goals = s.goals.filter((g) => g.id !== id);
    if (s.activeGoalId === id) s.activeGoalId = s.goals[0]?.id || null;
  });
}

export function updateProfile(patch) {
  update((s) => { s.profile = { ...s.profile, ...patch }; });
}

/* ============================================================
   Tasks
   ============================================================ */

export function completeTask(goalId, taskId, proof) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    const task = goal?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.status = "done";
    task.completedAt = new Date().toISOString();
    task.proof = proof || { type: "check", value: null, at: task.completedAt };
    touch(goal);
  });
}

export function undoTask(goalId, taskId) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    const task = goal?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.status = "pending";
    task.completedAt = null;
    task.proof = null;
    touch(goal);
  });
}

export function skipTask(goalId, taskId, reason) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    const task = goal?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.status = "skipped";
    task.skipReason = reason || "";
    touch(goal);
  });
}

export function moveTask(goalId, taskId, newDate) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    const task = goal?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.date = newDate;
    task.movedFrom = task.movedFrom || task.date;
    task.status = "pending";
    touch(goal);
  });
}

export function addTask(goalId, { title, detail, date, minutes, verify }) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.tasks.push({
      id: uid("task"),
      date: date || today(),
      title: title.trim(),
      detail: detail || "",
      minutes: Number(minutes) || goal.minutesPerSession,
      verify: verify || "check",
      phaseId: phaseIdFor(goal, date || today()),
      status: "pending",
      custom: true,
      proof: null,
      completedAt: null,
    });
    touch(goal);
  });
}

export function removeTask(goalId, taskId) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.tasks = goal.tasks.filter((t) => t.id !== taskId);
    touch(goal);
  });
}

function phaseIdFor(goal, dateKey) {
  const phase = goal.plan.phases.find((p) => dateKey >= p.startDate && dateKey <= p.endDate);
  return phase?.id || goal.plan.phases.at(-1)?.id || null;
}

/**
 * "Adapts when life does" — the plan is not sacred. Ease the load, push the
 * date, or pause; future tasks are rebuilt and vesting follows.
 */
export function adaptPlan(goalId, { daysPerWeek, minutesPerSession, targetDate, preferredDays, note }) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) return;

    if (daysPerWeek) goal.daysPerWeek = daysPerWeek;
    if (minutesPerSession) goal.minutesPerSession = minutesPerSession;
    if (targetDate) goal.targetDate = targetDate;
    if (preferredDays?.length) goal.preferredDays = preferredDays;

    const from = today();
    const past = goal.tasks.filter((t) => t.date < from || t.status === "done");
    const rebuilt = buildPlan({
      title: goal.title,
      category: goal.category,
      baseline: goal.baseline,
      success: goal.success,
      startDate: from,
      targetDate: goal.targetDate,
      daysPerWeek: goal.daysPerWeek,
      minutesPerSession: goal.minutesPerSession,
      preferredDays: goal.preferredDays,
    });

    goal.plan.phases = mergePhases(goal.plan.phases, rebuilt.phases, from);
    goal.plan.actions = rebuilt.actions;
    goal.tasks = [...past, ...rebuilt.tasks.filter((t) => t.date >= from)];
    goal.adaptations = goal.adaptations || [];
    goal.adaptations.push({ at: new Date().toISOString(), note: note || "Plan adjusted", daysPerWeek: goal.daysPerWeek, targetDate: goal.targetDate });
    touch(goal);
  });
}

/** Keep history: phases already under way stay, future ones are replaced. */
function mergePhases(existing, rebuilt, fromKey) {
  const kept = existing.filter((p) => p.endDate < fromKey);
  return [...kept, ...rebuilt].map((p, i) => ({ ...p, index: i + 1 }));
}

export function pauseGoal(goalId, paused) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.status = paused ? "paused" : "active";
    touch(goal);
  });
}

/* ============================================================
   Partner / check-ins
   ============================================================ */

export function setStake(goalId, amount, currency) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.stake.amount = Math.max(0, Number(amount) || 0);
    if (currency) goal.stake.currency = currency;
    touch(goal);
  });
}

export function setPartner(goalId, partner) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    if (goal) goal.partner = partner;
    s.profile.partner = partner;
  });
}

export function logCheckin(goalId, { note, mood, sharedWith }) {
  update((s) => {
    const goal = s.goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.checkins.unshift({
      id: uid("chk"),
      at: new Date().toISOString(),
      date: today(),
      note: note || "",
      mood: mood || null,
      sharedWith: sharedWith || null,
    });
    touch(goal);
  });
}

/* ============================================================
   Housekeeping
   ============================================================ */

/**
 * Mark elapsed, untouched tasks as missed and re-run vesting. Called on load
 * and whenever a goal changes, so the ledger is always current.
 */
function touch(goal) {
  const now = today();
  for (const task of goal.tasks) {
    if (task.status === "pending" && task.date < now) task.status = "missed";
  }
  recomputeVesting(goal);
  goal.updatedAt = new Date().toISOString();
}

export function refreshAll() {
  update((s) => { for (const goal of s.goals) touch(goal); });
}

export function exportState() {
  return JSON.stringify(state, null, 2);
}

export function importState(json) {
  const parsed = JSON.parse(json);
  state = migrate(parsed);
  commit();
}

export function resetAll() {
  state = blankState();
  commit();
}
