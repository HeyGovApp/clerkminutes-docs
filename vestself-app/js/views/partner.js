/**
 * Partner — step 5, "Share your progress". The person in your corner, the
 * weekly digest they get, and a card worth posting.
 */
import { el, mount } from "../lib/dom.js";
import { icon } from "../lib/icons.js";
import { today, formatShort, formatDay, startOfWeek } from "../lib/date.js";
import { setPartner, logCheckin } from "../store.js";
import { weekBuckets, goalProgress, currentStreak, currentPhase, verifiedCount } from "../stats.js";
import { money, WEEK_PASS } from "../vesting.js";
import { openModal, toast, sectionHead, empty, copyText } from "../ui.js";

export function partnerView(goal, { rerender }) {
  const root = el("div.view");
  const partner = goal.partner;
  const week = weekBuckets(goal).find((w) => w.weekKey === startOfWeek(today()));
  const progress = goalProgress(goal);

  mount(root,
    el("div.view-head",
      el("p.eyebrow", "People in your corner"),
      el("h1", "Share your progress"),
      el("p.sub", "Accountability is the difference between a plan and a result.")),

    partner ? partnerCard(goal, partner, rerender) : noPartner(goal, rerender),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("This week's digest", partner ? `What ${partner.name} would receive on Sunday night.` : "What your partner would receive each Sunday.",
        el("button.btn.btn-ghost.btn-sm", { type: "button", onClick: () => copyText(digestText(goal, week, progress), "Digest copied") }, icon("copy"), "Copy")),
      el("pre.digest", digestText(goal, week, progress))),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("Your progress card", "For the group chat, the feed, or your own wall.",
        el("div.row",
          el("button.btn.btn-ghost.btn-sm", { type: "button", onClick: () => downloadCard(goal, progress) }, icon("download"), "Save card"),
          el("button.btn.btn-gold.btn-sm", { type: "button", onClick: () => shareCard(goal, progress) }, icon("share"), "Share"))),
      cardPreview(goal, progress)),

    el("div", { style: { marginTop: "var(--space-10)" } },
      sectionHead("Check-ins", "A line a week is enough. Future you will read these.",
        el("button.btn.btn-ghost.btn-sm", { type: "button", onClick: () => checkinDialog(goal, rerender) }, icon("plus"), "Add check-in")),
      goal.checkins.length
        ? el("div.stack", ...goal.checkins.map((entry) => el("div.card.card-quiet",
            el("div.row-between", { style: { marginBottom: "var(--space-2)" } },
              el("span.pill", icon("chat"), entry.mood || "Check-in"),
              el("span.muted.mono", { style: { fontSize: "var(--text-xs)" } }, formatDay(entry.date))),
            el("p", { style: { fontSize: "var(--text-sm)" } }, entry.note))))
        : empty("chat", "No check-ins yet", "Write the first one after this week's last session.")),
  );

  return root;
}

/* ---------- partner ---------- */

function partnerCard(goal, partner, rerender) {
  return el("div.card.neon",
    el("div.row-between", { style: { flexWrap: "wrap", gap: "var(--space-4)" } },
      el("div.row",
        el("div", { style: { width: "48px", height: "48px", borderRadius: "50%", background: "var(--grad-gold)", display: "grid", placeItems: "center", color: "var(--fg-on-brand)", fontWeight: 700, fontSize: "19px" } },
          partner.name.trim().charAt(0).toUpperCase() || "?"),
        el("div.stack-sm",
          el("h3", partner.name),
          el("p.muted", { style: { fontSize: "var(--text-sm)" } }, partner.contact || "No contact details saved"))),
      el("button.btn.btn-ghost.btn-sm", { type: "button", onClick: () => partnerDialog(goal, rerender) }, icon("settings"), "Change")));
}

function noPartner(goal, rerender) {
  return empty("partner", "No one's watching yet",
    "Pick one person who'll notice if you go quiet. It roughly doubles the odds you finish.",
    el("button.btn.btn-gold", { type: "button", onClick: () => partnerDialog(goal, rerender) }, icon("plus"), "Add a partner"));
}

function partnerDialog(goal, rerender) {
  const name = el("input.input", { type: "text", placeholder: "Their name", value: goal.partner?.name || "" });
  const contact = el("input.input", { type: "text", placeholder: "Email or phone (optional)", value: goal.partner?.contact || "" });
  const dialog = openModal({
    title: "Accountability partner",
    body: el("div.stack",
      el("div.field", el("label", "Name"), name),
      el("div.field", el("label", "Contact"), contact,
        el("p.hint", "Stored on your device only — this build sends nothing anywhere.")),
      goal.partner && el("button.btn.btn-danger.btn-block", { type: "button",
        onClick: () => { dialog.close(); setPartner(goal.id, null); rerender(); } }, icon("trash"), "Remove partner")),
    actions: [
      el("button.btn.btn-quiet", { type: "button", onClick: () => dialog.close() }, "Cancel"),
      el("button.btn.btn-gold", { type: "button", onClick: () => {
        if (!name.value.trim()) { toast("They need a name", "warning"); return; }
        dialog.close();
        setPartner(goal.id, { name: name.value.trim(), contact: contact.value.trim() });
        toast("Partner saved");
        rerender();
      } }, "Save"),
    ],
  });
  setTimeout(() => name.focus());
}

