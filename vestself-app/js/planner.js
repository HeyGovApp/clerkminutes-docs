/**
 * The planner: goal text in, a dated, progressive plan out.
 *
 * It reads the goal the way a decent coach would — what discipline is this,
 * what distance/target is implied, how experienced is the person, how much
 * time do they actually have — and lays out phases, a weekly session mix that
 * progresses week over week, milestones, and every individual dated action.
 *
 * It runs entirely locally and deterministically: same input, same plan, no
 * network, no key, works offline. `buildPlan` is the single seam — swap its
 * body for a model call and the rest of the app is unchanged, as long as the
 * returned shape holds (see README, "Swapping in a hosted model").
 */
import { uid } from "./lib/dom.js";
import { today, addDays, daysBetween, weekdayIndex, fromKey } from "./lib/date.js";

/* ============================================================
   Category detection
   ============================================================ */

export const CATEGORIES = [
  { key: "endurance", label: "Endurance", blurb: "Running, cycling, swimming, races" },
  { key: "strength",  label: "Strength",  blurb: "Lifting, calisthenics, muscle" },
  { key: "bodycomp",  label: "Body composition", blurb: "Fat loss, leanness, health markers" },
  { key: "business",  label: "Business",  blurb: "Launch, customers, revenue" },
  { key: "creative",  label: "Creative",  blurb: "Write, record, make, publish" },
  { key: "learning",  label: "Learning",  blurb: "Language, exam, skill, code" },
  { key: "money",     label: "Money",     blurb: "Save, clear debt, invest" },
  { key: "habit",     label: "Habit",     blurb: "Build one in, or cut one out" },
  { key: "career",    label: "Career",    blurb: "Job, promotion, portfolio" },
  { key: "custom",    label: "Something else", blurb: "A plan built from your own words" },
];

const MATCHERS = [
  ["endurance", /\b(marathon|half[- ]?marathon|10 ?k|5 ?k|ultra|triathlon|ironman|run(ning)?|jog|cycl(e|ing)|bike|ride|swim|row|hike|couch to)\b/i],
  ["strength",  /\b(gym|lift(ing)?|strength|squat|deadlift|bench|muscle|calisthenic|pull[- ]?up|push[- ]?up|barbell|hypertroph)/i],
  ["bodycomp",  /\b(weight loss|fat loss|get lean|body ?fat|shred|slim(mer)?|tone up|(lose|drop|shift) \d+ ?(kg|lb|pounds|stone)|lose weight)/i],
  ["business",  /\b(business|startup|start[- ]?up|company|launch|freelanc|clients?|customers?|revenue|saas|product|side project|agency|shop|store|sell)/i],
  ["creative",  /\b(book|novel|write|writing|album|song|music|paint|draw|film|video|podcast|blog|newsletter|photograph|design|portfolio piece|screenplay)/i],
  ["learning",  /\b(learn|study|exam|degree|course|certif|language|spanish|french|german|japanese|italian|portuguese|mandarin|code|coding|program(ming)?|python|guitar|piano|chess|maths?|read \d+ books?)/i],
  ["money",     /\b(save|savings|debt|invest|budget|emergency fund|money|pension|mortgage|deposit|£|\$|€)\b/i],
  ["habit",     /\b(quit|stop|cut out|habit|meditat|sleep|wake up|screen time|scroll|smok|drink|alcohol|sober|journal|stretch|hydrat|daily)/i],
  ["career",    /\b(job|career|promot(e|ed|ion)|interview|hired?|pay ?rise|switch (careers|jobs)|cv|ré?sumé?|linkedin)\b/i],
];

export function detectCategory(text = "") {
  for (const [key, re] of MATCHERS) if (re.test(text)) return key;
  return "custom";
}

/* ============================================================
   Reading specifics out of the goal text
   ============================================================ */

const RACE_DISTANCES = [
  [/\bultra\b/i, 60, "ultra"],
  [/\b(marathon)\b/i, 42.2, "marathon"],
  [/\bhalf[- ]?marathon\b/i, 21.1, "half marathon"],
  [/\b21 ?k\b/i, 21.1, "half marathon"],
  [/\b10 ?k\b/i, 10, "10K"],
  [/\b5 ?k\b/i, 5, "5K"],
];

/** Half-marathon must beat the bare "marathon" match, so check it first. */
function raceTarget(text) {
  if (/half[- ]?marathon|\b21 ?k\b/i.test(text)) return { km: 21.1, label: "half marathon" };
  for (const [re, km, label] of RACE_DISTANCES) if (re.test(text)) return { km, label };
  return { km: 10, label: "distance target" };
}

