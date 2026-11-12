/**
 * @name FolderPictures
 * @author Pota
 * @description Give server folders their own look instead of the 2x2 grid of their servers: a picture (file or link), an ASCII preset or an icon. Right-click a folder > Folder look.
 * @version 1.0.0
 * @source https://github.com/Plyxen/discord-rice
 * @website https://github.com/Plyxen/discord-rice
 */

/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This file is built, don't edit it: the source is betterdiscord/src/folderPictures.tsx and the Vencord
 * plugin it shares its code with, and betterdiscord/src/build.mjs puts them together.
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// betterdiscord/src/folderPictures.tsx
var folderPictures_exports = {};
__export(folderPictures_exports, {
  default: () => FolderPictures
});
module.exports = __toCommonJS(folderPictures_exports);

// betterdiscord/src/shims/globals.ts
var THEME_FILE = "discord-rice.theme.css";
var React = BdApi.React;
var VencordNative = {
  themes: {
    // "is the theme file in the themes folder?"
    async getThemesList() {
      try {
        return BdApi.Themes.get(THEME_FILE) ? [{ fileName: THEME_FILE }] : [];
      } catch {
        return [];
      }
    }
  },
  // BetterDiscord takes Discord's content rules away, so any picture link may load
  csp: void 0
};

// betterdiscord/src/shims/misc.ts
function definePlugin(plugin) {
  return plugin;
}
var NAMES = { RiceUpdater: "DiscordRiceUpdater" };
var plugins = new Proxy({}, {
  get(_, name) {
    try {
      return BdApi.Plugins.get(NAMES[name] ?? name)?.instance;
    } catch {
      return void 0;
    }
  }
});
var unpatch = /* @__PURE__ */ new Map();
function addGlobalContextMenuPatch(callback) {
  const patch = (res, props) => {
    const menu = res?.props?.navId ? res : res?.props?.children?.props?.navId ? res.props.children : res;
    if (!menu?.props) return;
    let { children } = menu.props;
    if (!Array.isArray(children)) children = menu.props.children = children == null ? [] : [children];
    callback(menu.props.navId, children, props);
  };
  unpatch.set(callback, BdApi.ContextMenu.patch(/./, patch));
}
function removeGlobalContextMenuPatch(callback) {
  unpatch.get(callback)?.();
  unpatch.delete(callback);
}
var db;
function open() {
  return db ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("discord-rice", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keyval");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function run(mode, action) {
  return open().then((database) => new Promise((resolve, reject) => {
    const request = action(database.transaction("keyval", mode).objectStore("keyval"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
function get(key) {
  return run("readonly", (store2) => store2.get(key));
}
function set(key, value) {
  return run("readwrite", (store2) => store2.put(value, key)).then(() => void 0);
}

// betterdiscord/src/shims/ui.tsx
var { useState, useEffect, useReducer, useRef, useMemo, useCallback } = BdApi.React;
function store(name) {
  return new Proxy({}, {
    get(_, key) {
      const found = BdApi.Webpack.getStore(name);
      const value = found?.[key];
      return typeof value === "function" ? value.bind(found) : value;
    }
  });
}
var GuildStore = store("GuildStore");
var SortedGuildStore = store("SortedGuildStore");
var UserStore = store("UserStore");
function showToast({ text, variant }) {
  BdApi.UI.showToast(text, { type: variant === "critical" ? "error" : variant === "positive" ? "success" : "info" });
}
var Menu = {
  get MenuItem() {
    return BdApi.ContextMenu.Item;
  },
  get MenuGroup() {
    return BdApi.ContextMenu.Group;
  },
  get MenuSeparator() {
    return BdApi.ContextMenu.Separator;
  }
};
var openModals = /* @__PURE__ */ new Set();
function closeAllModals() {
  [...openModals].forEach((close) => close());
}
function openModal(render) {
  const host = document.createElement("div");
  host.className = "rice-bd-host";
  document.body.appendChild(host);
  const root = BdApi.ReactDOM.createRoot(host);
  const close = () => {
    if (!openModals.delete(close)) return;
    document.removeEventListener("keydown", onKey, true);
    root.unmount();
    host.remove();
  };
  const onKey = (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    close();
  };
  document.addEventListener("keydown", onKey, true);
  openModals.add(close);
  root.render(
    /* @__PURE__ */ React.createElement("div", { className: "rice-bd-backdrop", onMouseDown: (e) => {
      if (e.target === e.currentTarget) close();
    } }, render({ onClose: close, transitionState: 1 }))
  );
  return close;
}
function Modal({ title, subtitle, notice, actions = [], children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "rice-bd-dialog", role: "dialog", "aria-modal": true, "aria-label": title }, /* @__PURE__ */ React.createElement("h2", null, title), subtitle && /* @__PURE__ */ React.createElement("p", null, subtitle), notice && /* @__PURE__ */ React.createElement("p", { className: "rice-bd-notice", role: "alert" }, notice.message), children, /* @__PURE__ */ React.createElement("div", { className: "rice-bd-actions" }, actions.map((a) => /* @__PURE__ */ React.createElement(Button, { key: a.text, variant: a.variant, disabled: a.disabled || a.loading, onClick: a.onClick }, a.loading ? "…" : a.text))));
}
function TextInput({ value, onChange, placeholder, maxLength, autoFocus }) {
  return /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "rice-bd-input",
      value,
      placeholder,
      maxLength,
      autoFocus,
      spellCheck: false,
      onChange: (e) => onChange(e.currentTarget.value)
    }
  );
}
function Select({ options, placeholder, isSelected, select, serialize }) {
  const current = options.find((o) => isSelected(o.value));
  return /* @__PURE__ */ React.createElement(
    "select",
    {
      className: "rice-bd-input",
      value: current ? serialize(current.value) : "",
      onChange: (e) => {
        const picked = options.find((o) => serialize(o.value) === e.currentTarget.value);
        if (picked) select(picked.value);
      }
    },
    /* @__PURE__ */ React.createElement("option", { value: "", disabled: true }, placeholder ?? "Choose…"),
    options.map((o) => /* @__PURE__ */ React.createElement("option", { key: serialize(o.value), value: serialize(o.value) }, o.label))
  );
}
function Button({ variant = "primary", size = "medium", className, children, ...rest }) {
  return /* @__PURE__ */ React.createElement("button", { className: `rice-bd-btn ${variant} ${size}${className ? " " + className : ""}`, ...rest }, children);
}
function Paragraph({ children }) {
  return /* @__PURE__ */ React.createElement("p", { className: "rice-bd-p" }, children);
}
var ErrorBoundary = class extends BdApi.React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[discord-rice]", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.noop ? null : /* @__PURE__ */ React.createElement("p", { className: "rice-bd-notice" }, "Something went wrong drawing this. The console has the details.");
  }
};

// vencord-plugins/folderPictures/icons.ts
var ICONS = {
  "star": '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  "flag": '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/> <line x1="4" x2="4" y1="22" y2="15"/>',
  "dices": '<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/> <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/> <path d="M6 18h.01"/> <path d="M10 14h.01"/> <path d="M15 6h.01"/> <path d="M18 9h.01"/>',
  "gamepad": '<line x1="6" x2="10" y1="11" y2="11"/> <line x1="8" x2="8" y1="9" y2="13"/> <line x1="15" x2="15.01" y1="12" y2="12"/> <line x1="18" x2="18.01" y1="10" y2="10"/> <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  "music": '<path d="M9 18V5l12-2v13"/> <circle cx="6" cy="18" r="3"/> <circle cx="18" cy="16" r="3"/>',
  "heart": '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  "code": '<polyline points="16 18 22 12 16 6"/> <polyline points="8 6 2 12 8 18"/>',
  "bookopen": '<path d="M12 7v14"/> <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  "palette": '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/> <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/> <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/> <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/> <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  "archive": '<rect width="20" height="5" x="2" y="3" rx="1"/> <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/> <path d="M10 12h4"/>',
  "house": '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/> <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  "bot": '<path d="M12 8V4H8"/> <rect width="16" height="12" x="4" y="8" rx="2"/> <path d="M2 14h2"/> <path d="M20 14h2"/> <path d="M15 13v2"/> <path d="M9 13v2"/>',
  "skull": '<path d="m12.5 17-.5-1-.5 1h1z"/> <path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/> <circle cx="15" cy="12" r="1"/> <circle cx="9" cy="12" r="1"/>',
  "sparkles": '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/> <path d="M20 3v4"/> <path d="M22 5h-4"/> <path d="M4 17v2"/> <path d="M5 18H3"/>',
  "ghost": '<path d="M9 10h.01"/> <path d="M15 10h.01"/> <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>',
  "moon": '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  "flame": '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  "zap": '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  "coffee": '<path d="M10 2v2"/> <path d="M14 2v2"/> <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/> <path d="M6 2v2"/>',
  "terminal": '<polyline points="4 17 10 11 4 5"/> <line x1="12" x2="20" y1="19" y2="19"/>'
};

// vencord-plugins/folderPictures/index.tsx
var STORE_KEY = "FolderPictures_looks";
var OLD_STORE_KEY = "FolderPictures_pictures";
var MAX_SIDE = 128;
var KEEP_GIF_UP_TO = 1024 * 1024;
var PRESETS = [
  { name: "Important", ascii: "!!", icon: "star" },
  { name: "Semi important", ascii: "!", icon: "flag" },
  { name: "Random", ascii: "??", icon: "dices" },
  { name: "Games", ascii: "[>]", icon: "gamepad" },
  { name: "Friends", ascii: "<3", icon: "heart" },
  { name: "Music", ascii: "d|b", icon: "music" },
  { name: "Code", ascii: "</>", icon: "code" },
  { name: "School / work", ascii: "[=]", icon: "bookopen" },
  { name: "Art", ascii: "*~", icon: "palette" },
  { name: "Memes", ascii: ":P", icon: "ghost" },
  { name: "Anime", ascii: "^.^", icon: "sparkles" },
  { name: "Hot", ascii: "~*~", icon: "flame" },
  { name: "Night", ascii: "zZ", icon: "moon" },
  { name: "Chill", ascii: "c[_]", icon: "coffee" },
  { name: "Bots", ascii: "[o_o]", icon: "bot" },
  { name: "Dead", ascii: "x_x", icon: "skull" },
  { name: "Archive", ascii: "[_]", icon: "archive" },
  { name: "Home", ascii: "~/", icon: "house" },
  { name: "Terminal", ascii: ">_", icon: "terminal" },
  { name: "Fast", ascii: "/!\\", icon: "zap" }
];
var looks = {};
var styleEl = null;
var listeners = /* @__PURE__ */ new Set();
var cssString = (s) => `"${s.replace(/["\\]/g, "\\$&").replace(/\n/g, "\\a ")}"`;
var iconUrl = (icon) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${ICONS[icon] ?? ""}</svg>`
)}")`;
var asciiSize = (text) => [0, 17, 16, 14, 12, 10][Math.min(text.length, 5)] ?? 10;
var INK = "color-mix(in srgb, var(--custom-folder-color, #fff), white 55%)";
function lookCss(id, look) {
  const tile = `:is([data-vc-folder-id=${cssString(id)}], [data-list-item-id=${cssString("guildsnav___" + id)}] .folderPreviewWrapper_RTMSuZ)`;
  const inner = `${tile} > div`;
  const base = `${inner} { position: relative; visibility: hidden; }
${inner}::before { visibility: visible; position: absolute; inset: 0 !important; mask: none !important; }
`;
  switch (look.kind) {
    case "picture":
      return base + `${inner}::before { content: "" !important; width: auto !important; height: auto !important; margin: 0 !important; background: center / cover no-repeat url(${cssString(look.url)}) !important; border-radius: max(2px, calc(var(--radius-lg, 12px) - var(--custom-folder-preview-padding, 4px))); }
${inner}::after { content: none !important; }`;
    case "ascii":
      return base + `${inner}::before { content: ${cssString(look.text)} !important; width: auto !important; height: auto !important; margin: 0 !important; display: flex; align-items: center; justify-content: center; white-space: pre; text-align: center; background: none !important; color: ${INK}; font-family: var(--code-font, 'Iosevka'), ui-monospace, monospace; font-weight: 600; font-size: ${asciiSize(look.text)}px; line-height: 1; letter-spacing: -0.03em; }`;
    case "icon":
      return base + `${inner}::before { content: "" !important; margin: auto !important; width: 22px !important; height: 22px !important; background: ${INK} !important; mask: ${iconUrl(look.icon)} center / contain no-repeat !important; }`;
  }
}
function updateStyle() {
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "vc-folder-pictures";
  }
  if (!styleEl.isConnected) document.head.appendChild(styleEl);
  styleEl.textContent = Object.entries(looks).map(([id, look]) => lookCss(id, look)).join("\n");
  listeners.forEach((l) => l());
}
function getLooks() {
  return looks;
}
async function setLook(folderId, look) {
  const { [folderId]: _, ...rest } = looks;
  looks = look ? { ...rest, [folderId]: look } : rest;
  await set(STORE_KEY, looks);
  updateStyle();
}
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function loadImage(src, crossOrigin = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function squareCrop(img) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const size = Math.min(MAX_SIDE, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/webp", 0.9);
}
async function fileToPicture(file) {
  const dataUrl = await readAsDataUrl(file);
  if (file.type === "image/gif" && file.size <= KEEP_GIF_UP_TO) return dataUrl;
  return squareCrop(await loadImage(dataUrl));
}
function pickFile(folderId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await setLook(folderId, { kind: "picture", url: await fileToPicture(file) });
    } catch {
      showToast({ text: "Couldn't read that picture.", variant: "critical" });
    }
  };
  input.click();
}
async function linkToPicture(link) {
  const url = new URL(link.trim());
  if (url.protocol !== "https:") throw new Error("Use an https:// link.");
  if (/(^|\.)pinterest\.[a-z.]+$/.test(url.hostname) || url.hostname === "pin.it")
    throw new Error("That's a Pinterest page, not the picture. Right-click the picture → Copy image address, and paste that (it starts with https://i.pinimg.com).");
  try {
    return squareCrop(await loadImage(url.href, true));
  } catch {
    const allowed = VencordNative.csp ? await VencordNative.csp.isDomainAllowed(url.href, ["img-src"]).catch(() => false) : true;
    const discordCdn = /(^|\.)(discordapp\.(com|net)|discord\.com)$/.test(url.hostname);
    if (!allowed && !discordCdn)
      throw new Error(`Discord won't load pictures from ${url.hostname}. Pinterest (i.pinimg.com), imgur and Discord image links work, or save the picture and use "Picture from file".`);
    await loadImage(url.href);
    return url.href;
  }
}
function LinkModal({ folderId, modalProps }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setLook(folderId, { kind: "picture", url: await linkToPicture(link) });
      modalProps.onClose();
    } catch (e) {
      setError(e?.message && !(e instanceof Event) ? e.message : "Couldn't load a picture from that link.");
    }
    setBusy(false);
  };
  return /* @__PURE__ */ React.createElement(
    Modal,
    {
      ...modalProps,
      size: "sm",
      title: "Picture from link",
      subtitle: "Paste a link to a picture. On Pinterest: right-click the picture → Copy image address.",
      notice: error ? { message: error, type: "critical" } : void 0,
      actions: [
        { text: "Cancel", variant: "secondary", onClick: modalProps.onClose },
        { text: "Use it", variant: "primary", onClick: save, loading: busy, disabled: !link.trim() }
      ]
    },
    /* @__PURE__ */ React.createElement(TextInput, { value: link, onChange: (v) => setLink(v), placeholder: "https://i.pinimg.com/...", autoFocus: true })
  );
}
function pickLink(folderId) {
  openModal((props) => /* @__PURE__ */ React.createElement(LinkModal, { folderId, modalProps: props }));
}
function TextModal({ folderId, modalProps }) {
  const current = looks[folderId];
  const [text, setText] = useState(current?.kind === "ascii" ? current.text : "");
  return /* @__PURE__ */ React.createElement(
    Modal,
    {
      ...modalProps,
      size: "sm",
      title: "Your own text",
      subtitle: "Up to 5 characters, shown in the folder in the terminal font. Try >_ or (o.o) or ;-;",
      actions: [
        { text: "Cancel", variant: "secondary", onClick: modalProps.onClose },
        {
          text: "Use it",
          variant: "primary",
          disabled: !text.trim(),
          onClick: () => {
            setLook(folderId, { kind: "ascii", text: text.trim() });
            modalProps.onClose();
          }
        }
      ]
    },
    /* @__PURE__ */ React.createElement(TextInput, { value: text, maxLength: 5, onChange: (v) => setText(v), placeholder: "!!", autoFocus: true })
  );
}
function pickText(folderId) {
  openModal((props) => /* @__PURE__ */ React.createElement(TextModal, { folderId, modalProps: props }));
}
function MenuIcon({ icon }) {
  return /* @__PURE__ */ React.createElement("div", { style: { width: 18, height: 18, flexShrink: 0, background: "currentColor", mask: `${iconUrl(icon)} center / contain no-repeat` } });
}
function menuIcon(icon) {
  const Icon = () => /* @__PURE__ */ React.createElement(MenuIcon, { icon });
  return { icon: Icon, trailingIndicator: { type: "icon", icon: Icon } };
}
function AsciiLabel({ ascii, name }) {
  return /* @__PURE__ */ React.createElement("span", { style: { whiteSpace: "pre" } }, /* @__PURE__ */ React.createElement("span", { style: { fontFamily: "var(--code-font, 'Iosevka'), ui-monospace, monospace" } }, ascii.padEnd(6, " ")), name);
}
var folderMenuPatch = (_navId, children, ...args) => {
  const props = args[0];
  if (props?.folderId == null || props.guild != null) return;
  const id = String(props.folderId);
  children.push(
    /* @__PURE__ */ React.createElement(Menu.MenuGroup, null, /* @__PURE__ */ React.createElement(Menu.MenuItem, { id: "vc-folder-look", label: "Folder look" }, /* @__PURE__ */ React.createElement(Menu.MenuItem, { id: "vc-folder-look-file", label: "Picture from file…", action: () => pickFile(id) }), /* @__PURE__ */ React.createElement(Menu.MenuItem, { id: "vc-folder-look-link", label: "Picture from link…", action: () => pickLink(id) }), /* @__PURE__ */ React.createElement(Menu.MenuSeparator, null), /* @__PURE__ */ React.createElement(Menu.MenuItem, { id: "vc-folder-look-ascii", label: "ASCII" }, PRESETS.map((p) => /* @__PURE__ */ React.createElement(
      Menu.MenuItem,
      {
        key: p.name,
        id: `vc-folder-look-ascii-${p.icon}`,
        label: /* @__PURE__ */ React.createElement(AsciiLabel, { ascii: p.ascii, name: p.name }),
        action: () => setLook(id, { kind: "ascii", text: p.ascii })
      }
    )), /* @__PURE__ */ React.createElement(Menu.MenuSeparator, null), /* @__PURE__ */ React.createElement(Menu.MenuItem, { id: "vc-folder-look-text", label: "Your own text…", action: () => pickText(id) })), /* @__PURE__ */ React.createElement(Menu.MenuItem, { id: "vc-folder-look-icon", label: "Icon" }, PRESETS.map((p) => /* @__PURE__ */ React.createElement(
      Menu.MenuItem,
      {
        key: p.name,
        id: `vc-folder-look-icon-${p.icon}`,
        label: p.name,
        ...menuIcon(p.icon),
        action: () => setLook(id, { kind: "icon", icon: p.icon })
      }
    ))), id in looks && /* @__PURE__ */ React.createElement(Menu.MenuSeparator, null), id in looks && /* @__PURE__ */ React.createElement(Menu.MenuItem, { id: "vc-folder-look-reset", label: "Back to normal", color: "danger", action: () => setLook(id, null) })))
  );
};
function folderLabel(folder) {
  if (folder.folderName) return folder.folderName;
  const names = folder.guildIds.slice(0, 3).map((id) => GuildStore.getGuild(id)?.name).filter(Boolean);
  return names.join(", ") || "Unnamed folder";
}
function LookPreview({ look, size = 36 }) {
  const box = { width: size, height: size, flexShrink: 0, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--background-mod-normal)", overflow: "hidden" };
  if (!look) return /* @__PURE__ */ React.createElement("div", { style: box });
  if (look.kind === "picture") return /* @__PURE__ */ React.createElement("div", { style: { ...box, background: `center / cover url(${cssString(look.url)})` } });
  if (look.kind === "icon") return /* @__PURE__ */ React.createElement("div", { style: box }, /* @__PURE__ */ React.createElement(MenuIcon, { icon: look.icon }));
  return /* @__PURE__ */ React.createElement("div", { style: { ...box, fontFamily: "var(--code-font, monospace)", fontWeight: 600, fontSize: Math.round(asciiSize(look.text) * size / 48), whiteSpace: "pre" } }, look.text);
}
var presetOptions = [
  ...PRESETS.map((p) => ({ label: `ASCII  ${p.ascii}  ${p.name}`, value: `ascii:${p.ascii}` })),
  ...PRESETS.map((p) => ({ label: `Icon  ${p.name}`, value: `icon:${p.icon}` }))
];
function FolderList() {
  const [, rerender] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    listeners.add(rerender);
    return () => void listeners.delete(rerender);
  }, []);
  const folders = SortedGuildStore.getGuildFolders().filter((f) => f.folderId != null);
  if (!folders.length) return /* @__PURE__ */ React.createElement(Paragraph, null, "You don't have any server folders.");
  return /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, folders.map((f) => {
    const id = String(f.folderId);
    const look = looks[id];
    const value = look?.kind === "ascii" ? `ascii:${look.text}` : look?.kind === "icon" ? `icon:${look.icon}` : null;
    return /* @__PURE__ */ React.createElement("div", { key: id, style: { display: "flex", alignItems: "center", gap: 10 } }, /* @__PURE__ */ React.createElement(LookPreview, { look }), /* @__PURE__ */ React.createElement("span", { style: { width: 130, flexShrink: 0, color: "var(--text-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, folderLabel(f)), /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 150 } }, /* @__PURE__ */ React.createElement(
      Select,
      {
        placeholder: "Preset…",
        options: presetOptions,
        closeOnSelect: true,
        isSelected: (v) => v === value,
        serialize: (v) => String(v),
        select: (v) => {
          const [kind, rest] = [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)];
          setLook(id, kind === "ascii" ? { kind: "ascii", text: rest } : { kind: "icon", icon: rest });
        }
      }
    )), /* @__PURE__ */ React.createElement(Button, { size: "small", variant: "secondary", onClick: () => pickFile(id) }, "File"), /* @__PURE__ */ React.createElement(Button, { size: "small", variant: "secondary", onClick: () => pickLink(id) }, "Link"), /* @__PURE__ */ React.createElement(Button, { size: "small", variant: "secondary", onClick: () => pickText(id) }, "Text"), look && /* @__PURE__ */ React.createElement(Button, { size: "small", variant: "dangerSecondary", onClick: () => setLook(id, null) }, "Reset"));
  }));
}
var api = {
  presets: PRESETS,
  iconUrl,
  getLooks,
  setLook,
  pickFile,
  folderLabel,
  setFromLink: async (folderId, link) => setLook(folderId, { kind: "picture", url: await linkToPicture(link) }),
  subscribe(listener) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }
};
var folderPictures_default = definePlugin({
  name: "FolderPictures",
  description: "Give server folders their own look instead of the 2x2 grid of their servers: a picture (file or link), an ASCII preset or an icon. Right-click a folder → Folder look.",
  authors: [{ name: "Pota", id: 0n }],
  enabledByDefault: true,
  patches: [
    {
      // the closed-folder preview (the 2x2 grid): tag it with its folder id so the style sheet can find it
      find: "#{intl::GUILD_FOLDER_TOOLTIP_A11Y_LABEL}",
      replacement: {
        match: /(\{folderNode:(\i),hovered:\i,sorting:\i\}=\i.{0,400}?\(0,\i\.jsx\)\("div",\{)(className:\i\.\i,children:\(0,\i\.jsx\)\("div",\{className:\i\.\i,children:\i\.slice\(0,4\))/,
        replace: '$1"data-vc-folder-id":$2.id,$3'
      }
    }
  ],
  settingsAboutComponent: FolderList,
  api,
  async start() {
    let saved = await get(STORE_KEY);
    if (!saved) {
      const old = await get(OLD_STORE_KEY);
      saved = Object.fromEntries(Object.entries(old ?? {}).map(([id, url]) => [id, { kind: "picture", url }]));
      if (old) await set(STORE_KEY, saved);
    }
    looks = saved;
    updateStyle();
    addGlobalContextMenuPatch(folderMenuPatch);
  },
  stop() {
    removeGlobalContextMenuPatch(folderMenuPatch);
    styleEl?.remove();
  }
});

// betterdiscord/src/shims/shims.css
var shims_default = "/* The plain interface pieces from shims/ui.tsx, in the theme's colours (with stand-ins for when the theme\n   is off). */\n\n.rice-bd-backdrop {\n    position: fixed;\n    inset: 0;\n    z-index: 10000;\n    display: grid;\n    place-items: center;\n    background: hsla(0, 0%, 0%, 0.6);\n}\n\n.rice-bd-dialog {\n    box-sizing: border-box;\n    width: min(440px, calc(100vw - 32px));\n    padding: 16px;\n    border: 1px solid var(--float-border, hsla(0, 0%, 100%, 0.2));\n    border-radius: var(--corners, 8px);\n    background: var(--popup, #1c1c1c);\n    color: var(--fg, #dbdbdb);\n    font-family: var(--font-primary, inherit);\n}\n.rice-bd-dialog h2 {\n    margin: 0 0 4px;\n    color: var(--fg-bright, #fafafa);\n    font-size: 16px;\n    font-weight: 600;\n}\n.rice-bd-dialog p {\n    margin: 0 0 12px;\n    color: var(--fg-dim, #a3a3a3);\n    font-size: 13px;\n    line-height: 1.4;\n}\n.rice-bd-notice {\n    color: var(--red, #e08a8a) !important;\n}\n.rice-bd-actions {\n    display: flex;\n    justify-content: flex-end;\n    gap: 8px;\n    margin-top: 16px;\n}\n\n.rice-bd-input {\n    box-sizing: border-box;\n    width: 100%;\n    height: 36px;\n    padding: 0 10px;\n    border: 1px solid var(--edge-strong, hsla(0, 0%, 100%, 0.14));\n    border-radius: var(--corners, 4px);\n    outline: none;\n    background: var(--glass, hsla(0, 0%, 100%, 0.04));\n    color: var(--fg-bright, #fafafa);\n    font: inherit;\n    font-size: 14px;\n}\n.rice-bd-input:focus {\n    border-color: var(--line-focus, hsla(0, 0%, 100%, 0.6));\n}\nselect.rice-bd-input option {\n    background: var(--popup, #1c1c1c);\n    color: var(--fg, #dbdbdb);\n}\n\n.rice-bd-btn {\n    height: 32px;\n    padding: 0 14px;\n    border: 1px solid transparent;\n    border-radius: var(--corners, 4px);\n    background: var(--button, #e0e0e0);\n    color: var(--ink, #141414);\n    font: inherit;\n    font-size: 13px;\n    font-weight: 600;\n    cursor: pointer;\n}\n.rice-bd-btn:hover {\n    background: var(--button-hover, #cccccc);\n}\n.rice-bd-btn.small {\n    height: 28px;\n    padding: 0 10px;\n}\n.rice-bd-btn:is(.secondary, .dangerSecondary) {\n    border-color: var(--button-edge, hsla(0, 0%, 100%, 0.12));\n    background: var(--raised, hsla(0, 0%, 100%, 0.08));\n    color: var(--fg-strong, #ebebeb);\n}\n.rice-bd-btn:is(.secondary, .dangerSecondary):hover {\n    background: var(--pressed, hsla(0, 0%, 100%, 0.14));\n}\n.rice-bd-btn.dangerSecondary {\n    color: var(--red, #e08a8a);\n}\n.rice-bd-btn:disabled {\n    opacity: 0.5;\n    cursor: default;\n}\n\n.rice-bd-p {\n    margin: 0;\n    color: var(--fg, #dbdbdb);\n    font-size: 14px;\n}\n\n/* the rice bowl button in the channel header corner. The theme sizes and colours the buttons there; these\n   are the same values for when it is off */\n.rice-bd-header {\n    display: flex;\n}\n.rice-bd-header > .vc-discord-rice-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 32px;\n    height: 32px;\n    color: var(--fg-dim, #b5bac1);\n    cursor: pointer;\n    -webkit-app-region: no-drag;\n}\n.rice-bd-header > .vc-discord-rice-btn:hover {\n    color: var(--fg-bright, #ffffff);\n}\n";

// betterdiscord/src/folderPictures.tsx
var STYLE_ID = "FolderPictures";
var FolderPictures = class {
  /** what the discord-rice settings window uses to list and edit folder looks */
  api = api;
  start() {
    BdApi.DOM.addStyle(STYLE_ID, shims_default);
    folderPictures_default.start().catch((e) => console.error("[FolderPictures]", e));
  }
  stop() {
    closeAllModals();
    folderPictures_default.stop();
    BdApi.DOM.removeStyle(STYLE_ID);
  }
  getSettingsPanel() {
    return /* @__PURE__ */ React.createElement(FolderList, null);
  }
};
module.exports = module.exports.default;