function checkinDialog(goal, rerender) {
  const note = el("textarea.textarea", { placeholder: "How did the week actually go?" });
  const moods = ["Flying", "Steady", "Grinding", "Struggling"];
  let mood = "Steady";
  const chips = moods.map((m) => el("button.chip", { type: "button", "aria-pressed": m === mood,
    onClick: (ev) => { mood = m; for (const b of ev.currentTarget.parentElement.children) b.setAttribute("aria-pressed", "false"); ev.currentTarget.setAttribute("aria-pressed", "true"); } }, m));

  const dialog = openModal({
    title: "Weekly check-in",
    body: el("div.stack",
      el("div.field", el("span.field-label", "How's it feeling?"), el("div.row.wrap", { style: { gap: "6px" } }, ...chips)),
      el("div.field", note)),
    actions: [
      el("button.btn.btn-quiet", { type: "button", onClick: () => dialog.close() }, "Cancel"),
      el("button.btn.btn-gold", { type: "button", onClick: () => {
        dialog.close();
        logCheckin(goal.id, { note: note.value.trim() || "(no note)", mood, sharedWith: goal.partner?.name || null });
        toast("Check-in logged");
        rerender();
      } }, "Save check-in"),
    ],
  });
  setTimeout(() => note.focus());
}

/* ---------- digest ---------- */

function digestText(goal, week, progress) {
  const name = goal.partner?.name || "there";
  const phase = currentPhase(goal);
  const done = week?.done || 0;
  const planned = week?.planned || 0;
  const passed = planned && done / planned >= WEEK_PASS;
  const lines = [
    `Hi ${name},`,
    ``,
    `Weekly update on: ${goal.title}`,
    `Week of ${formatShort(startOfWeek(today()))}`,
    ``,
    `  Sessions this week   ${done}/${planned}${passed ? "  ✓ target hit" : planned ? "  — below target" : ""}`,
    `  Overall on plan      ${Math.round(progress.adherence * 100)}%`,
    `  Current phase        ${phase ? `${phase.name} (${phase.index} of ${goal.plan.phases.length})` : "—"}`,
    `  Streak               ${currentStreak(goal)} days`,
    `  Verified sessions    ${verifiedCount(goal)}`,
  ];
  if (goal.stake.amount) {
    lines.push(`  Stake earned back    ${money(goal.stake.vested, goal.stake.currency)} of ${money(goal.stake.amount, goal.stake.currency)}`);
    if (goal.stake.recoverable > 0) lines.push(`  At risk              ${money(goal.stake.recoverable, goal.stake.currency)}`);
  }
  lines.push(
    ``,
    `Next milestone: ${nextMilestone(goal)}`,
    ``,
    passed ? `Ask them how the ${phase?.name.toLowerCase() || "next"} phase is going.` : `They're behind this week. Worth a message.`,
    ``,
    `— sent by vest self`,
  );
  return lines.join("\n");
}

function nextMilestone(goal) {
  const next = goal.plan.phases.find((p) => p.milestone.status === "pending");
  return next ? `${next.milestone.title} — due ${formatShort(next.milestone.dueDate)}` : "All milestones settled";
}

/* ---------- share card ---------- */

const CARD_W = 1080;
const CARD_H = 1350;

