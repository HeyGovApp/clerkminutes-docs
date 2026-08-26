/**
 * Inline icon set — stroke geometry, 24×24, drawn in the brand's thin/regular
 * weight. Inlined rather than pulled from a CDN so the app renders offline and
 * icons inherit `currentColor` everywhere.
 */
import { svg } from "./dom.js";

const PATHS = {
  today:    ["M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"],
  plan:     ["M8 6h13", "M8 12h13", "M8 18h13", "M3.6 6h.01", "M3.6 12h.01", "M3.6 18h.01"],
  vest:     ["M3 8.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h11v3", "M16.5 14h.01"],
  progress: ["M4 19V5", "M4 19h16", "M7.5 15.5l3.5-4.5 3 2.2 4.5-6"],
  partner:  ["M15.5 19v-1.4a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 17.6V19", "M17.8 14.4a3.4 3.4 0 0 1 2.7 3.3V19", "M16.2 5.4a3.2 3.2 0 0 1 0 5.3"],
  partnerCircle: ["M9.75 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"],
  goal:     ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4z", "M12 13.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8z"],
  check:    ["M20 6.5 9.2 17.3 4 12.1"],
  flame:    ["M12 21.5c3.9 0 6.9-2.7 6.9-6.4 0-4.5-4.4-6-5.4-11.4-2 1.5-4 4-4 6.4 0 1.5.5 2.5.5 2.5S8.1 11 7.1 9c-1 1.5-2 3.5-2 6.1 0 3.7 3 6.4 6.9 6.4z"],
  calendar: ["M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z", "M8 3.5v4", "M16 3.5v4", "M4 10h16"],
  clock:    ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7.2V12l3.1 2"],
  camera:   ["M4.5 7.8h3l1.4-2.3h6.2l1.4 2.3h3a1 1 0 0 1 1 1v9.4a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V8.8a1 1 0 0 1 1-1z", "M12 17a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z"],
  note:     ["M4 20h4L20.1 7.9a2.8 2.8 0 1 0-4-4L4 16v4z", "M14.5 5.5l4 4"],
  timer:    ["M12 21.5a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M12 9.8v3.7l2.4 1.6", "M9.5 2.5h5"],
  plus:     ["M12 5.2v13.6", "M5.2 12h13.6"],
  close:    ["M6.2 6.2l11.6 11.6", "M17.8 6.2 6.2 17.8"],
  arrowRight: ["M4.5 12h14.4", "M13 6.2l6 5.8-6 5.8"],
  arrowLeft:  ["M19.5 12H5.1", "M11 6.2 5 12l6 5.8"],
  sparkle:  ["M11 3.2l1.85 4.95L17.8 10l-4.95 1.85L11 16.8l-1.85-4.95L4.2 10l4.95-1.85L11 3.2z", "M18 15.4l.78 2.08 2.08.78-2.08.78-.78 2.08-.78-2.08-2.08-.78 2.08-.78.78-2.08z"],
  verified: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M8.2 12.1l2.6 2.6 5-5.4"],
  share:    ["M4.5 12.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-6.5", "M12 15V3.6", "M8.2 7.4 12 3.6l3.8 3.8"],
  download: ["M4.5 15.2V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3.8", "M12 3.6V15", "M8.2 11.2 12 15l3.8-3.8"],
  copy:     ["M9.4 8.6h9.2a1 1 0 0 1 1 1v9.2a1 1 0 0 1-1 1H9.4a1 1 0 0 1-1-1V9.6a1 1 0 0 1 1-1z", "M5.6 15.4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9.4a1 1 0 0 1 1 1v.6"],
  trash:    ["M4.5 7h15", "M9.5 7V4.4h5V7", "M6.6 7l1 12.2a1 1 0 0 0 1 .9h6.8a1 1 0 0 0 1-.9L17.4 7"],
  settings: ["M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z", "M12 2.8l1.5 2.1 2.5-.4.7 2.5 2.4 1-.8 2.4.8 2.4-2.4 1-.7 2.5-2.5-.4L12 21.2l-1.5-2.1-2.5.4-.7-2.5-2.4-1 .8-2.4-.8-2.4 2.4-1 .7-2.5 2.5.4L12 2.8z"],
  lightning: ["M13.4 2.6 4.8 14.2h6.1l-1.3 7.2 8.6-11.6h-6.1l1.3-7.2z"],
  crown:    ["M3.4 7.6 7.6 11l4.4-6.6L16.4 11l4.2-3.4-1.9 11.4H5.3L3.4 7.6z"],
  gift:     ["M4.5 12.6h15V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-6.4z", "M3.6 8.6h16.8v4H3.6z", "M12 8.6V20", "M12 8.6S10.7 4 8.3 4a2.3 2.3 0 0 0 0 4.6H12z", "M12 8.6s1.3-4.6 3.7-4.6a2.3 2.3 0 0 1 0 4.6H12z"],
  pause:    ["M9.4 5v14", "M14.6 5v14"],
  refresh:  ["M20 12a8 8 0 1 1-2.6-5.9", "M20.2 4.4v5h-5"],
  warning:  ["M12 3.6 2.9 19.9h18.2L12 3.6z", "M12 10v4.2", "M12 17.4h.01"],
  wallet:   ["M3.5 7.4A1.9 1.9 0 0 1 5.4 5.5h11.3", "M3.5 7.4V18a1.9 1.9 0 0 0 1.9 1.9h13.2A1.9 1.9 0 0 0 20.5 18v-6.7a1.9 1.9 0 0 0-1.9-1.9H3.5", "M16.6 14.6h.01"],
  chat:     ["M20.5 11.6a7.9 7.9 0 0 1-8 7.9H4.6l1.9-3a7.9 7.9 0 1 1 14-4.9z"],
  focus:    ["M12 14.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z", "M6.2 19.4c.9-2.5 3.1-3.7 5.8-3.7s4.9 1.2 5.8 3.7", "M3.6 8.4v-4h4", "M16.4 4.4h4v4", "M20.4 15.6v4h-4", "M7.6 19.6h-4v-4"],
  pin:      ["M12 21s6.5-5.6 6.5-10.3a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21z", "M12 13.3a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z"],
  mail:     ["M4.5 5.5h15a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z", "M4 7l8 5.4L20 7"],
  more:     ["M6 12h.01", "M12 12h.01", "M18 12h.01"],
  inbox:    ["M4.5 4.5h15a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z", "M3.6 14h4l1.4 2.4h6L16.4 14h4"],
};

