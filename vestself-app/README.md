# vest self

The Vest Self web app — the product [vestself.app](https://www.vestself.app) advertises, built.

The marketing site is a waitlist page for an app that turns any goal into a plan you actually
follow: AI-shaped planning, dated actions, verified progress, an accountability partner, and
money on the line that vests back to you as you go. This is that app, running the whole loop.

## Running it

No build step, no dependencies, no install. Serve the folder:

```sh
cd vestself-app
python3 -m http.server 8080     # or: npx http-server -p 8080
```

Then open <http://localhost:8080>. It is a static site — any host that serves files will do.

Opening `index.html` straight off the filesystem will not work: the app is ES modules, which
browsers refuse to load over `file://`.

## The five steps, and where each one lives

The site promises a five-step product. Each step is a screen:

| Step | Screen | Source |
| --- | --- | --- |
| 1. Set your goal | Onboarding | `js/views/onboarding.js` |
| 2. Get your personalised plan | Plan | `js/planner.js`, `js/views/plan.js` |
| 3. Track & verify | Today | `js/views/today.js`, `js/ui.js` |
| 4. Invest in yourself | Vest | `js/vesting.js`, `js/views/vest.js` |
| 5. Share your progress | Partner | `js/views/partner.js` |

Plus **Progress** (`js/views/progress.js`) for consistency, streaks and the evidence wall, and
**Settings** for your goals and your data.

## How the planner works

`js/planner.js` is the interesting part. It reads the goal the way a coach would:

- **Category detection** — regex matchers over the goal text pick one of nine templates
  (endurance, strength, body composition, business, creative, learning, money, habit, career)
  with a generic fallback. "I want to run a marathon" is endurance; "Get promoted to senior
  engineer" is career.
- **Specifics** — it pulls real parameters out of the sentence. A marathon means 42.2 km, so the
  long run is built back from that and peaks at 32 km. "Write a 60,000 word novel" sizes the
  per-session word count against the number of sessions available.
- **Phases** — the timeline splits into four phases by share (Base → Build → Peak → Taper for
  endurance; Validate → Build → Launch → Grow for business), each ending in a milestone.
- **Progression** — each phase generates that specific week's sessions, so volume ramps, every
  fourth week steps down 25%, and the last weeks taper.
- **Fitting** — sessions are placed on the days the user actually has. When a phase defines more
  session types than there are slots, the first session is the week's anchor and always runs,
  while the rest rotate by week number so nothing is orphaned. The anchor is placed on the last
  day of the week, which puts the long run on the weekend.

It is deterministic and local: same input, same plan, no network, works offline.

### Swapping in a hosted model

`buildPlan(draft)` is the only seam. Replace its body with a call to a model and nothing else
changes, as long as you return the same shape:

```js
{ category, categoryLabel, phases: [...], actions: [...], tasks: [...], rationale: [...] }
```

`phases[]` need `{ id, index, name, summary, startWeek, endWeek, startDate, endDate, milestone }`
and `tasks[]` need `{ id, date, title, detail, minutes, verify, phaseId, week, status }`, where
`verify` is one of `photo | note | timer | metric | check`. Everything downstream — scheduling,
stats, vesting, sharing — reads only those fields. Keep the local engine as the offline
fallback; a goal-setting flow that fails because an API is down is worse than a generic plan.

## How vesting works

`js/vesting.js`. The stake is split 60/40:

- **60% weekly.** Complete ≥80% of a week's sessions and that week's share vests.
- **40% at milestones.** One tranche per phase.
- **Missed weeks are recoverable, not burned.** A failed week's share moves to an at-risk pool.
  A following week where you complete *every* session wins a share of it back. Whatever is still
  in the pool when the goal ends is forfeited.

That middle step is deliberate. One bad week is the most common point of abandonment, and a plan
that punishes it permanently gets deleted rather than resumed.

The ledger is recomputed from the tasks on every change rather than stored incrementally, so it
can never drift from what the user actually did. One thing *is* held: each week's share of the
stake is frozen the first time that week settles. Without that, adjusting the plan would
re-divide the stake across a new number of weeks and quietly claw back money already earned —
the opposite of what adjusting is meant to allow. Whether a week passed is never frozen, so
undoing the work still puts the money back at risk.

## What is simulated

Everything works for real except two things, both of which need a server:

- **No money moves.** The stake, the vesting maths and the ledger all run, but no payment is
  taken and nothing is held. Wiring this to a payment processor is the one genuinely
  backend-shaped piece.
- **Nothing is sent to your partner.** The weekly digest is generated in full and can be copied
  or shared, but the app does not email or message anyone.

Both are labelled as such in the UI rather than implied to work.

## Data

Everything lives in `localStorage` under `vestself.state.v1` on the device. There is no account,
no sync, and no network request anywhere in this codebase.

Photo proof is downscaled to 640px JPEG before it is stored, because the localStorage quota is
about 5MB and a phone photo is several. If a write hits the quota anyway, the oldest photos are
dropped (the sessions stay verified, the image is marked as cleared) and the write is retried.

Settings → Your data exports and re-imports the whole state as JSON. Clearing browser site data
erases everything.

## Layout

```
index.html            shell
manifest.webmanifest  installable as a PWA
css/tokens.css        brand tokens — colours, type, spacing, the neon bloom
css/app.css           components and layout
js/app.js             routing and the app shell
js/store.js           state, persistence, all mutations
js/planner.js         goal text → phases, sessions, dated tasks
js/vesting.js         the stake ledger
js/stats.js           derived numbers: streaks, adherence, heatmap
js/ui.js              toasts, modals, the progress ring, proof capture
js/lib/               hyperscript, date helpers, icons
js/views/             one file per screen
```

No framework. Views are functions from state to DOM nodes; a store change re-renders the current
view. `js/lib/dom.js` is a 70-line hyperscript, and that is the whole abstraction.

## Notes on the brand

Colours, type scale and the neon-bloom card treatment are taken from the Vest Self brand system
used on the marketing site. Satoshi is a licensed face, so no font files are redistributed here —
the stack picks up a locally installed Satoshi and otherwise falls back to the platform UI face.
To self-host it, drop the `.woff2` files into `assets/fonts/` and uncomment the `@font-face`
block at the top of `css/tokens.css`.

## Linting

```sh
npx eslint js
```

`eslint.config.js` covers the browser globals this app uses. There is no other tooling.