function cardSVG(goal, progress) {
  const phase = currentPhase(goal);
  const pct = Math.round(progress.adherence * 100);
  const streak = currentStreak(goal);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const title = wrapText(goal.title, 22).slice(0, 3);
  const metrics = [
    [`${pct}%`, "on plan"],
    [`${streak}`, streak === 1 ? "day streak" : "day streak"],
    [`${progress.done}`, "sessions done"],
  ];
  if (goal.stake.amount) metrics.push([money(goal.stake.vested, goal.stake.currency), "earned back"]);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" font-family="Satoshi, Inter, -apple-system, Segoe UI, system-ui, sans-serif">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFC919"/><stop offset="1" stop-color="#E6C15A"/>
    </linearGradient>
    <radialGradient id="bloomA" cx="0.16" cy="1.1" r="0.7">
      <stop offset="0" stop-color="#8B2BFF" stop-opacity="0.85"/><stop offset="1" stop-color="#8B2BFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomB" cx="0.5" cy="1.12" r="0.7">
      <stop offset="0" stop-color="#DB139C" stop-opacity="0.8"/><stop offset="1" stop-color="#DB139C" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomC" cx="0.86" cy="1.05" r="0.75">
      <stop offset="0" stop-color="#EA671B" stop-opacity="0.85"/><stop offset="1" stop-color="#EA671B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomD" cx="0.68" cy="1.16" r="0.5">
      <stop offset="0" stop-color="#FFC919" stop-opacity="0.9"/><stop offset="1" stop-color="#FFC919" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${CARD_W}" height="${CARD_H}" fill="#0A0A0F"/>
  <g filter="blur(0)">
    <rect y="${CARD_H * 0.35}" width="${CARD_W}" height="${CARD_H * 0.65}" fill="url(#bloomA)"/>
    <rect y="${CARD_H * 0.35}" width="${CARD_W}" height="${CARD_H * 0.65}" fill="url(#bloomB)"/>
    <rect y="${CARD_H * 0.35}" width="${CARD_W}" height="${CARD_H * 0.65}" fill="url(#bloomC)"/>
    <rect y="${CARD_H * 0.35}" width="${CARD_W}" height="${CARD_H * 0.65}" fill="url(#bloomD)"/>
  </g>

  <path d="M92 118h30l26 66 26-66h30l-42 106h-28L92 118z" fill="url(#gold)"/>
  <text x="212" y="204" fill="#FFFCF5" font-size="56" font-weight="700" letter-spacing="-1">vest <tspan fill="#E6C15A">self</tspan></text>

  <text x="92" y="360" fill="rgba(255,252,245,0.52)" font-size="30" letter-spacing="7" font-weight="600">${esc((phase?.name || "IN PROGRESS").toUpperCase())}</text>
  ${title.map((line, i) => `<text x="92" y="${450 + i * 92}" fill="#FFFCF5" font-size="82" font-weight="700" letter-spacing="-2">${esc(line)}</text>`).join("\n  ")}

  <g>
    ${metrics.map(([value, label], i) => {
      const x = 92 + (i % 2) * 480;
      const y = 800 + Math.floor(i / 2) * 200;
      return `<text x="${x}" y="${y}" fill="#E6C15A" font-size="96" font-weight="700" letter-spacing="-3">${esc(value)}</text>
    <text x="${x}" y="${y + 48}" fill="rgba(255,252,245,0.74)" font-size="32">${esc(label)}</text>`;
    }).join("\n    ")}
  </g>

  <rect x="92" y="${CARD_H - 232}" width="${CARD_W - 184}" height="6" rx="3" fill="rgba(255,252,245,0.14)"/>
  <rect x="92" y="${CARD_H - 232}" width="${Math.max(6, (CARD_W - 184) * Math.min(1, progress.rate))}" height="6" rx="3" fill="url(#gold)"/>
  <text x="92" y="${CARD_H - 168}" fill="rgba(255,252,245,0.74)" font-size="32">${esc(`${progress.done} of ${progress.planned} actions · ${progress.weeksLeft} weeks to go`)}</text>
  <text x="92" y="${CARD_H - 96}" fill="rgba(255,252,245,0.52)" font-size="30">Invest in your best self.</text>
</svg>`;
}

function wrapText(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max) { if (line) lines.push(line.trim()); line = word; }
    else line = `${line} ${word}`;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function cardPreview(goal, progress) {
  const wrap = el("div", { style: { maxWidth: "420px", borderRadius: "var(--radius-xl)", overflow: "hidden", border: "1px solid var(--border-1)" },
    html: cardSVG(goal, progress).replace(`width="${CARD_W}" height="${CARD_H}"`, 'style="width:100%;height:auto;display:block"') });
  return wrap;
}

/** Rasterise the SVG through a canvas — no library, works offline. */
function renderCardPNG(goal, progress) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([cardSVG(goal, progress)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = el("canvas", { width: CARD_W, height: CARD_H });
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0A0A0F";
      ctx.fillRect(0, 0, CARD_W, CARD_H);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("encode failed"))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("render failed")); };
    img.src = url;
  });
}

/**
 * Show the rendered card full size with an explicit save link.
 *
 * A click-the-hidden-anchor download is silently ignored in a sandboxed frame
 * and on mobile Safari, so the card is put on screen and saving is left to the
 * user — a link they can click, or long-press on a phone. That works
 * everywhere, and it lets them see what they're about to post.
 */
async function downloadCard(goal, progress) {
  let url;
  try {
    url = URL.createObjectURL(await renderCardPNG(goal, progress));
  } catch {
    toast("Could not render the card", "warning");
    return;
  }
  const name = `vest-self-${goal.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.png`;
  const dialog = openModal({
    title: "Your card",
    body: el("div.stack",
      el("img.proof-preview", { src: url, alt: "Your progress card" }),
      el("p.hint", "Click save below, or long-press the image on a phone.")),
    actions: [
      el("a.btn.btn-gold", { href: url, download: name, target: "_blank", rel: "noopener" }, icon("download"), "Save image"),
    ],
    onClose: () => setTimeout(() => URL.revokeObjectURL(url), 2000),
  });
  return dialog;
}

async function shareCard(goal, progress) {
  const text = `${goal.title} — ${Math.round(progress.adherence * 100)}% on plan, ${currentStreak(goal)} day streak. Invest in your best self.`;
  try {
    const blob = await renderCardPNG(goal, progress);
    const file = new File([blob], "vest-self.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
    if (navigator.share) { await navigator.share({ text }); return; }
    await copyText(text, "Progress copied — paste it anywhere");
  } catch (err) {
    if (err?.name === "AbortError") return;
    await copyText(text, "Progress copied — paste it anywhere");
  }
}