/**
 * @param {keyof typeof PATHS} name
 * @param {{size?: number, class?: string, strokeWidth?: number}} [opts]
 */
export function icon(name, opts = {}) {
  const paths = PATHS[name] || PATHS.goal;
  return svg("svg", {
    class: `icon ${opts.class || ""}`.trim(),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": opts.strokeWidth || 1.7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
    ...(opts.size ? { width: opts.size, height: opts.size } : {}),
  }, ...paths.map((d) => svg("path", { d })));
}

export const ICON_NAMES = Object.keys(PATHS);

/** The vest self wordmark chevron, used as the app's brand mark. */
export function brandMark(size = 34) {
  return svg("svg", {
    class: "brand-mark", viewBox: "0 0 48 48", width: size, height: size,
    role: "img", "aria-label": "vest self",
  },
    svg("defs", {}, svg("linearGradient", { id: "vsMark", x1: "0", y1: "0", x2: "1", y2: "1" },
      svg("stop", { offset: "0", "stop-color": "#FFC919" }),
      svg("stop", { offset: "1", "stop-color": "#E6C15A" }),
    )),
    svg("path", { d: "M6 9h9.6l8.4 21.4L32.4 9H42L28.6 41h-9.2L6 9z", fill: "url(#vsMark)" }),
  );
}
