/**
 * Shared UI pieces: toasts, modals, the progress ring, and the proof capture
 * flow that sits behind "Track & verify".
 */
import { el, svg, mount } from "./lib/dom.js";
import { icon } from "./lib/icons.js";

/* ============================================================
   Toasts
   ============================================================ */

let toastHost = null;

export function toast(message, iconName = "check") {
  if (!toastHost) {
    toastHost = el("div.toasts", { role: "status", "aria-live": "polite" });
    document.body.appendChild(toastHost);
  }
  const node = el("div.toast", icon(iconName), el("span", message));
  toastHost.appendChild(node);
  setTimeout(() => {
    node.classList.add("is-out");
    setTimeout(() => node.remove(), 260);
  }, 2600);
}

/* ============================================================
   Modal
   ============================================================ */

/**
 * @param {{title?: string, body: Node|Node[], actions?: Node[], onClose?: Function}} opts
 * @returns {HTMLDialogElement}
 */
export function openModal({ title, body, actions, onClose }) {
  const dialog = el("dialog.modal");
  const card = el("div.modal-card",
    title && el("h3", title),
    body,
    actions?.length && el("div.row", { style: { justifyContent: "flex-end", flexWrap: "wrap" } }, ...actions),
  );
  const wrap = el("div.modal-wrap", card,
    el("button.modal-close", { type: "button", "aria-label": "Close", onClick: () => dialog.close() }, icon("close")));

  dialog.appendChild(wrap);
  dialog.addEventListener("close", () => { onClose?.(dialog.returnValue); dialog.remove(); });
  // Click on the backdrop (i.e. outside the card) closes.
  dialog.addEventListener("click", (ev) => { if (ev.target === dialog) dialog.close(); });
  document.body.appendChild(dialog);
  dialog.showModal();
  return dialog;
}

export function confirmModal({ title, message, confirmLabel = "Confirm", danger = false, onConfirm }) {
  const dialog = openModal({
    title,
    body: el("p.muted", message),
    actions: [
      el("button.btn.btn-ghost", { type: "button", onClick: () => dialog.close() }, "Cancel"),
      el(`button.btn.${danger ? "btn-danger" : "btn-gold"}`, {
        type: "button",
        onClick: () => { dialog.close(); onConfirm(); },
      }, confirmLabel),
    ],
  });
  return dialog;
}

/* ============================================================
   Progress ring
   ============================================================ */

export function ring(percent, { size = 96, label = "", value = null } = {}) {
  const pct = Math.max(0, Math.min(1, percent || 0));
  const r = 42;
  const circumference = 2 * Math.PI * r;
  return svg("svg", { class: "ring", viewBox: "0 0 100 100", width: size, height: size, role: "img", "aria-label": `${Math.round(pct * 100)}% ${label}` },
    svg("defs", {},
      svg("linearGradient", { id: "ringGold", x1: "0", y1: "0", x2: "1", y2: "1" },
        svg("stop", { offset: "0", "stop-color": "#FFC919" }),
        svg("stop", { offset: "1", "stop-color": "#E6C15A" }))),
    svg("circle", { class: "ring-track", cx: 50, cy: 50, r, fill: "none", "stroke-width": 8 }),
    svg("circle", {
      class: "ring-fill", cx: 50, cy: 50, r, fill: "none", "stroke-width": 8,
      "stroke-dasharray": circumference,
      "stroke-dashoffset": circumference * (1 - pct),
      transform: "rotate(-90 50 50)",
    }),
    svg("text", { x: 50, y: 54, "text-anchor": "middle", fill: "#FFFCF5", "font-size": "22", "font-weight": "700" },
      value != null ? value : `${Math.round(pct * 100)}%`),
  );
}

export function stat(value, label, { tone = "", detail = "" } = {}) {
  return el(`div.stat${tone ? `.is-${tone}` : ""}`,
    el("div.n", value),
    el("div.l", label),
    detail && el("div.d", detail));
}

export function sectionHead(title, sub, action) {
  return el("div.row-between", { style: { marginBottom: "var(--space-4)" } },
    el("div.stack-sm", el("h3", title), sub && el("p.muted", { style: { fontSize: "var(--text-sm)" } }, sub)),
    action);
}

export function empty(iconName, title, message, action) {
  return el("div.empty", icon(iconName), el("h3", title), el("p", message), action);
}

/* ============================================================
   Proof capture — the "verify" half of Track & Verify
   ============================================================ */