function numberFrom(text, re) {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

const LEVELS = { new: 0, some: 1, experienced: 2 };

/* ============================================================
   Session helpers
   ============================================================ */

const s = (title, detail, verify = "check", minutes = null) => ({ title, detail, verify, minutes });

/** Progressive volume with a cutback every fourth week and a taper at the end. */
function ramp(week, totalWeeks, start, peak) {
  const taperFrom = Math.max(1, Math.round(totalWeeks * 0.88));
  if (week >= taperFrom) {
    const into = week - taperFrom;
    return round1(peak * (0.7 - into * 0.18));
  }
  const t = totalWeeks <= 1 ? 1 : (week - 1) / (taperFrom - 1 || 1);
  const base = start + (peak - start) * Math.min(1, t);
  const cutback = week % 4 === 0 ? 0.75 : 1;
  return round1(Math.max(start, base * cutback));
}

const round1 = (n) => Math.round(n * 10) / 10;

/* ============================================================
   Templates — one per category.
   Each phase gets `week(ctx)`, returning that week's ordered session list.
   The scheduler trims or repeats it to fit the days actually available.
   ============================================================ */

const TEMPLATES = {
  endurance(ctx) {
    const { km, label } = raceTarget(ctx.title);
    const peakLong = round1(km * (km >= 30 ? 0.76 : 0.9));
    const startLong = round1(Math.max(3, km * (ctx.level === 0 ? 0.1 : 0.18)));
    return {
      label: `Endurance — ${label}`,
      notes: [
        `Read "${label}" out of your goal, so the plan is built back from ${km} km.`,
        `Long run peaks at ${peakLong} km — the ${label} itself supplies the rest on the day.`,
        "Every fourth week steps down 25% so the adaptation actually lands.",
      ],
      phases: [
        {
          name: "Base", share: 0.35,
          summary: "Time on feet, easy pace, no heroics. You are building the engine, not testing it.",
          milestone: () => `Run ${round1(ramp(Math.round(ctx.weeks * 0.35), ctx.weeks, startLong, peakLong))} km without stopping`,
          week: (w) => [
            s(`Long run — ${ramp(w, ctx.weeks, startLong, peakLong)} km`, "Conversational pace throughout. If you can't talk, slow down.", "metric", ctx.minutes + 20),
            s(`Easy run — ${Math.round(ctx.minutes * 0.7)} min`, "Nose-breathing pace. This one is meant to feel too easy.", "timer", Math.round(ctx.minutes * 0.7)),
            s("Strength & mobility — 25 min", "Single-leg work, calves, hips, core. This is what keeps you uninjured.", "check", 25),
            s(`Easy run — ${Math.round(ctx.minutes * 0.6)} min`, "Short and light. Skip it before you skip the long run.", "timer", Math.round(ctx.minutes * 0.6)),
          ],
        },
        {
          name: "Build", share: 0.3,
          summary: "Same easy base, plus one hard session a week. Quality goes in now.",
          milestone: () => "Hold threshold pace for 20 unbroken minutes",
          week: (w) => [
            s(`Long run — ${ramp(w, ctx.weeks, startLong, peakLong)} km`, "Last 3 km at goal pace. Practise finishing tired.", "metric", ctx.minutes + 30),
            s(`Intervals — ${4 + (w % 3)} × 800 m`, "Hard but repeatable, 90 s jog between. Even splits beat a fast first rep.", "timer", ctx.minutes),
            s(`Tempo — ${15 + Math.min(10, w)} min at threshold`, "Comfortably hard: you could speak a sentence, not a paragraph.", "timer", ctx.minutes),
            s("Strength & mobility — 25 min", "Keep it in. Injury is the only thing that ends this plan.", "check", 25),
            s(`Easy run — ${Math.round(ctx.minutes * 0.7)} min`, "Recovery, deliberately slow.", "timer", Math.round(ctx.minutes * 0.7)),
          ],
        },
        {
          name: "Peak", share: 0.22,
          summary: "The biggest weeks of the block. Sleep and food matter as much as the running now.",
          milestone: () => `Complete the ${peakLong} km peak long run`,
          week: (w) => [
            s(`Long run — ${ramp(w, ctx.weeks, startLong, peakLong)} km`, "Fuel it exactly as you plan to on race day. Test nothing new later.", "metric", ctx.minutes + 45),
            s("Goal-pace session — 5 × 1 km", "Race pace, 2 min recovery. Should feel controlled, not brave.", "timer", ctx.minutes),
            s(`Tempo — ${25 + Math.min(10, w)} min at threshold`, "The session that raises your ceiling.", "timer", ctx.minutes),
            s(`Easy run — ${Math.round(ctx.minutes * 0.8)} min`, "Legs turning over, nothing more.", "timer", Math.round(ctx.minutes * 0.8)),
            s("Strength & mobility — 20 min", "Reduced load, keep the movement.", "check", 20),
          ],
        },
        {
          name: "Taper", share: 0.13,
          summary: "Volume drops, sharpness stays. The work is done — protect it.",
          milestone: () => `Finish the ${label}`,
          week: (w) => [
            s(`Long run — ${ramp(w, ctx.weeks, startLong, peakLong)} km`, "Short and sharp. Resist adding to it.", "metric", ctx.minutes),
            s("Sharpener — 6 × 400 m", "Fast, full recovery, stop while it still feels good.", "timer", 35),
            s(`Easy run — ${Math.round(ctx.minutes * 0.5)} min`, "Shake out. Legs should feel springy by now.", "timer", Math.round(ctx.minutes * 0.5)),
            s("Kit, fuel and logistics check", "Lay everything out. Nothing new on race day.", "photo", 20),
          ],
        },
      ],
    };
  },

  strength(ctx) {
    const split = ctx.daysPerWeek >= 5
      ? ["Push", "Pull", "Legs", "Upper", "Lower"]
      : ctx.daysPerWeek === 4 ? ["Upper A", "Lower A", "Upper B", "Lower B"]
      : ["Full body A", "Full body B", "Full body C"];
    return {
      label: "Strength",
      notes: [
        `${ctx.daysPerWeek} days a week fits a ${split.join(" / ")} split.`,
        "Load rises roughly 2.5% a week, with a deload every fourth week.",
        "Every session is logged — the number is the proof.",
      ],
      phases: [
        {
          name: "Foundation", share: 0.28,
          summary: "Groove the patterns at a load you could repeat tomorrow. Technique before intensity.",
          milestone: () => "Every main lift filmed once, form checked",
          week: (w) => split.map((part, i) =>
            s(`${part} — 3 × 8`, i === 0
              ? `Leave two reps in the tank. Week ${w}: add 2.5 kg only if all sets moved cleanly.`
              : "Controlled tempo, full range. Log every set.", "metric", ctx.minutes)),
        },
        {
          name: "Volume", share: 0.3,
          summary: "More total work. This is the phase that actually changes how you look and feel.",
          milestone: () => "Hit target volume for four straight weeks",
          week: (w) => split.map((part) =>
            s(`${part} — 4 × 8-10`, `Week ${w}: one more set than foundation, same clean technique.`, "metric", ctx.minutes + 10)),
        },
        {
          name: "Intensity", share: 0.27,
          summary: "Heavier, fewer reps. Rest properly between sets — three minutes is not slacking.",
          milestone: () => "New working best on each main lift",
          week: (w) => split.map((part) =>
            s(`${part} — 5 × 5 heavy`, `Week ${w}: ${w % 4 === 0 ? "deload — drop 20% and move well" : "add load, keep the last rep clean"}.`, "metric", ctx.minutes + 10)),
        },
        {
          name: "Peak", share: 0.15,
          summary: "Test what you built, then back off. Records are set on fresh legs.",
          milestone: () => "Test day: new one-rep max recorded",
          week: () => [
            ...split.slice(0, 2).map((part) => s(`${part} — 3 × 3 @ 90%`, "Sharp and short. Stop while it's fast.", "metric", ctx.minutes)),
            s("Test day — main lifts", "Warm up thoroughly, three attempts each, film the top set.", "photo", ctx.minutes + 20),
            s("Recovery session", "Walk, stretch, breathe. Adaptation happens here.", "check", 30),
          ],
        },
      ],
    };
  },

  bodycomp(ctx) {
    const target = numberFrom(ctx.title, /(\d+(?:\.\d+)?)\s?(?:kg|lb|pounds|stone)/i);
    return {
      label: "Body composition",
      notes: [
        target ? `Target of ${target} read from your goal — paced at a rate you can hold.` : "No number given, so the plan targets consistency rather than a scale figure.",
        "Weekly weigh-in only. Daily weight is noise and it will wreck your week.",
        "Steps and protein are the two levers that do most of the work.",
      ],
      phases: [
        {
          name: "Baseline", share: 0.22,
          summary: "Change almost nothing. Measure honestly first — you cannot steer what you haven't seen.",
          milestone: () => "Seven days of honest logging, no judgement",
          week: () => [
            s("Log everything you eat", "No changes yet. Accuracy beats optimism.", "note", 10),
            s("Walk 8,000 steps", "The cheapest lever you have.", "metric", 45),
            s("Full-body session — 40 min", "Muscle is what keeps the loss from coming back.", "check", 40),
            s("Weekly weigh-in + photo", "Same time, same conditions, once a week only.", "photo", 5),
          ],
        },
        {
          name: "Deficit", share: 0.34,
          summary: "A modest, boring deficit you can actually hold for months.",
          milestone: () => "Four consecutive weeks in the target range",
          week: (w) => [
            s("Protein target hit", `Roughly 1.6 g per kg. Week ${w}: front-load it at breakfast.`, "check", 5),
            s("Walk 9,000 steps", "Non-negotiable. Split it if you have to.", "metric", 50),
            s("Strength session — 45 min", "Keep the load up as intake comes down.", "check", 45),
            s("Plan tomorrow's food", "Ten minutes tonight beats a decision at 6pm tomorrow.", "note", 10),
            s("Weekly weigh-in + photo", "Trend line, not the daily number.", "photo", 5),
          ],
        },
        {
          name: "Momentum", share: 0.26,
          summary: "The middle. Nothing new happens here — that is the point.",
          milestone: () => "Halfway, and the habits are running themselves",
          week: () => [
            s("Protein target hit", "Same as it's been. Boring is working.", "check", 5),
            s("Walk 10,000 steps", "Push the floor up now it's easy.", "metric", 55),
            s("Strength session — 45 min", "Progress the load where you can.", "check", 45),
            s("One social meal, planned", "Sustainable means it survives a Friday.", "note", 5),
            s("Weekly weigh-in + photo", "Compare to four weeks ago, not yesterday.", "photo", 5),
          ],
        },
        {
          name: "Hold", share: 0.18,
          summary: "Bring intake back up deliberately and prove you can hold the result.",
          milestone: () => "Weight held for three weeks at maintenance",
          week: () => [
            s("Maintenance intake", "Up slightly, watch the trend flatten.", "check", 5),
            s("Walk 10,000 steps", "Unchanged. This is your life now.", "metric", 55),
            s("Strength session — 45 min", "Now push performance again.", "check", 45),
            s("Weekly weigh-in + photo", "Stability is the win here.", "photo", 5),
          ],
        },
      ],
    };
  },

  business(ctx) {
    return {
      label: "Business",
      notes: [
        "Built around evidence, not activity — conversations and shipped things, never 'research'.",
        "Customer contact is scheduled every single week, including build weeks.",
        "Revenue is the milestone, because everything else can be faked.",
      ],
      phases: [
        {
          name: "Validate", share: 0.25,
          summary: "Talk to people with the problem before you build anything. Most plans die here for good reason.",
          milestone: () => "20 problem interviews done and written up",
          week: (w) => [
            s("5 customer conversations", `Week ${w}: ask what they did last time, not what they'd pay.`, "note", 60),
            s("Write up what you heard", "Patterns, exact phrases, objections. Quotes beat summaries.", "note", 30),
            s("Sharpen the one-line offer", "Who it's for, what changes, why now.", "note", 30),
            s("Map one competitor honestly", "Where they're strong. Be specific and unflattering to yourself.", "note", 30),
          ],
        },
        {
          name: "Build", share: 0.3,
          summary: "The smallest thing that delivers the promise. Shipping beats polishing.",
          milestone: () => "A working version a stranger can use unaided",
          week: (w) => [
            s(`Build block — ${ctx.minutes} min`, `Week ${w}: one feature, finished, not three started.`, "timer", ctx.minutes),
            s("Ship something visible", "A page, a flow, a fix. Visible to someone who isn't you.", "photo", ctx.minutes),
            s("2 customer conversations", "Keep the line open while you build.", "note", 40),
            s("Cut one thing from scope", "Every week. This is the discipline that gets you launched.", "note", 15),
          ],
        },
        {
          name: "Launch", share: 0.25,
          summary: "Ask for money. Publicly. The part everyone postpones.",
          milestone: () => "First paying customer",
          week: (w) => [
            s("15 outbound messages", `Week ${w}: personal, specific, one clear ask.`, "metric", 45),
            s("Post publicly about it", "Build in the open. Consistency compounds here.", "photo", 30),
            s("Follow up everyone from last week", "The follow-up closes more than the pitch.", "note", 30),
            s("Fix the top objection you heard", "Straight into the product or the pitch.", "timer", ctx.minutes),
          ],
        },
        {
          name: "Grow", share: 0.2,
          summary: "Find the one channel that works and stop doing the other four.",
          milestone: () => "A repeatable channel producing customers",
          week: () => [
            s("Double down on the best channel", "The one with actual conversions, not the one you enjoy.", "note", 45),
            s("10 outbound messages", "Volume in the channel that's working.", "metric", 30),
            s("Talk to a paying customer", "Why they bought, what nearly stopped them.", "note", 30),
            s("Weekly numbers review", "Revenue, conversations, conversion. Write one line on each.", "note", 20),
          ],
        },
      ],
    };
  },

  creative(ctx) {
    const words = numberFrom(ctx.title, /(\d{3,6})\s?words/i) || (/\bbook|novel\b/i.test(ctx.title) ? 60000 : 20000);
    const perSession = Math.max(300, Math.round(words / (ctx.weeks * ctx.daysPerWeek * 0.75) / 50) * 50);
    return {
      label: "Creative",
      notes: [
        `Sized at roughly ${words.toLocaleString()} words → ${perSession} per session.`,
        "Drafting and editing are separated on purpose — doing both at once is how projects stall.",
        "Ship date is a milestone, not an aspiration.",
      ],
      phases: [
        {
          name: "Shape", share: 0.18,
          summary: "Decide what it is before you make it. Cheap to change now, expensive later.",
          milestone: () => "A one-page outline you believe in",
          week: () => [
            s("Outline session — 45 min", "Beats, sections, the shape of the whole thing.", "note", 45),
            s("Collect references", "Three things that do what you want, and why.", "note", 30),
            s(`Rough ${perSession} words`, "Ugly on purpose. Momentum over quality.", "metric", ctx.minutes),
          ],
        },
        {
          name: "Draft", share: 0.4,
          summary: "Volume phase. No editing, no re-reading, no polishing — forward only.",
          milestone: () => `First full draft — all ${words.toLocaleString()} words`,
          week: (w) => [
            s(`Write ${perSession} words`, `Week ${w}: same time, same place. Don't read back.`, "metric", ctx.minutes),
            s(`Write ${perSession} words`, "Start mid-sentence from yesterday if it helps.", "metric", ctx.minutes),
            s(`Write ${perSession} words`, "Bad pages still count. Blank ones don't.", "metric", ctx.minutes),
            s("Note what's not working", "Park it in a list. Do not fix it yet.", "note", 15),
          ],
        },
        {
          name: "Revise", share: 0.27,
          summary: "Now you're allowed to read it. Cut hard, then cut again.",
          milestone: () => "Second draft, read by three people",
          week: () => [
            s("Revision pass — 60 min", "One problem per pass. Structure before sentences.", "timer", 60),
            s("Read a section aloud", "Your ear catches what your eye forgives.", "check", 30),
            s("Cut 10%", "It gets better. It always gets better.", "metric", 45),
            s("Send to a reader", "Ask one specific question, not 'what did you think'.", "note", 20),
          ],
        },
        {
          name: "Ship", share: 0.15,
          summary: "Finish it and put it in front of people. Done beats perfect.",
          milestone: () => "Published",
          week: () => [
            s("Final polish — 60 min", "Typos, formatting, the last read-through.", "timer", 60),
            s("Prepare the launch", "Where it goes, who you tell, what you say.", "note", 45),
            s("Publish / send", "The whole point.", "photo", 45),
          ],
        },
      ],
    };
  },

  learning(ctx) {
    return {
      label: "Learning",
      notes: [
        "Weighted toward active recall and output — re-reading feels productive and mostly isn't.",
        "Spaced review is built into every week rather than bolted on before a deadline.",
        `Sessions sized at ${ctx.minutes} minutes to match the time you said you have.`,
      ],
      phases: [
        {
          name: "Foundations", share: 0.28,
          summary: "Cover the ground once, fast and shallow. Depth comes from use, not from the first pass.",
          milestone: () => "Core material covered end to end",
          week: (w) => [
            s(`Study block — ${ctx.minutes} min`, `Week ${w}: new material, take rough notes only.`, "timer", ctx.minutes),
            s("Active recall — 20 min", "Close everything. Write what you remember. Then check.", "note", 20),
            s(`Practice — ${Math.round(ctx.minutes * 0.7)} min`, "Use it badly. Using it badly is how it sticks.", "timer", Math.round(ctx.minutes * 0.7)),
            s("Spaced review — 15 min", "Yesterday, last week, last month.", "check", 15),
          ],
        },
        {
          name: "Practice", share: 0.3,
          summary: "Volume of repetition, with feedback. This is where most of the gain lives.",
          milestone: () => "First unaided piece of real work",
          week: (w) => [
            s(`Practice — ${ctx.minutes} min`, `Week ${w}: at the edge of what you can do, not the middle.`, "timer", ctx.minutes),
            s("Active recall — 25 min", "Test yourself before you feel ready. That's the point.", "note", 25),
            s("Get it checked", "A person, a solution key, a test suite. Feedback or it's guessing.", "note", 30),
            s("Spaced review — 15 min", "Short, daily, unglamorous.", "check", 15),
          ],
        },
        {
          name: "Apply", share: 0.26,
          summary: "Build or perform something real. Knowledge you can't use isn't finished.",
          milestone: () => "A finished project or a passed mock",
          week: () => [
            s(`Project work — ${ctx.minutes} min`, "Something real, with a real deadline.", "timer", ctx.minutes),
            s("Mock test / performance", "Under conditions. Timed and uncomfortable.", "metric", 60),
            s("Review the misses", "Only the wrong answers. They're the whole lesson.", "note", 30),
            s("Spaced review — 15 min", "Keep the old material warm.", "check", 15),
          ],
        },
        {
          name: "Master", share: 0.16,
          summary: "Sharpen the weak edges and prove it.",
          milestone: () => "Assessed at the level you set out for",
          week: () => [
            s("Weakest-area drill — 40 min", "The bit you've been avoiding. Specifically that.", "timer", 40),
            s("Full mock under conditions", "Timed, no notes, no restarts.", "metric", 90),
            s("Teach it to someone", "The fastest way to find the holes.", "note", 30),
          ],
        },
      ],
    };
  },

  money(ctx) {
    const target = numberFrom(ctx.title, /([\d,]{3,9})/);
    return {
      label: "Money",
      notes: [
        target ? `Target of ${Number(String(target).replace(/,/g, "")).toLocaleString()} read from your goal.` : "No figure given, so this builds the system first and the number follows.",
        "Automation before willpower — the transfer happens on payday, not on leftovers.",
        "One weekly review, fifteen minutes, forever.",
      ],
      phases: [
        {
          name: "See it", share: 0.2,
          summary: "Look at the actual numbers. Uncomfortable, brief, necessary.",
          milestone: () => "Every account and subscription listed",
          week: () => [
            s("Log every transaction", "All of them. Yes, that one.", "note", 15),
            s("List all subscriptions", "With dates and amounts. The total will surprise you.", "note", 30),
            s("Weekly money review — 15 min", "Same slot each week. Non-negotiable.", "note", 15),
          ],
        },
        {
          name: "Cut", share: 0.25,
          summary: "Remove what you won't miss. Ruthless once beats frugal forever.",
          milestone: () => "Fixed monthly outgoings cut by 10%",
          week: (w) => [
            s("Cancel one thing", `Week ${w}: the least-missed subscription still standing.`, "photo", 20),
            s("Renegotiate one bill", "Phone, energy, insurance. One call.", "note", 30),
            s("No-spend day", "One a week. It resets the default.", "check", 5),
            s("Weekly money review — 15 min", "Track what the cuts freed up.", "note", 15),
          ],
        },
        {
          name: "Automate", share: 0.3,
          summary: "Move the decision away from the moment of temptation.",
          milestone: () => "Automatic transfer running on payday",
          week: () => [
            s("Transfer to savings", "On payday, before anything else.", "metric", 10),
            s("Check the automation held", "Two minutes. Catch the failure early.", "check", 10),
            s("One extra earning action", "Sell, invoice, ask, list. Income is the other lever.", "note", 45),
            s("Weekly money review — 15 min", "Balance, trend, one decision.", "note", 15),
          ],
        },
        {
          name: "Compound", share: 0.25,
          summary: "Leave it alone and let the boring thing work.",
          milestone: () => "Target reached, system still running",
          week: () => [
            s("Transfer to savings", "Same amount, no negotiation.", "metric", 10),
            s("Raise the transfer by 1%", "Small enough not to hurt. Do it anyway.", "check", 10),
            s("Weekly money review — 15 min", "The habit outlives the goal.", "note", 15),
          ],
        },
      ],
    };
  },

  habit(ctx) {
    const quitting = /\b(quit|stop|cut out|less|reduce|no more)\b/i.test(ctx.title);
    return {
      label: quitting ? "Habit — breaking one" : "Habit — building one",
      notes: [
        quitting
          ? "Built around replacement, not willpower: every removed behaviour gets something in its place."
          : "Built around a cue, a tiny version, and a streak you'd be annoyed to lose.",
        "The first two weeks are deliberately too easy. That's the mechanism, not a compromise.",
        "Missing once is fine. Missing twice is where habits actually die.",
      ],
      phases: [
        {
          name: "Anchor", share: 0.25,
          summary: quitting ? "Find the trigger and put something else there." : "Attach it to something you already do without thinking.",
          milestone: () => "Seven days unbroken",
          week: () => [
            s(quitting ? "Replacement action" : "The tiny version", quitting ? "When the trigger hits, do the replacement instead. Log it either way." : "Two minutes. Absurdly small on purpose.", "check", 5),
            s("Note the trigger", "What happened right before? Time, place, feeling, person.", "note", 10),
            s("Weekly review — 10 min", "What made it easy, what made it hard.", "note", 10),
          ],
        },
        {
          name: "Stabilise", share: 0.3,
          summary: "Same behaviour, more days. Boring repetition is the entire point.",
          milestone: () => "Four weeks, 80% of days hit",
          week: (w) => [
            s(quitting ? "Trigger-free day" : `Do it — ${Math.min(ctx.minutes, 10 + w * 2)} min`, `Week ${w}: slightly more than last week, no more than that.`, "check", Math.min(ctx.minutes, 10 + w * 2)),
            s("Remove one bit of friction", "Make the right thing the easy thing.", "note", 15),
            s("Weekly review — 10 min", "Streak, slips, one adjustment.", "note", 10),
          ],
        },
        {
          name: "Strengthen", share: 0.25,
          summary: "Now make it bigger — and plan for the week it goes wrong.",
          milestone: () => "Recovered from a miss within a day",
          week: () => [
            s(quitting ? "Hold the line" : `Full session — ${ctx.minutes} min`, "The real version now, not the tiny one.", "timer", ctx.minutes),
            s("Write the if-then plan", "'If X happens, I will do Y.' Decide before you're tired.", "note", 15),
            s("Weekly review — 10 min", "Where did it nearly break?", "note", 10),
          ],
        },
        {
          name: "Lock in", share: 0.2,
          summary: "It should feel like a fact about you rather than a task on a list.",
          milestone: () => "It happens without the reminder",
          week: () => [
            s(quitting ? "Hold the line" : `Full session — ${ctx.minutes} min`, "Automatic now. Log it to prove it.", "check", ctx.minutes),
            s("Tell someone", "Public identity is the strongest lock there is.", "note", 10),
            s("Weekly review — 10 min", "Last one. Then it's just how you live.", "note", 10),
          ],
        },
      ],
    };
  },

  career(ctx) {
    return {
      label: "Career",
      notes: [
        "Applications are the smallest part of this plan — conversations do the work.",
        "Evidence is built before it's needed, so the interview is a formality, not a performance.",
        "Weekly outreach is scheduled even in the weeks you don't feel like it.",
      ],
      phases: [
        {
          name: "Position", share: 0.25,
          summary: "Decide what you're aiming at and make the evidence match it.",
          milestone: () => "CV and profile rewritten around one clear target",
          week: () => [
            s("Rewrite one section", "Outcomes with numbers, not responsibilities.", "note", 45),
            s("Define the target role", "Company type, level, the specific problem you solve.", "note", 30),
            s("Ask one person for feedback", "Someone who hires, ideally.", "note", 20),
          ],
        },
        {
          name: "Reach", share: 0.3,
          summary: "Warm contact beats cold applications, every time.",
          milestone: () => "10 real conversations with people in the field",
          week: (w) => [
            s("5 outreach messages", `Week ${w}: specific, short, asking for a conversation not a job.`, "metric", 40),
            s("One conversation booked", "Fifteen minutes is plenty.", "note", 30),
            s("Publish something small", "A post, a write-up, a demo. Be findable.", "photo", 45),
            s("Follow up last week's", "Where most of the results actually come from.", "note", 20),
          ],
        },
        {
          name: "Prove", share: 0.25,
          summary: "Build the thing that answers 'can they do it' before anyone asks.",
          milestone: () => "A portfolio piece you'd show unprompted",
          week: () => [
            s(`Portfolio work — ${ctx.minutes} min`, "Real problem, finished and written up.", "timer", ctx.minutes),
            s("Interview practice — 30 min", "Out loud. Recorded. Yes, it's uncomfortable.", "timer", 30),
            s("3 applications, tailored", "Fewer and better beats a hundred generic ones.", "metric", 45),
          ],
        },
        {
          name: "Land", share: 0.2,
          summary: "Convert. Negotiate. Don't take the first number.",
          milestone: () => "Offer received",
          week: () => [
            s("Interview prep — 45 min", "Their problems, your evidence, your questions.", "timer", 45),
            s("Practice the negotiation", "Out loud, with the number said clearly.", "note", 30),
            s("Follow up every open thread", "Nothing goes cold from your end.", "note", 20),
          ],
        },
      ],
    };
  },

  custom(ctx) {
    const verb = ctx.title.replace(/^(i want to|i'd like to|i will|my goal is to)\s+/i, "").trim() || "your goal";
    return {
      label: "Custom",
      notes: [
        "Built from your own words, so the actions stay generic where the plan can't know better.",
        "Every week ends with a review, because a plan you don't inspect drifts.",
        "Edit any action directly — the plan is yours to correct.",
      ],
      phases: [
        {
          name: "Foundation", share: 0.25,
          summary: "Get clear on the target and remove the obstacles you already know about.",
          milestone: () => "Success defined in one measurable sentence",
          week: () => [
            s(`Work on ${verb} — ${ctx.minutes} min`, "The most obvious next thing. Start there.", "timer", ctx.minutes),
            s("Break the goal down", "Next three concrete steps, written down.", "note", 30),
            s("Weekly review — 15 min", "What moved, what didn't, what changes.", "note", 15),
          ],
        },
        {
          name: "Momentum", share: 0.3,
          summary: "Repetition at a pace you can sustain. Frequency beats intensity.",
          milestone: () => "Four consecutive weeks on plan",
          week: (w) => [
            s(`Work on ${verb} — ${ctx.minutes} min`, `Week ${w}: same slot, same place.`, "timer", ctx.minutes),
            s(`Work on ${verb} — ${ctx.minutes} min`, "Show up even at half effort.", "timer", ctx.minutes),
            s("Weekly review — 15 min", "One adjustment, not five.", "note", 15),
          ],
        },
        {
          name: "Push", share: 0.27,
          summary: "Raise the demand now the habit holds.",
          milestone: () => "The hardest part of the goal attempted",
          week: () => [
            s(`Deep work on ${verb} — ${Math.round(ctx.minutes * 1.4)} min`, "Longer block, hardest task first.", "timer", Math.round(ctx.minutes * 1.4)),
            s(`Work on ${verb} — ${ctx.minutes} min`, "Maintain the base.", "timer", ctx.minutes),
            s("Get outside feedback", "Someone who'll tell you the truth.", "note", 30),
            s("Weekly review — 15 min", "Are you still aimed at the right thing?", "note", 15),
          ],
        },
        {
          name: "Finish", share: 0.18,
          summary: "Close it out. Unfinished is the same as undone.",
          milestone: () => "Goal reached",
          week: () => [
            s(`Finish ${verb}`, "Remaining work, in order, no new scope.", "timer", ctx.minutes),
            s("Prove it", "A photo, a number, a link. Evidence it happened.", "photo", 20),
            s("Write what you learned", "So the next goal starts further along.", "note", 20),
          ],
        },
      ],
    };
  },
};

/* ============================================================
   Scheduling
   ============================================================ */

const SPREAD_ORDER = [0, 3, 5, 1, 4, 2, 6]; // Mon, Thu, Sat, Tue, Fri, Wed, Sun

/**
 * Fit a phase's session list to the slots actually available that week.
 *
 * A phase can define more session types than someone has days for. Cycling
 * the list positionally would orphan the tail — the fifth session type would
 * never once be scheduled — so the first session is treated as the week's
 * anchor (the long run, the test, the main block) and always runs, while the
 * rest rotate by week number so everything gets its turn.
 *
 * The anchor is placed last in the week: the biggest session lands on the
 * latest day the user gave us, which is usually the weekend.
 */
function selectSessions(sessions, count, week) {
  if (!sessions.length) return [];
  if (sessions.length <= count) {
    return Array.from({ length: count }, (_, i) => sessions[i % sessions.length]);
  }
  const [anchor, ...rest] = sessions;
  const offset = (week - 1) % rest.length;
  const picks = Array.from({ length: count - 1 }, (_, i) => rest[(offset + i) % rest.length]);
  return [...picks, anchor];
}

/** Choose `count` weekday slots, honouring stated preferences first. */
function chooseDays(preferred, count) {
  const wanted = (preferred || []).slice().sort((a, b) => a - b);
  if (wanted.length >= count) {
    // Thin an over-long preference list evenly rather than taking the first N.
    const step = wanted.length / count;
    return Array.from({ length: count }, (_, i) => wanted[Math.floor(i * step)]);
  }
  const out = [...wanted];
  for (const day of SPREAD_ORDER) {
    if (out.length >= count) break;
    if (!out.includes(day)) out.push(day);
  }
  return out.sort((a, b) => a - b);
}

/**
 * @param {object} draft
 * @returns {{category: string, phases: Array, actions: Array, tasks: Array, rationale: string[]}}
 */
export function buildPlan(draft) {
  const title = draft.title || "";
  const category = draft.category && draft.category !== "auto" ? draft.category : detectCategory(title);
  const startDate = draft.startDate || today();
  const targetDate = draft.targetDate || addDays(startDate, 84);

  const totalDays = Math.max(7, daysBetween(startDate, targetDate));
  const weeks = Math.max(1, Math.min(104, Math.ceil(totalDays / 7)));
  const daysPerWeek = Math.min(7, Math.max(1, Number(draft.daysPerWeek) || 4));
  const minutes = Math.max(10, Number(draft.minutesPerSession) || 45);
  const level = LEVELS[draft.baseline] ?? 1;

  const ctx = { title, weeks, daysPerWeek, minutes, level, success: draft.success || "" };
  const template = (TEMPLATES[category] || TEMPLATES.custom)(ctx);

  // Split the timeline into phases by share, never losing a week to rounding.
  const phases = [];
  let weekCursor = 1;
  template.phases.forEach((p, i) => {
    const isLast = i === template.phases.length - 1;
    const span = isLast ? weeks - weekCursor + 1 : Math.max(1, Math.round(weeks * p.share));
    const startWeek = weekCursor;
    const endWeek = Math.min(weeks, isLast ? weeks : startWeek + span - 1);
    if (startWeek > weeks) return;
    phases.push({
      id: uid("phase"),
      index: phases.length + 1,
      name: p.name,
      summary: p.summary,
      startWeek,
      endWeek,
      startDate: addDays(startDate, (startWeek - 1) * 7),
      endDate: addDays(startDate, endWeek * 7 - 1),
      milestone: {
        id: uid("ms"),
        title: p.milestone(ctx),
        dueDate: addDays(startDate, Math.min(totalDays, endWeek * 7 - 1)),
        status: "pending",
      },
      _week: p.week,
    });
    weekCursor = endWeek + 1;
  });

  // The weekly slots, and the concrete dated tasks that fill them.
  const slots = chooseDays(draft.preferredDays, daysPerWeek);
  const firstWeekStart = addDays(startDate, -weekdayIndex(startDate));
  const tasks = [];
  const actions = [];
  const seenActions = new Set();

  for (const phase of phases) {
    for (let week = phase.startWeek; week <= phase.endWeek; week++) {
      const weekSessions = phase._week(week);
      const weekStart = addDays(firstWeekStart, (week - 1) * 7);

      const weekPlan = selectSessions(weekSessions, slots.length, week);

      slots.forEach((slot, i) => {
        const session = weekPlan[i];
        const date = addDays(weekStart, slot);
        if (date < startDate || date > targetDate) return;
        tasks.push({
          id: uid("task"),
          date,
          title: session.title,
          detail: session.detail,
          minutes: session.minutes || minutes,
          verify: session.verify,
          phaseId: phase.id,
          week,
          status: "pending",
          proof: null,
          completedAt: null,
        });
      });

      if (week === phase.startWeek) {
        const phaseWeeks = phase.endWeek - phase.startWeek + 1;
        weekSessions.forEach((session, idx) => {
          const key = `${phase.id}:${idx}`;
          if (seenActions.has(key)) return;
          seenActions.add(key);
          // Count how often this session actually appears across the phase,
          // so the cadence shown is what the calendar really does.
          let hits = 0;
          for (let w = phase.startWeek; w <= phase.endWeek; w++) {
            hits += selectSessions(phase._week(w), slots.length, w).filter((x) => x.title === session.title).length;
          }
          // A short phase may not have room for every session type it defines;
          // don't advertise one the calendar never actually schedules.
          if (!hits) return;
          actions.push({
            phaseId: phase.id,
            title: session.title,
            detail: session.detail,
            verify: session.verify,
            perWeek: hits / phaseWeeks,
          });
        });
      }
    }
  }

  tasks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const rationale = [
    `${weeks} week${weeks === 1 ? "" : "s"} between ${fmt(startDate)} and ${fmt(targetDate)}, split into ${phases.length} phases.`,
    `${daysPerWeek} session${daysPerWeek === 1 ? "" : "s"} a week at ~${minutes} minutes, on ${slots.map((d) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d]).join(", ")}.`,
    ...template.notes,
  ];

  for (const phase of phases) delete phase._week;

  return { category, categoryLabel: template.label, phases, actions, tasks, rationale };
}

function fmt(key) {
  return fromKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Exposed for the onboarding preview, which sizes the plan before committing. */
export function estimateWeeks(startDate, targetDate) {
  return Math.max(1, Math.ceil(Math.max(7, daysBetween(startDate, targetDate)) / 7));
}
