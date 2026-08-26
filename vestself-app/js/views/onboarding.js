/**
 * Onboarding — steps 1 and 2 of the product: "Set your goal" and
 * "Get your personalised plan".
 *
 * Everything the planner needs is asked for here, in the order a person can
 * actually answer it: what, from where, by when, how much time, what's at
 * stake, who's watching.
 */
import { el, mount } from "../lib/dom.js";
import { icon, brandMark } from "../lib/icons.js";
import { today, addDays, formatShort, daysBetween } from "../lib/date.js";
import { createGoal } from "../store.js";
import { detectCategory, CATEGORIES, estimateWeeks } from "../planner.js";
import { money, currencySymbol, WEEKLY_SHARE, MILESTONE_SHARE } from "../vesting.js";
import { toast } from "../ui.js";

const EXAMPLES = [
  "I want to run a marathon",
  "I want to launch my own business",
  "I want to write my first novel",
  "I want to lose 8 kg and keep it off",
  "I want to speak Spanish confidently",
  "I want to save £5,000",
];

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function onboardingView({ onDone, allowCancel = false, onCancel } = {}) {
  const draft = {
    title: "",
    category: "auto",
    baseline: "some",
    success: "",
    startDate: today(),
    targetDate: addDays(today(), 84),
    daysPerWeek: 4,
    minutesPerSession: 45,
    preferredDays: [0, 2, 4],
    stakeAmount: 100,
    currency: "GBP",
    partner: null,
  };

  let step = 0;
  const root = el("div.onboard");
  const shell = el("div.onboard-shell");
  root.appendChild(shell);

  const STEPS = [welcomeStep, goalStep, startingStep, timelineStep, availabilityStep, stakeStep, partnerStep];

  function go(next) {
    step = Math.max(0, Math.min(STEPS.length - 1, next));
    render();
  }

  function render() {
    mount(shell,
      el("div.onboard-brand", brandMark(30), el("span.brand-word", el("span.b", "vest"), " ", el("span.s", "self"))),
      step > 0 && el("div.progress-rail",
        ...STEPS.slice(1).map((_, i) => el("span", { class: i < step ? "done" : "" }))),
      STEPS[step](),
    );
    shell.querySelector("input, textarea, button.chip")?.focus?.();
  }

  /* ---------- step 0: welcome ---------- */
  function welcomeStep() {
    return el("div.card.neon.step-card",
      el("p.eyebrow.step-eyebrow", "Founding member"),
      el("h1.hero-line", "Invest in your ", el("span.t-gradient", "best self"), "."),
      el("p", { style: { color: "var(--fg-2)", margin: "var(--space-4) 0 var(--space-6)", maxWidth: "46ch" } },
        "Tell us what you want to achieve. We'll turn it into a plan with dated actions, proof of progress, and real money on the line."),
      el("div.row.wrap", { style: { gap: "var(--space-3)" } },
        el("span.pill.gold", icon("sparkle"), "Personalised plan"),
        el("span.pill", icon("verified"), "Verified progress"),
        el("span.pill", icon("wallet"), "Real stakes")),
      el("div.step-actions",
        allowCancel ? el("button.btn.btn-quiet", { type: "button", onClick: () => onCancel?.() }, "Cancel") : el("span"),
        el("button.btn.btn-gold.btn-lg", { type: "button", onClick: () => go(1) }, "Set your goal", icon("arrowRight"))),
    );
  }

  /* ---------- step 1: the goal ---------- */
  function goalStep() {
    const field = el("textarea.textarea", {
      placeholder: "I want to…",
      value: draft.title,
      maxlength: 140,
      onInput: (ev) => { draft.title = ev.target.value; next.disabled = draft.title.trim().length < 4; syncDetected(); },
    });
    const label = () => {
      const key = draft.category === "auto" ? detectCategory(draft.title) : draft.category;
      return draft.title.trim().length < 4 ? "" : `Read as: ${CATEGORIES.find((c) => c.key === key)?.label || key}`;
    };
    const detected = el("span.pill.gold", label());
    const detectedRow = el("div.row", { style: { minHeight: "26px" } }, detected);
    const syncDetected = () => { detected.textContent = label(); detected.style.visibility = label() ? "visible" : "hidden"; };
    const next = el("button.btn.btn-gold", { type: "button", disabled: draft.title.trim().length < 4, onClick: () => go(2) }, "Continue", icon("arrowRight"));
    setTimeout(syncDetected);

    return step_(
      "Step 01", "Set your goal", "One sentence. The version you'd say out loud to someone who'd hold you to it.",
      el("div.stack",
        el("div.field", field),
        el("div.row.wrap", { style: { gap: "6px" } },
          ...EXAMPLES.map((example) => el("button.chip", { type: "button",
            onClick: () => { draft.title = example; field.value = example; next.disabled = false; syncDetected(); } }, example))),
        detectedRow,
      ),
      [el("button.btn.btn-quiet", { type: "button", onClick: () => go(0) }, icon("arrowLeft"), "Back"), next]);
  }

  /* ---------- step 2: starting point ---------- */
  function startingStep() {
    const levels = [
      ["new", "Starting from scratch", "I've not really done this before."],
      ["some", "Some experience", "I've done bits of it, on and off."],
      ["experienced", "Experienced", "I know what I'm doing — I just don't do it consistently."],
    ];
    const buttons = levels.map(([key, title, sub]) =>
      el("button.chip", { type: "button", "aria-pressed": draft.baseline === key, style: { padding: "var(--space-4)" },
        onClick: (ev) => {
          draft.baseline = key;
          for (const b of ev.currentTarget.parentElement.children) b.setAttribute("aria-pressed", "false");
          ev.currentTarget.setAttribute("aria-pressed", "true");
        } },
        el("div", { style: { fontWeight: 700, color: "var(--fg-1)" } }, title),
        el("div", { style: { fontSize: "var(--text-xs)", color: "var(--fg-3)" } }, sub)));

    const success = el("input.input", { type: "text", value: draft.success,
      placeholder: "e.g. Cross the finish line under 4 hours",
      onInput: (ev) => { draft.success = ev.target.value; } });

    return step_(
      "Step 02", "Where are you starting?", "The plan is built from here, not from where you wish you were.",
      el("div.stack",
        el("div.stack-sm", { style: { gap: "var(--space-2)" } }, ...buttons),
        el("div.field",
          el("label", "What does success look like?"),
          success,
          el("p.hint", "Optional, but a specific finish line is much harder to argue with."))),
      [el("button.btn.btn-quiet", { type: "button", onClick: () => go(1) }, icon("arrowLeft"), "Back"),
       el("button.btn.btn-gold", { type: "button", onClick: () => go(3) }, "Continue", icon("arrowRight"))]);
  }

  /* ---------- step 3: timeline ---------- */
  function timelineStep() {
    const presets = [[42, "6 weeks"], [84, "12 weeks"], [182, "6 months"], [365, "A year"]];
    const dateInput = el("input.input", { type: "date", value: draft.targetDate, min: addDays(today(), 7),
      onInput: (ev) => { if (ev.target.value) { draft.targetDate = ev.target.value; sync(); } } });
    const readout = el("p.hint");
    const sync = () => {
      const weeks = estimateWeeks(draft.startDate, draft.targetDate);
      readout.textContent = `${weeks} week${weeks === 1 ? "" : "s"} from today — target ${formatShort(draft.targetDate)}.`;
      dateInput.value = draft.targetDate;
      for (const b of chips) b.setAttribute("aria-pressed", String(b.dataset.days === String(daysBetween(today(), draft.targetDate))));
    };
    const chips = presets.map(([days, label]) => el("button.chip", { type: "button", dataset: { days },
      onClick: () => { draft.targetDate = addDays(today(), days); sync(); } }, label));

    setTimeout(sync);
    return step_(
      "Step 03", "By when?", "A deadline is what turns a wish into a plan. Pick one you'd be embarrassed to miss.",
      el("div.stack",
        el("div.row.wrap", { style: { gap: "6px" } }, ...chips),
        el("div.field", el("label", "Target date"), dateInput, readout)),
      [el("button.btn.btn-quiet", { type: "button", onClick: () => go(2) }, icon("arrowLeft"), "Back"),
       el("button.btn.btn-gold", { type: "button", onClick: () => go(4) }, "Continue", icon("arrowRight"))]);
  }

  /* ---------- step 4: availability ---------- */
  function availabilityStep() {
    const daysOut = el("span.gold.mono", `${draft.daysPerWeek} days`);
    const minsOut = el("span.gold.mono", `${draft.minutesPerSession} min`);

    const days = el("input", { type: "range", min: 1, max: 7, value: draft.daysPerWeek,
      onInput: (ev) => { draft.daysPerWeek = Number(ev.target.value); daysOut.textContent = `${draft.daysPerWeek} days`; } });
    const mins = el("input", { type: "range", min: 10, max: 120, step: 5, value: draft.minutesPerSession,
      onInput: (ev) => { draft.minutesPerSession = Number(ev.target.value); minsOut.textContent = `${draft.minutesPerSession} min`; } });

    const dayToggles = WEEKDAY_LABELS.map((letter, i) =>
      el("button.chip", { type: "button", "aria-pressed": draft.preferredDays.includes(i),
        "aria-label": WEEKDAY_NAMES[i], title: WEEKDAY_NAMES[i],
        style: { width: "44px", textAlign: "center", padding: "10px 0" },
        onClick: (ev) => {
          const on = draft.preferredDays.includes(i);
          draft.preferredDays = on ? draft.preferredDays.filter((d) => d !== i) : [...draft.preferredDays, i].sort((a, b) => a - b);
          ev.currentTarget.setAttribute("aria-pressed", String(!on));
        } }, letter));

    return step_(
      "Step 04", "How much time do you actually have?", "Answer honestly. A plan built for a life you don't have is the fastest way to quit.",
      el("div.stack",
        el("div.range-row", el("div.row-between", el("span.field-label", "Sessions per week"), daysOut), days),
        el("div.range-row", el("div.row-between", el("span.field-label", "Minutes per session"), minsOut), mins),
        el("div.field",
          el("span.field-label", "Preferred days"),
          el("div.row.wrap", { style: { gap: "6px" } }, ...dayToggles),
          el("p.hint", "We'll fill in around these if you need more days than you've picked."))),
      [el("button.btn.btn-quiet", { type: "button", onClick: () => go(3) }, icon("arrowLeft"), "Back"),
       el("button.btn.btn-gold", { type: "button", onClick: () => go(5) }, "Continue", icon("arrowRight"))]);
  }

  /* ---------- step 5: the stake ---------- */
  function stakeStep() {
    const amountInput = el("input.input", { type: "number", min: 0, max: 10000, step: 5, value: draft.stakeAmount,
      onInput: (ev) => { draft.stakeAmount = Math.max(0, Number(ev.target.value) || 0); sync(); } });
    const currency = el("select.select", { onChange: (ev) => { draft.currency = ev.target.value; sync(); } },
      ...["GBP", "USD", "EUR", "AUD", "CAD"].map((c) => el("option", { value: c, selected: c === draft.currency }, `${currencySymbol(c)} ${c}`)));
    const prefix = el("span.pfx", currencySymbol(draft.currency));
    const breakdown = el("p.hint");

    const sync = () => {
      prefix.textContent = currencySymbol(draft.currency);
      amountInput.value = draft.stakeAmount;
      const weeks = estimateWeeks(draft.startDate, draft.targetDate);
      breakdown.textContent = draft.stakeAmount > 0
        ? `${money(draft.stakeAmount * WEEKLY_SHARE / weeks, draft.currency)} vests back each week you hit your sessions; the remaining ${money(draft.stakeAmount * MILESTONE_SHARE, draft.currency)} unlocks across your milestones.`
        : "No stake. You can add one later — but people who put something on the line finish far more often.";
    };
    setTimeout(sync);

    const presets = [0, 50, 100, 250].map((amount) =>
      el("button.chip", { type: "button", onClick: () => { draft.stakeAmount = amount; sync(); } },
        amount === 0 ? "No stake" : money(amount, draft.currency)));

    return step_(
      "Step 05", "Put something on the line", "Real stakes, real motivation. Every session you complete earns your money back — all of it, if you follow through.",
      el("div.stack",
        el("div.row.wrap", { style: { gap: "6px" } }, ...presets),
        el("div.row", { style: { alignItems: "flex-end", gap: "var(--space-3)" } },
          el("div.field.grow", el("label", "Your stake"), el("div.input-prefix", prefix, amountInput)),
          el("div.field", { style: { width: "130px" } }, el("label", "Currency"), currency)),
        breakdown,
        el("div.card.card-quiet", { style: { padding: "var(--space-4)" } },
          el("div.row", icon("warning", { class: "muted" }),
            el("p.muted", { style: { fontSize: "var(--text-xs)" } },
              "This build tracks your stake locally — no payment is taken and no money moves. It's the mechanic, fully working, without the wallet.")))),
      [el("button.btn.btn-quiet", { type: "button", onClick: () => go(4) }, icon("arrowLeft"), "Back"),
       el("button.btn.btn-gold", { type: "button", onClick: () => go(6) }, "Continue", icon("arrowRight"))]);
  }

  /* ---------- step 6: partner, then build ---------- */
  function partnerStep() {
    const name = el("input.input", { type: "text", placeholder: "Their name", value: draft.partner?.name || "",
      onInput: (ev) => { draft.partner = { ...(draft.partner || {}), name: ev.target.value }; } });
    const contact = el("input.input", { type: "text", placeholder: "Email or phone (optional)", value: draft.partner?.contact || "",
      onInput: (ev) => { draft.partner = { ...(draft.partner || {}), contact: ev.target.value }; } });

    const finish = (withPartner) => {
      if (!withPartner) draft.partner = null;
      else if (!draft.partner?.name?.trim()) { toast("Give your partner a name first", "warning"); return; }
      build();
    };

    return step_(
      "Step 06", "Who's in your corner?", "One person who'll notice if you go quiet. It roughly doubles the odds you finish.",
      el("div.stack",
        el("div.field", el("label", "Accountability partner"), name),
        el("div.field", contact, el("p.hint", "Kept on your device. Nothing is sent anywhere from this build.")),
      ),
      [el("button.btn.btn-quiet", { type: "button", onClick: () => finish(false) }, "Skip for now"),
       el("button.btn.btn-gold", { type: "button", onClick: () => finish(true) }, icon("sparkle"), "Build my plan")]);
  }

  /* ---------- the build ---------- */
  function build() {
    const lines = [
      "Reading your goal…",
      `Sizing ${estimateWeeks(draft.startDate, draft.targetDate)} weeks into phases…`,
      "Setting weekly sessions around your time…",
      "Placing milestones and your stake…",
      "Done.",
    ];
    const log = el("ul.building-log");
    mount(shell, el("div.card.neon.step-card",
      el("div.building",
        el("div.building-ring"),
        el("h3", "Building your plan"),
        log)));

    lines.forEach((line, i) => {
      setTimeout(() => {
        log.appendChild(el("li", { style: { animationDelay: "0ms" } }, line));
      }, i * 420);
    });

    setTimeout(() => {
      const goal = createGoal(draft);
      toast(`Plan ready — ${goal.tasks.length} actions across ${goal.plan.phases.length} phases`, "sparkle");
      onDone?.(goal);
    }, lines.length * 420 + 260);
  }

  function step_(eyebrow, title, sub, body, actions) {
    return el("div.card.step-card",
      el("p.eyebrow.step-eyebrow", eyebrow),
      el("h2", title),
      el("p.step-sub", sub),
      body,
      el("div.step-actions", ...actions));
  }

  render();
  return root;
}