export const VERIFY_LABELS = {
  photo:  { label: "Photo proof", icon: "camera", hint: "A picture that shows it happened." },
  note:   { label: "Written note", icon: "note",  hint: "A line or two on what you actually did." },
  timer:  { label: "Time logged", icon: "timer",  hint: "How long you actually spent." },
  metric: { label: "Number logged", icon: "progress", hint: "The figure you hit." },
  check:  { label: "Self check-off", icon: "check", hint: "Just mark it done." },
};

/**
 * Ask for whatever proof the task requires, then hand back a proof object.
 * @param {object} task
 * @param {(proof: object) => void} onDone
 */
export function captureProof(task, onDone) {
  const kind = VERIFY_LABELS[task.verify] ? task.verify : "check";
  const meta = VERIFY_LABELS[kind];
  const value = { data: null };

  const body = el("div.stack");
  body.appendChild(el("div.stack-sm",
    el("p.eyebrow", meta.label),
    el("p", { style: { fontWeight: 600 } }, task.title),
    task.detail && el("p.muted", { style: { fontSize: "var(--text-sm)" } }, task.detail)));

  let submit;
  const setReady = (ready) => { if (submit) submit.disabled = !ready; };

  if (kind === "photo") {
    const preview = el("div");
    const input = el("input", { type: "file", accept: "image/*", capture: "environment", style: { display: "none" },
      onChange: async (ev) => {
        const file = ev.target.files?.[0];
        if (!file) return;
        try {
          value.data = await downscale(file);
          mount(preview, el("img.proof-preview", { src: value.data, alt: "Your proof" }));
          setReady(true);
        } catch {
          mount(preview, el("p.muted", "That image could not be read. Try another."));
        }
      } });
    const drop = el("button.proof-drop", { type: "button", onClick: () => input.click() },
      icon("camera"), el("span", "Take or choose a photo"), el("span.muted", { style: { fontSize: "var(--text-xs)" } }, meta.hint));
    body.appendChild(el("div.proof-picker", drop, input, preview));
    setTimeout(() => setReady(false));
  } else if (kind === "note") {
    const field = el("textarea.textarea", { placeholder: "What did you do? Be specific — future you is reading this.",
      onInput: (ev) => { value.data = ev.target.value.trim(); setReady(value.data.length > 2); } });
    body.appendChild(el("div.field", el("label", { for: "" }, meta.hint), field));
    setTimeout(() => { field.focus(); setReady(false); });
  } else if (kind === "timer") {
    const field = el("input.input", { type: "number", min: "1", max: "600", value: task.minutes || 30,
      onInput: (ev) => { value.data = ev.target.value; setReady(Number(ev.target.value) > 0); } });
    value.data = String(task.minutes || 30);
    body.appendChild(el("div.field", el("label", "Minutes spent"), field, el("p.hint", meta.hint)));
  } else if (kind === "metric") {
    const field = el("input.input", { type: "text", placeholder: "e.g. 14.2 km · 82.5 kg · 5 conversations",
      onInput: (ev) => { value.data = ev.target.value.trim(); setReady(value.data.length > 0); } });
    body.appendChild(el("div.field", el("label", "What did you hit?"), field, el("p.hint", meta.hint)));
    setTimeout(() => { field.focus(); setReady(false); });
  } else {
    body.appendChild(el("p.muted", "Mark this done and it counts toward this week's vesting."));
    value.data = true;
  }

  submit = el("button.btn.btn-gold", { type: "button",
    onClick: () => {
      dialog.close();
      onDone({ type: kind, value: value.data, at: new Date().toISOString() });
    } }, icon("check"), "Mark done");

  const dialog = openModal({
    title: "Verify it",
    body,
    actions: [
      el("button.btn.btn-quiet", { type: "button", onClick: () => dialog.close() }, "Cancel"),
      submit,
    ],
  });
  return dialog;
}

/**
 * Photos live in localStorage, so they get resized hard before they are
 * stored — a phone photo is several megabytes and the quota is about five.
 */
export function downscale(file, max = 640, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = el("canvas", { width: Math.round(img.width * scale), height: Math.round(img.height * scale) });
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Copy helper that degrades to a selectable prompt where clipboard is blocked. */
export async function copyText(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(message, "copy");
  } catch {
    const area = el("textarea.textarea", { readonly: true }, text);
    openModal({ title: "Copy this", body: el("div.stack", el("p.muted", "Select and copy:"), area) });
    area.select();
  }
}
