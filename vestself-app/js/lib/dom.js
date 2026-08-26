/**
 * Tiny hyperscript. Returns real DOM nodes so views stay plain data → DOM,
 * with no framework and no build step.
 */

/**
 * @param {string} tag  e.g. "div", "button.btn.btn-gold", "input#email"
 * @param {object} [props] attributes, `class`, `style` object, on* handlers, dataset
 * @param {...(Node|string|number|false|null|undefined|Array)} children
 */
export function el(tag, props, ...children) {
  const [name, ...rest] = tag.split(/(?=[.#])/);
  const node = document.createElement(name || "div");

  for (const token of rest) {
    if (token[0] === ".") node.classList.add(token.slice(1));
    else if (token[0] === "#") node.id = token.slice(1);
  }

  if (props && (props.nodeType || Array.isArray(props) || typeof props !== "object")) {
    children.unshift(props);
    props = null;
  }

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.classList.add(...String(value).split(/\s+/).filter(Boolean));
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && key !== "list" && typeof value !== "object") node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }

  append(node, children);
  return node;
}

/** SVG-namespaced sibling of `el`, for charts and icons. */
export function svg(tag, props, ...children) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === true) continue;
    node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node);
  append(node, children);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Crypto-backed id with a readable prefix. */
export function uid(prefix = "id") {
  const rand = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}_${rand[0].toString(36)}${rand[1].toString(36)}`;
}
