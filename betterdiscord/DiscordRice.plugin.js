/**
 * @name DiscordRice
 * @author Pota
 * @description Settings for the discord-rice theme in one terminal-style window, behind a rice bowl button in the channel header: font, corners, wallpaper, ASCII wallpaper, what to hide, and folder looks.
 * @version 1.1.0
 * @source https://github.com/Plyxen/discord-rice
 * @website https://github.com/Plyxen/discord-rice
 */

/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This file is built, don't edit it: the source is betterdiscord/src/discordRice.tsx and the Vencord
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

// betterdiscord/src/discordRice.tsx
var discordRice_exports = {};
__export(discordRice_exports, {
  default: () => DiscordRice
});
module.exports = __toCommonJS(discordRice_exports);

// betterdiscord/src/shims/globals.ts
var THEME_FILE = "discord-rice.theme.css";
var React = BdApi.React;
var VencordNative = {
  themes: {
    // "is the theme file in the themes folder, and which version does it say it is?" Read from the
    // file itself: BetterDiscord's own list is a moment behind right after an update.
    async getThemesList() {
      try {
        if (!BdApi.Themes.get(THEME_FILE)) return [];
        const file = require("path").join(BdApi.Themes.folder, THEME_FILE);
        const head = String(require("fs").readFileSync(file, "utf8")).slice(0, 2e3);
        return [{ fileName: THEME_FILE, version: /^\s*\*\s*@version\s+(\S+)/m.exec(head)?.[1] }];
      } catch {
        return [];
      }
    }
  },
  // BetterDiscord takes Discord's content rules away, so any picture link may load
  csp: void 0
};

// betterdiscord/src/shims/settings.ts
var listeners = /* @__PURE__ */ new Set();
var notify = () => listeners.forEach((l) => l());
function onSettingsChange(listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
function useChanges(source) {
  const [, redraw] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => {
    source.add(redraw);
    return () => void source.delete(redraw);
  }, []);
}
function definePluginSettings(def) {
  const values = {};
  for (const [key, option] of Object.entries(def)) {
    values[key] = "default" in option ? option.default : option.options?.find((o) => o.default)?.value;
  }
  try {
    Object.assign(values, BdApi.Data.load("DiscordRice", "settings") ?? {});
  } catch {
  }
  let saving = false;
  const save = () => {
    if (saving) return;
    saving = true;
    queueMicrotask(() => {
      saving = false;
      try {
        BdApi.Data.save("DiscordRice", "settings", values);
      } catch {
      }
    });
  };
  const store2 = new Proxy(values, {
    set(target, key, value) {
      if (target[key] === value) return true;
      target[key] = value;
      save();
      notify();
      return true;
    }
  });
  return {
    def,
    store: store2,
    /** the settings, re-rendering the component that asks whenever one changes */
    use(_keys) {
      useChanges(listeners);
      return store2;
    }
  };
}
var themeListeners = /* @__PURE__ */ new Set();
function themeOn() {
  try {
    return !!BdApi.Themes.isEnabled(THEME_FILE);
  } catch {
    return false;
  }
}
var Settings = {
  get enabledThemes() {
    return themeOn() ? [THEME_FILE] : [];
  },
  set enabledThemes(list) {
    const on = list.includes(THEME_FILE);
    try {
      if (on !== themeOn()) BdApi.Themes[on ? "enable" : "disable"](THEME_FILE);
    } catch {
    }
    themeListeners.forEach((l) => l());
  },
  // BetterDiscord has no online themes
  get themeLinks() {
    return [];
  },
  set themeLinks(_) {
  }
};
function useSettings(_keys) {
  useChanges(themeListeners);
  const [, setOn] = React.useState(themeOn);
  React.useEffect(() => {
    const timer = setInterval(() => setOn(themeOn()), 1500);
    return () => clearInterval(timer);
  }, []);
  return { enabledThemes: themeOn() ? [THEME_FILE] : [], themeLinks: [] };
}

// betterdiscord/src/shims/misc.ts
var OptionType = { STRING: 0, NUMBER: 1, BIGINT: 2, BOOLEAN: 3, SELECT: 4, SLIDER: 5, COMPONENT: 6, CUSTOM: 7 };
var NAMES = { RiceUpdater: "DiscordRiceUpdater" };
function isPluginEnabled(name) {
  try {
    return !!BdApi.Plugins.isEnabled(NAMES[name] ?? name);
  } catch {
    return false;
  }
}
var plugins = new Proxy({}, {
  get(_, name) {
    try {
      return BdApi.Plugins.get(NAMES[name] ?? name)?.instance;
    } catch {
      return void 0;
    }
  }
});

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
var IconUtils = {
  getGuildIconURL({ id, icon, size = 32 }) {
    return `https://cdn.discordapp.com/icons/${id}/${icon}.webp?size=${size}`;
  }
};
function showToast({ text, variant }) {
  BdApi.UI.showToast(text, { type: variant === "critical" ? "error" : variant === "positive" ? "success" : "info" });
}
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
function SettingsTab({ children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "rice-bd-page" }, children);
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

// vencord-plugins/discordRice/store.ts
var THEME_FILE2 = "discord-rice.theme.css";
var THEME_LINK = "https://cdn.jsdelivr.net/gh/Plyxen/discord-rice@main/discord-rice.theme.css";
var isOurLink = (link) => link.includes(THEME_FILE2);
var settings = definePluginSettings({
  hideInbox: { type: OptionType.BOOLEAN, description: "Hide the inbox button", default: true, hidden: true },
  hideNameplates: { type: OptionType.BOOLEAN, description: "Hide nameplates", default: true, hidden: true },
  hideQuests: { type: OptionType.BOOLEAN, description: "Hide quests", default: true, hidden: true },
  hideStoreTabs: { type: OptionType.BOOLEAN, description: "Hide Nitro / Shop / Quests tabs", default: true, hidden: true },
  hideGiftButton: { type: OptionType.BOOLEAN, description: "Hide the gift button", default: true, hidden: true },
  hideAppsButton: { type: OptionType.BOOLEAN, description: "Hide the apps button", default: true, hidden: true },
  hideStickerButton: { type: OptionType.BOOLEAN, description: "Hide the sticker button", default: false, hidden: true },
  hideNotificationButton: { type: OptionType.BOOLEAN, description: "Hide the notification bell", default: true, hidden: true },
  hideVideoCallButton: { type: OptionType.BOOLEAN, description: "Hide the video call button", default: true, hidden: true },
  plainFolders: { type: OptionType.BOOLEAN, description: "Plain folder icons", default: true, hidden: true },
  monoServerIcons: {
    type: OptionType.SELECT,
    description: "Black-and-white server icons",
    hidden: true,
    options: [
      { label: "On", value: "on", default: true },
      { label: "Colour under the mouse", value: "hover" },
      { label: "Off", value: "off" }
    ]
  },
  glassMenus: { type: OptionType.BOOLEAN, description: "Frosted-glass menus", default: true, hidden: true },
  archLogo: { type: OptionType.BOOLEAN, description: "Arch logo on the home button", default: true, hidden: true },
  monoWindowControls: { type: OptionType.BOOLEAN, description: "Grey window dots", default: true, hidden: true },
  grain: { type: OptionType.BOOLEAN, description: "Film grain", default: true, hidden: true },
  font: {
    type: OptionType.SELECT,
    description: "Font",
    hidden: true,
    options: [
      { label: "Iosevka", value: "iosevka", default: true },
      { label: "Discord's own", value: "discord" }
    ]
  },
  corners: { type: OptionType.SLIDER, description: "Corners", markers: [0, 1, 2, 3, 4, 6, 8, 10, 12], default: 3, hidden: true },
  wallpaper: { type: OptionType.STRING, description: "Wallpaper link", default: "", hidden: true },
  wallpaperDim: { type: OptionType.SLIDER, description: "Wallpaper dim", markers: [0, 0.25, 0.5, 0.75, 1], default: 0.5, hidden: true },
  asciiWallpaper: {
    type: OptionType.SELECT,
    description: "ASCII wallpaper",
    hidden: true,
    options: [
      { label: "Off", value: "off", default: true },
      { label: "Characters", value: "ramp" },
      { label: "Digits", value: "digits" },
      { label: "Binary", value: "binary" }
    ]
  },
  asciiSize: { type: OptionType.SLIDER, description: "ASCII character size", markers: [6, 8, 10, 12, 14, 16], default: 10, hidden: true },
  seenWelcome: { type: OptionType.BOOLEAN, description: "Welcome popup shown", default: false, hidden: true }
});
var DEFAULTS = {
  hideInbox: true,
  hideNameplates: true,
  hideQuests: true,
  hideStoreTabs: true,
  hideGiftButton: true,
  hideAppsButton: true,
  hideStickerButton: false,
  hideNotificationButton: true,
  hideVideoCallButton: true,
  plainFolders: true,
  monoServerIcons: "on",
  glassMenus: true,
  archLogo: true,
  monoWindowControls: true,
  grain: true,
  font: "iosevka",
  corners: 3,
  wallpaper: "",
  wallpaperDim: 0.5,
  asciiWallpaper: "off",
  asciiSize: 10
};
var cssString = (s) => `"${s.replace(/["\\]/g, "\\$&")}"`;
var onOff = (b) => b ? "on" : "off";
var FONTS = {
  iosevka: ["'Iosevka'", "'Iosevka'", "Iosevka"],
  discord: ["''", "''", "Discord's own"]
};
var asciiUrl = null;
var asciiKey = "";
var asciiTimer;
var asciiRetries = 0;
function loadImage(src, crossOrigin) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
function wallpaperSource() {
  const custom = settings.store.wallpaper.trim();
  if (custom) return custom;
  const value = getComputedStyle(document.documentElement).getPropertyValue("--wallpaper-default").trim();
  return value.match(/^url\((['"]?)([\s\S]*)\1\)$/)?.[2] ?? null;
}
function random(seed) {
  let t = seed + 1831565813 | 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
var RAMP = " .,:;-~=+*#%@";
async function drawAscii(src, mode, cell) {
  const img = await loadImage(src, !src.startsWith("data:"));
  await document.fonts.load(`600 ${cell}px Iosevka`).catch(() => void 0);
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.min(Math.round(screen.width * scale), 3840);
  const H = Math.min(Math.round(screen.height * scale), 2160);
  const fontPx = cell * scale;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  ctx.font = `600 ${fontPx}px Iosevka, ui-monospace, monospace`;
  const cw = ctx.measureText("0").width || fontPx * 0.5;
  const ch = fontPx * 1.2;
  const cols = Math.ceil(W / cw);
  const rows = Math.ceil(H / ch);
  const small = document.createElement("canvas");
  small.width = cols;
  small.height = rows;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  const ir = img.naturalWidth / img.naturalHeight;
  const or = W / H;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ir > or) {
    sw = sh * or;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = sw / or;
    sy = (img.naturalHeight - sh) / 2;
  }
  sctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  const px = sctx.getImageData(0, 0, cols, rows).data;
  sctx.filter = "blur(6px)";
  sctx.drawImage(small, 0, 0);
  const blurred = sctx.getImageData(0, 0, cols, rows).data;
  const n = cols * rows;
  const luma = (d, i) => (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = luma(px, i);
    lum[i] = 0.45 * g + 0.55 * (0.5 + (g - luma(blurred, i)) * 3);
  }
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(n * 0.02)];
  const hi = Math.max(sorted[Math.floor(n * 0.98)], lo + 0.01);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const b = Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo)));
      let char, alpha;
      if (mode === "ramp") {
        const v = Math.pow(b, 1.4);
        char = RAMP[Math.round(v * (RAMP.length - 1))];
        if (char === " ") continue;
        alpha = 0.3 + 0.45 * v;
      } else {
        const digits = mode === "binary" ? "01" : "0123456789";
        char = digits[Math.floor(random(i) * digits.length)];
        alpha = 0.05 + 0.8 * Math.pow(b, 1.8);
      }
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fillText(char, x * cw, y * ch);
    }
  }
  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't encode the ASCII wallpaper");
  return URL.createObjectURL(blob);
}
function setAsciiUrl(url) {
  if (asciiUrl) URL.revokeObjectURL(asciiUrl);
  asciiUrl = url;
}
function syncAscii() {
  const { asciiWallpaper: mode, asciiSize: cell } = settings.store;
  if (mode === "off") {
    asciiKey = "";
    setAsciiUrl(null);
    return;
  }
  const src = wallpaperSource();
  if (!src) {
    if (asciiRetries++ < 20) setTimeout(syncAscii, 1500);
    return;
  }
  const key = `${mode}|${cell}|${src.length}|${src.slice(0, 200)}`;
  if (key === asciiKey) return;
  asciiKey = key;
  clearTimeout(asciiTimer);
  asciiTimer = setTimeout(async () => {
    try {
      const url = await drawAscii(src, mode, cell);
      if (asciiKey !== key) {
        URL.revokeObjectURL(url);
        return;
      }
      setAsciiUrl(url);
    } catch {
      setAsciiUrl(null);
      showToast({ text: "Couldn't turn that wallpaper into ASCII. The site doesn't let Discord read the picture; try an imgur link.", variant: "critical" });
    }
    applyStyle(false);
  }, 300);
}
var styleEl = null;
function applyStyle(checkAscii = true) {
  const s = settings.store;
  const [font, codeFont] = FONTS[s.font] ?? FONTS.iosevka;
  const vars = {
    "--hide-nameplates": onOff(s.hideNameplates),
    "--hide-quests": onOff(s.hideQuests),
    "--hide-store-tabs": onOff(s.hideStoreTabs),
    "--hide-gift-button": onOff(s.hideGiftButton),
    "--hide-apps-button": onOff(s.hideAppsButton),
    "--hide-sticker-button": onOff(s.hideStickerButton),
    "--hide-notification-button": onOff(s.hideNotificationButton),
    "--hide-video-call-button": onOff(s.hideVideoCallButton),
    "--plain-folders": onOff(s.plainFolders),
    "--mono-server-icons": s.monoServerIcons,
    "--glass-menus": onOff(s.glassMenus),
    "--home-icon": s.archLogo ? "arch" : "discord",
    "--mono-window-controls": onOff(s.monoWindowControls),
    "--grain": onOff(s.grain),
    "--font": font,
    "--code-font": codeFont,
    "--corners": `${s.corners}px`,
    "--wallpaper-dim": String(s.wallpaperDim)
  };
  const wallpaper = s.wallpaper.trim();
  if (asciiUrl && s.asciiWallpaper !== "off") vars["--wallpaper"] = `url(${cssString(asciiUrl)})`;
  else if (wallpaper) vars["--wallpaper"] = `url(${cssString(wallpaper)})`;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "vc-discord-rice";
  }
  styleEl.textContent = `html body {
${Object.entries(vars).map(([k, v]) => `    ${k}: ${v};`).join("\n")}
}`;
  if (!styleEl.isConnected) document.head.appendChild(styleEl);
  if (checkAscii) syncAscii();
}
function set(key, value) {
  settings.store[key] = value;
  applyStyle();
}
function resetAll() {
  Object.assign(settings.store, DEFAULTS);
  applyStyle();
}
function teardown() {
  clearTimeout(asciiTimer);
  asciiKey = "";
  setAsciiUrl(null);
  styleEl?.remove();
}

// vencord-plugins/discordRice/style.css
var style_default = `/* The discord-rice settings window: a floating terminal window, like a TUI config tool in a tiling WM.\r
   Colours come from the theme's variables, with fallbacks so it still reads with the theme off. */\r
\r
.vc-rice-win {\r
    --r-t1: var(--fg-bright, hsl(0 0% 98%));\r
    --r-t2: var(--fg-strong, hsl(0 0% 92%));\r
    --r-t3: var(--fg, hsl(0 0% 84%));\r
    --r-t4: var(--fg-dim, hsl(0 0% 64%));\r
    --r-t5: var(--fg-faint, hsl(0 0% 50%));\r
    --r-line: var(--line, hsl(0 0% 100% / 0.12));\r
    --r-border: var(--float-border, hsl(0 0% 100% / 0.2));\r
    --r-focus: var(--line-focus, hsl(0 0% 100% / 0.6));\r
    --r-sel: var(--bar, hsl(0 0% 84%));\r
    --r-sel-text: var(--ink, hsl(0 0% 8%));\r
    --r-hover: var(--hover, hsl(0 0% 100% / 0.06));\r
    --r-tint: var(--active, hsl(0 0% 100% / 0.1));\r
    --r-red: var(--red, hsl(355 65% 70%));\r
    --r-green: var(--green, hsl(95 38% 62%));\r
    --r-radius: var(--radius-sm, 3px);\r
\r
    container-type: inline-size;\r
    display: grid;\r
    grid-template-rows: auto minmax(0, 1fr) auto;\r
    width: min(880px, 94vw);\r
    height: min(600px, 88vh);\r
    overflow: hidden;\r
    border: 1px solid var(--r-border);\r
    border-radius: var(--r-radius);\r
    background: var(--float-tint, hsl(0 0% 7% / 0.88));\r
    backdrop-filter: blur(var(--float-blur, 20px)) saturate(1.2);\r
    color: var(--r-t3);\r
    font-family: var(--code-font, 'Iosevka'), ui-monospace, monospace;\r
    font-size: 13px;\r
    line-height: 1.45;\r
    pointer-events: auto;\r
    text-align: left;\r
}\r
.vc-rice-win:focus {\r
    outline: none;\r
}\r
.vc-rice-win.inline {\r
    width: 100%;\r
    height: 640px;\r
}\r
/* in the popup: centred over Discord's dark backdrop, whatever the modal layer does with its children */\r
.vc-rice-layer {\r
    position: fixed;\r
    inset: 0;\r
    display: grid;\r
    place-items: center;\r
    pointer-events: none;\r
}\r
\r
.vc-rice-win :is(button, input) {\r
    font: inherit;\r
    color: inherit;\r
}\r
.vc-rice-win button {\r
    cursor: pointer;\r
}\r
.vc-rice-win :is(button, [tabindex]):focus-visible {\r
    outline: 1px dashed var(--r-focus);\r
    outline-offset: -1px;\r
}\r
\r
/* ---- title bar: name, the file you're "editing", close ---- */\r
.vc-rice-bar {\r
    display: flex;\r
    align-items: center;\r
    gap: 10px;\r
    padding: 7px 8px 7px 14px;\r
    border-bottom: 1px solid var(--r-line);\r
    white-space: nowrap;\r
}\r
.vc-rice-bar b {\r
    color: var(--r-t1);\r
    font-weight: 600;\r
}\r
.vc-rice-path {\r
    overflow: hidden;\r
    color: var(--r-t5);\r
    text-overflow: ellipsis;\r
}\r
.vc-rice-close {\r
    margin-left: auto;\r
    padding: 0 8px;\r
    border: 0;\r
    border-radius: var(--r-radius);\r
    background: none;\r
    color: var(--r-t4) !important;\r
    font-size: 15px !important;\r
}\r
.vc-rice-close:hover {\r
    background: var(--r-hover);\r
    color: var(--r-t1) !important;\r
}\r
\r
/* ---- body: tab list on the left, the open tab on the right ---- */\r
.vc-rice-body {\r
    display: grid;\r
    grid-template-columns: 168px minmax(0, 1fr);\r
    min-height: 0;\r
}\r
.vc-rice-side {\r
    display: flex;\r
    flex-direction: column;\r
    gap: 1px;\r
    padding: 8px 0;\r
    border-right: 1px solid var(--r-line);\r
}\r
.vc-rice-tab {\r
    display: flex;\r
    gap: 10px;\r
    width: 100%;\r
    padding: 4px 14px;\r
    border: 0;\r
    background: none;\r
    color: var(--r-t4) !important;\r
    text-align: left;\r
}\r
.vc-rice-tab i {\r
    color: var(--r-t5);\r
    font-style: normal;\r
}\r
.vc-rice-tab:hover {\r
    background: var(--r-hover);\r
    color: var(--r-t2) !important;\r
}\r
.vc-rice-tab[aria-selected='true'] {\r
    background: var(--r-sel);\r
    color: var(--r-sel-text) !important;\r
    font-weight: 600;\r
}\r
.vc-rice-tab[aria-selected='true'] i {\r
    color: inherit;\r
    opacity: 0.55;\r
}\r
.vc-rice-reset {\r
    margin: auto 14px 0;\r
    padding: 3px 0;\r
    border: 0;\r
    background: none;\r
    color: var(--r-t5) !important;\r
    text-align: left;\r
}\r
.vc-rice-reset:hover {\r
    color: var(--r-t2) !important;\r
}\r
.vc-rice-reset.armed {\r
    color: var(--r-red) !important;\r
}\r
\r
.vc-rice-pane {\r
    overflow-y: auto;\r
    padding: 14px 22px 22px;\r
    scrollbar-color: var(--r-line) transparent;\r
    scrollbar-width: thin;\r
}\r
.vc-rice-title {\r
    margin: 0 0 2px;\r
    color: var(--r-t1);\r
    font-size: 15px;\r
    font-weight: 600;\r
}\r
.vc-rice-title::before {\r
    content: '# ';\r
    color: var(--r-t5);\r
}\r
.vc-rice-lead {\r
    margin: 0 0 10px;\r
    color: var(--r-t5);\r
}\r
\r
/* a group heading: ── header ───────── */\r
.vc-rice-h {\r
    display: flex;\r
    align-items: center;\r
    gap: 8px;\r
    margin: 16px 0 4px;\r
    color: var(--r-t5);\r
    font-size: 12px;\r
}\r
.vc-rice-h::before {\r
    content: '──';\r
}\r
.vc-rice-h::after {\r
    content: '';\r
    flex: 1;\r
    border-top: 1px solid var(--r-line);\r
}\r
\r
.vc-rice-desc {\r
    display: block;\r
    color: var(--r-t5);\r
    font-size: 12px;\r
}\r
\r
/* ---- [x] switches: the whole row is the button ---- */\r
.vc-rice-check {\r
    display: grid;\r
    grid-template-columns: 4ch minmax(0, 1fr);\r
    width: calc(100% + 16px);\r
    margin: 0 -8px;\r
    padding: 5px 8px;\r
    border: 0;\r
    border-radius: var(--r-radius);\r
    background: none;\r
    text-align: left;\r
}\r
.vc-rice-check:hover {\r
    background: var(--r-hover);\r
}\r
.vc-rice-box {\r
    color: var(--r-t5);\r
}\r
.vc-rice-check[aria-checked='true'] .vc-rice-box {\r
    color: var(--r-t1);\r
    font-weight: 600;\r
}\r
.vc-rice-label {\r
    color: var(--r-t2);\r
}\r
.vc-rice-check[aria-checked='false'] .vc-rice-label {\r
    color: var(--r-t4);\r
}\r
.vc-rice-check .vc-rice-desc {\r
    grid-column: 2;\r
}\r
\r
/* ---- fields with a control: label on the left, control on the right ---- */\r
.vc-rice-field {\r
    display: grid;\r
    grid-template-columns: 17ch minmax(0, 1fr);\r
    align-items: center;\r
    gap: 3px 14px;\r
    padding: 7px 0;\r
}\r
.vc-rice-field > .vc-rice-label {\r
    align-self: start;\r
    padding-top: 2px;\r
}\r
.vc-rice-field .vc-rice-desc {\r
    grid-column: 2;\r
}\r
\r
/* one-of-several: [ iosevka ] discord */\r
.vc-rice-seg {\r
    display: flex;\r
    flex-wrap: wrap;\r
    gap: 4px;\r
}\r
.vc-rice-opt {\r
    padding: 1px 9px;\r
    border: 1px solid var(--r-line);\r
    border-radius: var(--r-radius);\r
    background: none;\r
    color: var(--r-t4) !important;\r
}\r
.vc-rice-opt:hover {\r
    border-color: var(--r-border);\r
    color: var(--r-t2) !important;\r
}\r
.vc-rice-opt[aria-checked='true'] {\r
    border-color: var(--r-sel);\r
    background: var(--r-sel);\r
    color: var(--r-sel-text) !important;\r
    font-weight: 600;\r
}\r
\r
/* sliders as a row of blocks: ‹ ▮▮▮▮▯▯▯ › 3px */\r
.vc-rice-range {\r
    display: flex;\r
    align-items: center;\r
    gap: 6px;\r
    width: fit-content;\r
    border-radius: var(--r-radius);\r
}\r
.vc-rice-cells {\r
    display: flex;\r
    gap: 2px;\r
}\r
.vc-rice-cell {\r
    width: 9px;\r
    height: 16px;\r
    padding: 0;\r
    border: 0;\r
    border-radius: 1px;\r
    background: var(--r-line);\r
}\r
.vc-rice-cell.on {\r
    background: var(--r-t4);\r
}\r
.vc-rice-cell.cur {\r
    background: var(--r-t1);\r
}\r
.vc-rice-cell:hover {\r
    background: var(--r-t2);\r
}\r
.vc-rice-step {\r
    padding: 0 3px;\r
    border: 0;\r
    background: none;\r
    color: var(--r-t5) !important;\r
}\r
.vc-rice-step:hover {\r
    color: var(--r-t1) !important;\r
}\r
.vc-rice-value {\r
    min-width: 5ch;\r
    color: var(--r-t2);\r
}\r
\r
/* text fields: a prompt line */\r
.vc-rice-input {\r
    display: flex;\r
    align-items: center;\r
    gap: 8px;\r
    padding: 3px 0;\r
    border-bottom: 1px solid var(--r-line);\r
}\r
.vc-rice-input:focus-within {\r
    border-color: var(--r-focus);\r
}\r
.vc-rice-input > span {\r
    color: var(--r-t4);\r
}\r
.vc-rice-input input {\r
    flex: 1;\r
    min-width: 0;\r
    padding: 0;\r
    border: 0;\r
    outline: 0;\r
    background: none;\r
    color: var(--r-t1);\r
}\r
.vc-rice-input input::placeholder {\r
    color: var(--r-t5);\r
}\r
\r
.vc-rice-btn {\r
    padding: 1px 10px;\r
    border: 1px solid var(--r-line);\r
    border-radius: var(--r-radius);\r
    background: none;\r
    color: var(--r-t3) !important;\r
    white-space: nowrap;\r
}\r
.vc-rice-btn:hover:not(:disabled) {\r
    border-color: var(--r-border);\r
    background: var(--r-hover);\r
    color: var(--r-t1) !important;\r
}\r
.vc-rice-btn:disabled {\r
    cursor: default;\r
    opacity: 0.45;\r
}\r
.vc-rice-btn.danger {\r
    color: var(--r-red) !important;\r
}\r
\r
.vc-rice-error {\r
    margin: 4px 0 0;\r
    color: var(--r-red);\r
    font-size: 12px;\r
}\r
\r
/* ---- about: neofetch, status, tips ---- */\r
.vc-rice-fetch {\r
    display: flex;\r
    flex-wrap: wrap;\r
    align-items: center;\r
    gap: 8px 28px;\r
    margin-bottom: 4px;\r
}\r
.vc-rice-fetch pre {\r
    margin: 0;\r
    color: var(--r-t5);\r
    font: inherit;\r
    font-size: 12px;\r
    line-height: 1.25;\r
}\r
.vc-rice-fetch .k {\r
    display: inline-block;\r
    width: 11ch;\r
    color: var(--r-t1);\r
    font-weight: 600;\r
}\r
.vc-rice-fetch .who {\r
    color: var(--r-t1);\r
    font-weight: 600;\r
}\r
.vc-rice-palette {\r
    display: flex;\r
    margin-top: 8px;\r
}\r
.vc-rice-palette span {\r
    width: 18px;\r
    height: 12px;\r
}\r
\r
.vc-rice-plugin {\r
    display: grid;\r
    grid-template-columns: 4ch 17ch minmax(0, 1fr);\r
    padding: 3px 0;\r
}\r
.vc-rice-plugin .dot {\r
    color: var(--r-t5);\r
}\r
.vc-rice-plugin .dot.on {\r
    color: var(--r-green);\r
}\r
.vc-rice-plugin b {\r
    color: var(--r-t2);\r
    font-weight: 400;\r
}\r
\r
/* what the updater last found, over its buttons */\r
.vc-rice-update,\r
.vc-rice-update p {\r
    margin: 0;\r
    color: var(--r-t4);\r
}\r
.vc-rice-update p {\r
    margin-bottom: 6px;\r
}\r
.vc-rice-update .vc-rice-desc {\r
    margin-top: 6px;\r
}\r
\r
.vc-rice-tips {\r
    margin: 0;\r
    padding: 0;\r
    list-style: none;\r
}\r
.vc-rice-tips li {\r
    padding: 2px 0 2px 3ch;\r
    text-indent: -3ch;\r
    color: var(--r-t4);\r
}\r
.vc-rice-tips li::before {\r
    content: ' - ';\r
    color: var(--r-t5);\r
    white-space: pre;\r
}\r
.vc-rice-tips kbd {\r
    color: var(--r-t2);\r
    font: inherit;\r
}\r
\r
/* ---- folders: one row each, opens to the looks ---- */\r
.vc-rice-folder {\r
    border-bottom: 1px solid var(--r-line);\r
}\r
.vc-rice-folder-row {\r
    display: grid;\r
    grid-template-columns: 32px minmax(0, 1fr) auto 2ch;\r
    align-items: center;\r
    gap: 12px;\r
    width: 100%;\r
    padding: 6px 4px;\r
    border: 0;\r
    background: none;\r
    text-align: left;\r
}\r
.vc-rice-folder-row:hover {\r
    background: var(--r-hover);\r
}\r
.vc-rice-folder-name {\r
    overflow: hidden;\r
    color: var(--r-t2);\r
    text-overflow: ellipsis;\r
    white-space: nowrap;\r
}\r
.vc-rice-folder-look,\r
.vc-rice-folder-arrow {\r
    color: var(--r-t5);\r
}\r
.vc-rice-preview {\r
    display: grid;\r
    place-items: center;\r
    width: 32px;\r
    height: 32px;\r
    overflow: hidden;\r
    border-radius: 8px;\r
    background: var(--r-tint) center / cover no-repeat;\r
    color: var(--r-t1);\r
    font-weight: 600;\r
    white-space: pre;\r
}\r
.vc-rice-edit {\r
    display: grid;\r
    grid-template-columns: 8ch minmax(0, 1fr);\r
    align-items: center;\r
    gap: 10px 12px;\r
    padding: 8px 4px 14px 48px;\r
}\r
.vc-rice-edit > span {\r
    align-self: start;\r
    padding-top: 4px;\r
    color: var(--r-t5);\r
}\r
.vc-rice-chips {\r
    display: flex;\r
    flex-wrap: wrap;\r
    gap: 4px;\r
}\r
.vc-rice-chip {\r
    display: inline-grid;\r
    place-items: center;\r
    min-width: 34px;\r
    height: 28px;\r
    padding: 0 6px;\r
    border: 1px solid var(--r-line);\r
    border-radius: var(--r-radius);\r
    background: none;\r
    color: var(--r-t3) !important;\r
    font-weight: 600 !important;\r
    white-space: pre;\r
}\r
.vc-rice-chip:hover {\r
    border-color: var(--r-border);\r
    color: var(--r-t1) !important;\r
}\r
.vc-rice-chip[aria-pressed='true'] {\r
    border-color: var(--r-sel);\r
    background: var(--r-sel);\r
    color: var(--r-sel-text) !important;\r
}\r
.vc-rice-chip .icon,\r
.vc-rice-preview .icon {\r
    width: 16px;\r
    height: 16px;\r
    background: currentColor;\r
}\r
.vc-rice-preview .icon {\r
    width: 18px;\r
    height: 18px;\r
}\r
/* a folder with no look: the theme's plain-folder glyph (copied here for when the theme is off), or a\r
   2×2 grid of its servers like Discord draws it */\r
.vc-rice-preview .vc-rice-folder-glyph {\r
    mask: var(--folder-glyph, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M2 6a2 2 0 0 1 2-2h5.17a2 2 0 0 1 1.42.59L12.4 6.4H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z'/%3E%3C/svg%3E")) center / contain no-repeat;\r
}\r
.vc-rice-grid {\r
    grid-template-columns: repeat(2, 12px);\r
    grid-auto-rows: 12px;\r
    place-content: center;\r
    gap: 2px;\r
}\r
.vc-rice-grid > * {\r
    display: grid;\r
    place-items: center;\r
    width: 12px;\r
    height: 12px;\r
    overflow: hidden;\r
    border-radius: 50%;\r
    background: var(--r-line);\r
    font-size: 8px;\r
    object-fit: cover;\r
}\r
.vc-rice-grid.mono > img {\r
    filter: grayscale(1);\r
}\r
.vc-rice-inline {\r
    display: flex;\r
    flex-wrap: wrap;\r
    align-items: center;\r
    gap: 8px;\r
}\r
.vc-rice-inline .vc-rice-input {\r
    flex: 1;\r
    min-width: 14ch;\r
}\r
\r
/* ---- status line, like tmux or vim's ---- */\r
.vc-rice-status {\r
    display: flex;\r
    align-items: stretch;\r
    border-top: 1px solid var(--r-line);\r
    color: var(--r-t5);\r
    font-size: 12px;\r
    white-space: nowrap;\r
}\r
.vc-rice-status > span {\r
    padding: 3px 12px;\r
}\r
.vc-rice-mode {\r
    background: var(--r-sel);\r
    color: var(--r-sel-text);\r
    font-weight: 600;\r
}\r
.vc-rice-keys {\r
    margin-left: auto;\r
    overflow: hidden;\r
    text-overflow: ellipsis;\r
}\r
.vc-rice-keys kbd {\r
    color: var(--r-t3);\r
    font: inherit;\r
}\r
\r
/* narrow (the plugin's own settings, a small window): tabs go on top */\r
@container (max-width: 620px) {\r
    .vc-rice-body {\r
        grid-template-columns: minmax(0, 1fr);\r
        grid-template-rows: auto minmax(0, 1fr);\r
    }\r
    .vc-rice-side {\r
        flex-direction: row;\r
        flex-wrap: wrap;\r
        padding: 6px;\r
        border-right: 0;\r
        border-bottom: 1px solid var(--r-line);\r
    }\r
    .vc-rice-tab {\r
        width: auto;\r
        padding: 2px 10px;\r
    }\r
    .vc-rice-reset {\r
        margin: 0 0 0 auto;\r
    }\r
    .vc-rice-keys {\r
        display: none;\r
    }\r
    .vc-rice-field {\r
        grid-template-columns: minmax(0, 1fr);\r
    }\r
    .vc-rice-field .vc-rice-desc {\r
        grid-column: 1;\r
    }\r
}\r
`;

// betterdiscord/src/shims/mod.ts
var MOD = {
  pluginOff: "off: turn it on in Settings → Plugins",
  foldersOff: "turn on the FolderPictures plugin (Settings → Plugins) to give folders a look.",
  whereElse: "this window is behind the rice bowl button in the channel header, and in the DiscordRice plugin's settings.",
  themeFrom: "the theme file in BetterDiscord's themes folder. everything here needs it on.",
  updaterOff: "the DiscordRiceUpdater plugin does the checking, and it is off. turn it on in Settings → Plugins."
};

// vencord-plugins/discordRice/ui.tsx
function Heading({ children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "vc-rice-h" }, children);
}
function Check({ k, label, desc }) {
  const on = settings.use([k])[k];
  return /* @__PURE__ */ React.createElement("button", { role: "switch", "aria-checked": on, className: "vc-rice-check", onClick: () => set(k, !on) }, /* @__PURE__ */ React.createElement("span", { className: "vc-rice-box", "aria-hidden": true }, on ? "[x]" : "[ ]"), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-label" }, label), desc && /* @__PURE__ */ React.createElement("span", { className: "vc-rice-desc" }, desc));
}
function Field({ label, desc, children }) {
  return /* @__PURE__ */ React.createElement("div", { className: "vc-rice-field" }, /* @__PURE__ */ React.createElement("span", { className: "vc-rice-label" }, label), children, desc && /* @__PURE__ */ React.createElement("span", { className: "vc-rice-desc" }, desc));
}
function Choice({ k, label, desc, options }) {
  const value = settings.use([k])[k];
  return /* @__PURE__ */ React.createElement(Field, { label, desc }, /* @__PURE__ */ React.createElement("div", { className: "vc-rice-seg", role: "radiogroup", "aria-label": label }, options.map(([v, text]) => /* @__PURE__ */ React.createElement("button", { key: v, role: "radio", "aria-checked": value === v, className: "vc-rice-opt", onClick: () => set(k, v) }, text))));
}
function Range({ k, label, desc, values, show }) {
  const value = settings.use([k])[k];
  const at = Math.max(0, values.findIndex((v) => v >= value - 1e-9));
  const go = (i) => set(k, values[Math.max(0, Math.min(values.length - 1, i))]);
  const keys = {
    ArrowLeft: () => go(at - 1),
    ArrowDown: () => go(at - 1),
    ArrowRight: () => go(at + 1),
    ArrowUp: () => go(at + 1),
    Home: () => go(0),
    End: () => go(values.length - 1)
  };
  return /* @__PURE__ */ React.createElement(Field, { label, desc }, /* @__PURE__ */ React.createElement(
    "div",
    {
      className: "vc-rice-range",
      role: "slider",
      tabIndex: 0,
      "aria-label": label,
      "aria-valuemin": values[0],
      "aria-valuemax": values[values.length - 1],
      "aria-valuenow": value,
      "aria-valuetext": show(value),
      onKeyDown: (e) => {
        if (!keys[e.key]) return;
        e.preventDefault();
        keys[e.key]();
      }
    },
    /* @__PURE__ */ React.createElement("button", { className: "vc-rice-step", tabIndex: -1, "aria-hidden": true, onClick: () => go(at - 1) }, "‹"),
    /* @__PURE__ */ React.createElement("span", { className: "vc-rice-cells" }, values.map((v, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: v,
        tabIndex: -1,
        "aria-hidden": true,
        title: show(v),
        className: "vc-rice-cell" + (i < at ? " on" : i === at ? " cur" : ""),
        onClick: () => go(i)
      }
    ))),
    /* @__PURE__ */ React.createElement("button", { className: "vc-rice-step", tabIndex: -1, "aria-hidden": true, onClick: () => go(at + 1) }, "›"),
    /* @__PURE__ */ React.createElement("span", { className: "vc-rice-value" }, show(value))
  ));
}
function Prompt({ value, onChange, placeholder, maxLength, onEnter, label }) {
  return /* @__PURE__ */ React.createElement("label", { className: "vc-rice-input" }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": true }, "❯"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value,
      placeholder,
      maxLength,
      spellCheck: false,
      "aria-label": label,
      onChange: (e) => onChange(e.currentTarget.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") onEnter?.();
      }
    }
  ));
}
var BOWL = [
  "       (   )  (",
  "        ) (    )",
  "       (   ) (",
  "    _.-'''''''''''-._",
  "  .' . ' . ' . ' . ' '.",
  " (_____________________)",
  "  \\                   /",
  "   '.               .'",
  "     '-._________.-'"
];
var PALETTE = ["--fg-faint", "--fg-dim", "--fg", "--fg-strong", "--fg-bright", "--red", "--yellow", "--green", "--blue", "--purple"];
var PLUGINS = [
  ["DiscordRice", "this window, the switches, the ascii wallpaper"],
  ["FolderPictures", "folder looks: pictures, ascii and icons"],
  ["CodeBlockButton", "the ``` button when you select text in the chat bar"],
  ["RiceUpdater", "keeps the theme file and these plugins up to date from github"]
];
function useThemeOn() {
  const { enabledThemes, themeLinks } = useSettings(["enabledThemes", "themeLinks"]);
  return { on: enabledThemes.includes(THEME_FILE2) || themeLinks.some(isOurLink), enabledThemes, themeLinks };
}
function useThemeFile(again) {
  const [file, setFile] = useState(null);
  useEffect(() => {
    VencordNative.themes.getThemesList().then((list) => setFile(list.find((t) => t.fileName === THEME_FILE2) ?? null)).catch(() => void 0);
  }, [again]);
  return file;
}
function useUpdater() {
  const api = isPluginEnabled("RiceUpdater") ? plugins.RiceUpdater?.api : void 0;
  const [, rerender] = useReducer((x) => x + 1, 0);
  useEffect(() => api?.subscribe(rerender), [api]);
  return api;
}
function useArmed() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3e3);
    return () => clearTimeout(t);
  }, [armed]);
  return [armed, setArmed];
}
function uptime() {
  const m = Math.floor(performance.now() / 6e4);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function Fetch() {
  const s = settings.use();
  const { on } = useThemeOn();
  const version = useThemeFile(useUpdater()?.status())?.version;
  const user = UserStore.getCurrentUser();
  const folders = SortedGuildStore.getGuildFolders().filter((f) => f.folderId != null).length;
  const title = `${user?.username ?? "you"}@discord`;
  const rows = [
    ["theme", on ? `discord-rice${version ? ` ${version}` : ""}` : "off"],
    ["wm", "tiled, no gaps"],
    ["font", FONTS[s.font]?.[2] ?? "Iosevka"],
    ["colors", "greyscale"],
    ["corners", `${s.corners}px`],
    ["wallpaper", s.asciiWallpaper !== "off" ? `ascii (${s.asciiWallpaper})` : s.wallpaper.trim() ? "custom" : "misty forest"],
    ["folders", String(folders)],
    ["plugins", PLUGINS.map(([n]) => n).filter(isPluginEnabled).join(", ")],
    ["uptime", uptime()]
  ];
  return /* @__PURE__ */ React.createElement("div", { className: "vc-rice-fetch" }, /* @__PURE__ */ React.createElement("pre", { "aria-hidden": true }, BOWL.join("\n")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "who" }, title), /* @__PURE__ */ React.createElement("div", { "aria-hidden": true }, "-".repeat(title.length)), rows.map(([k, v]) => /* @__PURE__ */ React.createElement("div", { key: k }, /* @__PURE__ */ React.createElement("span", { className: "k" }, k), v)), /* @__PURE__ */ React.createElement("div", { className: "vc-rice-palette", "aria-hidden": true }, PALETTE.map((v) => /* @__PURE__ */ React.createElement("span", { key: v, style: { background: `var(${v}, #888)` } })))));
}
function ThemeCheck() {
  const { on, enabledThemes, themeLinks } = useThemeOn();
  const hasFile = !!useThemeFile();
  const toggle = () => {
    if (!on) {
      if (hasFile) Settings.enabledThemes = [...enabledThemes, THEME_FILE2];
      else Settings.themeLinks = [...themeLinks, THEME_LINK];
    } else {
      Settings.enabledThemes = enabledThemes.filter((t) => t !== THEME_FILE2);
      Settings.themeLinks = themeLinks.filter((l) => !isOurLink(l));
    }
  };
  return /* @__PURE__ */ React.createElement("button", { role: "switch", "aria-checked": on, className: "vc-rice-check", onClick: toggle }, /* @__PURE__ */ React.createElement("span", { className: "vc-rice-box", "aria-hidden": true }, on ? "[x]" : "[ ]"), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-label" }, "theme"), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-desc" }, MOD.themeFrom));
}
function Updates() {
  const api = useUpdater();
  const [armed, setArmed] = useArmed();
  if (!api) return /* @__PURE__ */ React.createElement("p", { className: "vc-rice-update" }, MOD.updaterOff);
  const busy = api.busy();
  return /* @__PURE__ */ React.createElement("div", { className: "vc-rice-update" }, /* @__PURE__ */ React.createElement("p", { role: "status" }, api.status()), /* @__PURE__ */ React.createElement("div", { className: "vc-rice-inline" }, /* @__PURE__ */ React.createElement("button", { className: "vc-rice-btn", disabled: busy, onClick: () => api.check() }, busy ? "checking…" : "check for updates"), api.held() && /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "vc-rice-btn danger",
      disabled: busy,
      onClick: () => {
        if (!armed) return setArmed(true);
        setArmed(false);
        api.check(true);
      }
    },
    armed ? "sure? click again" : "replace my changes"
  ), api.restartNeeded() && /* @__PURE__ */ React.createElement("button", { className: "vc-rice-btn", onClick: () => api.restart() }, "restart discord")), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-desc" }, "looks on github and installs what is new. files you changed yourself are left alone."));
}
function About() {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Fetch, null), /* @__PURE__ */ React.createElement(Heading, null, "updates"), /* @__PURE__ */ React.createElement(Updates, null), /* @__PURE__ */ React.createElement(Heading, null, "status"), /* @__PURE__ */ React.createElement(ThemeCheck, null), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 6 } }, PLUGINS.map(([name, what]) => {
    const on = isPluginEnabled(name);
    return /* @__PURE__ */ React.createElement("div", { key: name, className: "vc-rice-plugin" }, /* @__PURE__ */ React.createElement("span", { className: "dot" + (on ? " on" : ""), "aria-hidden": true }, on ? "●" : "○"), /* @__PURE__ */ React.createElement("b", null, name), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-desc" }, on ? what : MOD.pluginOff));
  })), /* @__PURE__ */ React.createElement(Heading, null, "tips"), /* @__PURE__ */ React.createElement("ul", { className: "vc-rice-tips" }, /* @__PURE__ */ React.createElement("li", null, "right-click a server folder → ", /* @__PURE__ */ React.createElement("kbd", null, "Folder look"), ", or use the folders tab here."), /* @__PURE__ */ React.createElement("li", null, "select text in the chat bar, then the ", /* @__PURE__ */ React.createElement("kbd", null, "```"), " button wraps it in a code block."), /* @__PURE__ */ React.createElement("li", null, "drag the window by the empty space in the channel header, next to the channel name."), /* @__PURE__ */ React.createElement("li", null, MOD.whereElse)));
}
var folderApi = () => isPluginEnabled("FolderPictures") ? plugins.FolderPictures?.api : void 0;
var describe = (look) => !look ? "default" : look.kind === "ascii" ? `ascii ${look.text}` : look.kind === "icon" ? `icon ${look.icon}` : "picture";
function Preview({ look, api, guildIds }) {
  const { plainFolders, monoServerIcons } = settings.use(["plainFolders", "monoServerIcons"]);
  if (look?.kind === "picture") return /* @__PURE__ */ React.createElement("span", { className: "vc-rice-preview", style: { backgroundImage: `url(${JSON.stringify(look.url)})` } });
  if (look?.kind === "icon") return /* @__PURE__ */ React.createElement("span", { className: "vc-rice-preview" }, /* @__PURE__ */ React.createElement("span", { className: "icon", style: { mask: `${api.iconUrl(look.icon)} center / contain no-repeat` } }));
  if (look?.kind === "ascii") return /* @__PURE__ */ React.createElement("span", { className: "vc-rice-preview", style: { fontSize: look.text.length > 3 ? 9 : 12 } }, look.text);
  if (plainFolders) return /* @__PURE__ */ React.createElement("span", { className: "vc-rice-preview" }, /* @__PURE__ */ React.createElement("span", { className: "icon vc-rice-folder-glyph" }));
  return /* @__PURE__ */ React.createElement("span", { className: `vc-rice-preview vc-rice-grid${monoServerIcons === "off" ? "" : " mono"}` }, guildIds.slice(0, 4).map((id) => {
    const guild = GuildStore.getGuild(id);
    const url = guild?.icon ? IconUtils.getGuildIconURL({ id, icon: guild.icon, size: 32, canAnimate: false }) : void 0;
    return url ? /* @__PURE__ */ React.createElement("img", { key: id, src: url, alt: "" }) : /* @__PURE__ */ React.createElement("span", { key: id }, guild?.name?.[0] ?? "");
  }));
}
function FolderRow({ id, name, guildIds, look, api, open, onToggle }) {
  const [text, setText] = useState(look?.kind === "ascii" ? look.text : "");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const editId = `vc-rice-folder-${id}`;
  const setText_ = () => text.trim() && api.setLook(id, { kind: "ascii", text: text.trim() });
  const setLink_ = async () => {
    if (!link.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.setFromLink(id, link);
      setLink("");
    } catch (e) {
      setError(e?.message && !(e instanceof Event) ? e.message : "Couldn't load a picture from that link.");
    }
    setBusy(false);
  };
  return /* @__PURE__ */ React.createElement("div", { className: "vc-rice-folder" }, /* @__PURE__ */ React.createElement("button", { className: "vc-rice-folder-row", "aria-expanded": open, "aria-controls": editId, onClick: onToggle }, /* @__PURE__ */ React.createElement(Preview, { look, api, guildIds }), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-folder-name" }, name), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-folder-look" }, describe(look)), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-folder-arrow", "aria-hidden": true }, open ? "▾" : "▸")), open && /* @__PURE__ */ React.createElement("div", { className: "vc-rice-edit", id: editId }, /* @__PURE__ */ React.createElement("span", null, "ascii"), /* @__PURE__ */ React.createElement("div", { className: "vc-rice-chips" }, api.presets.map((p) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: p.ascii,
      className: "vc-rice-chip",
      title: p.name,
      "aria-label": `${p.ascii}, ${p.name}`,
      "aria-pressed": look?.kind === "ascii" && look.text === p.ascii,
      onClick: () => api.setLook(id, { kind: "ascii", text: p.ascii })
    },
    p.ascii
  ))), /* @__PURE__ */ React.createElement("span", null, "icon"), /* @__PURE__ */ React.createElement("div", { className: "vc-rice-chips" }, api.presets.map((p) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: p.icon,
      className: "vc-rice-chip",
      title: p.name,
      "aria-label": `${p.name} icon`,
      "aria-pressed": look?.kind === "icon" && look.icon === p.icon,
      onClick: () => api.setLook(id, { kind: "icon", icon: p.icon })
    },
    /* @__PURE__ */ React.createElement("span", { className: "icon", style: { mask: `${api.iconUrl(p.icon)} center / contain no-repeat` } })
  ))), /* @__PURE__ */ React.createElement("span", null, "text"), /* @__PURE__ */ React.createElement("div", { className: "vc-rice-inline" }, /* @__PURE__ */ React.createElement(Prompt, { label: "Your own text", value: text, onChange: setText, maxLength: 5, placeholder: "up to 5 characters, like >_ or ;-;", onEnter: setText_ }), /* @__PURE__ */ React.createElement("button", { className: "vc-rice-btn", disabled: !text.trim(), onClick: setText_ }, "set")), /* @__PURE__ */ React.createElement("span", null, "picture"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "vc-rice-inline" }, /* @__PURE__ */ React.createElement(Prompt, { label: "Picture link", value: link, onChange: setLink, placeholder: "https://i.pinimg.com/...", onEnter: setLink_ }), /* @__PURE__ */ React.createElement("button", { className: "vc-rice-btn", disabled: !link.trim() || busy, onClick: setLink_ }, busy ? "loading…" : "set"), /* @__PURE__ */ React.createElement("button", { className: "vc-rice-btn", onClick: () => api.pickFile(id) }, "from file…")), error ? /* @__PURE__ */ React.createElement("p", { className: "vc-rice-error", role: "alert" }, error) : /* @__PURE__ */ React.createElement("span", { className: "vc-rice-desc" }, "on pinterest: right-click the picture → copy image address.")), look && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", null), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { className: "vc-rice-btn danger", onClick: () => api.setLook(id, null) }, "back to normal")))));
}
function Folders() {
  const api = folderApi();
  const [, rerender] = useReducer((x) => x + 1, 0);
  const [open, setOpen] = useState(null);
  useEffect(() => api?.subscribe(rerender), [api]);
  if (!api) return /* @__PURE__ */ React.createElement("p", { className: "vc-rice-lead" }, MOD.foldersOff);
  const folders = SortedGuildStore.getGuildFolders().filter((f) => f.folderId != null);
  if (!folders.length) return /* @__PURE__ */ React.createElement("p", { className: "vc-rice-lead" }, "no server folders yet. drag one server onto another to make one.");
  const looks = api.getLooks();
  return /* @__PURE__ */ React.createElement("div", null, folders.map((f) => {
    const id = String(f.folderId);
    return /* @__PURE__ */ React.createElement(
      FolderRow,
      {
        key: id,
        id,
        name: api.folderLabel(f),
        guildIds: f.guildIds,
        look: looks[id],
        api,
        open: open === id,
        onToggle: () => setOpen(open === id ? null : id)
      }
    );
  }));
}
function Look() {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Choice, { k: "font", label: "font", desc: "iosevka is the terminal font the theme is drawn for.", options: [
    ["iosevka", "iosevka"],
    ["discord", "discord's own"]
  ] }), /* @__PURE__ */ React.createElement(Range, { k: "corners", label: "corners", values: [0, 1, 2, 3, 4, 6, 8, 10, 12], show: (v) => `${v}px`, desc: "avatars and pills stay round." }), /* @__PURE__ */ React.createElement(Heading, null, "floating windows"), /* @__PURE__ */ React.createElement(Check, { k: "glassMenus", label: "frosted glass", desc: "menus and pickers are see-through with a blur. off makes them solid." }), /* @__PURE__ */ React.createElement(Check, { k: "monoWindowControls", label: "grey window dots", desc: "instead of red / yellow / green. they light up on hover." }));
}
var DIM = Array.from({ length: 21 }, (_, i) => i / 20);
function Wallpaper() {
  const { wallpaper } = settings.use(["wallpaper"]);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Field, { label: "image", desc: "a link to any picture: imgur, i.pinimg.com, github.io, raw.githubusercontent.com. empty = the misty forest." }, /* @__PURE__ */ React.createElement(Prompt, { label: "Wallpaper link", value: wallpaper, onChange: (v) => set("wallpaper", v), placeholder: "https://i.imgur.com/....jpg" })), /* @__PURE__ */ React.createElement(Range, { k: "wallpaperDim", label: "darken", values: DIM, show: (v) => `${Math.round(v * 100)}%`, desc: "raise it if text gets hard to read." }), /* @__PURE__ */ React.createElement(Check, { k: "grain", label: "film grain", desc: "a little noise over the wallpaper." }), /* @__PURE__ */ React.createElement(Heading, null, "ascii"), /* @__PURE__ */ React.createElement(Choice, { k: "asciiWallpaper", label: "redraw as", desc: "draws the wallpaper out of characters.", options: [
    ["off", "off"],
    ["ramp", ".:-=+*#%@"],
    ["digits", "0-9"],
    ["binary", "01"]
  ] }), /* @__PURE__ */ React.createElement(Range, { k: "asciiSize", label: "character size", values: [6, 8, 10, 12, 14, 16], show: (v) => `${v}px` }));
}
function Hide() {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Heading, null, "channel header"), /* @__PURE__ */ React.createElement(Check, { k: "hideInbox", label: "inbox button", desc: "the discord-rice button takes its place." }), /* @__PURE__ */ React.createElement(Check, { k: "hideNotificationButton", label: "notification bell", desc: "right-click a channel for the same settings." }), /* @__PURE__ */ React.createElement(Check, { k: "hideVideoCallButton", label: "video call button", desc: "in DMs. voice call stays; turn your camera on once in the call." }), /* @__PURE__ */ React.createElement(Heading, null, "chat bar"), /* @__PURE__ */ React.createElement(Check, { k: "hideGiftButton", label: "gift button" }), /* @__PURE__ */ React.createElement(Check, { k: "hideAppsButton", label: "apps button", desc: "the apps / activities launcher." }), /* @__PURE__ */ React.createElement(Check, { k: "hideStickerButton", label: "sticker button" }), /* @__PURE__ */ React.createElement(Heading, null, "lists"), /* @__PURE__ */ React.createElement(Check, { k: "hideNameplates", label: "nameplates", desc: "picture strips behind names in the member list, DM list and user panel." }), /* @__PURE__ */ React.createElement(Check, { k: "hideQuests", label: "quests", desc: "the card above your user panel, and quest embeds in chat." }), /* @__PURE__ */ React.createElement(Check, { k: "hideStoreTabs", label: "nitro, shop, quests tabs", desc: "the rows at the top of the DM list." }));
}
function Servers() {
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(Check, { k: "plainFolders", label: "plain folders", desc: "a closed folder shows a folder icon instead of a 2×2 grid. a folder look takes its place." }), /* @__PURE__ */ React.createElement(Choice, { k: "monoServerIcons", label: "b/w icons", desc: "server pictures and folders in black and white.", options: [
    ["on", "on"],
    ["hover", "colour on hover"],
    ["off", "off"]
  ] }), /* @__PURE__ */ React.createElement(Check, { k: "archLogo", label: "arch logo", desc: "on the home button, instead of discord's logo." }));
}
var TABS = [
  { id: "about", lead: "what's running, and a few tips.", Pane: About },
  { id: "look", lead: "font, corners and floating windows. changes show straight away.", Pane: Look },
  { id: "wallpaper", lead: "the picture behind everything.", Pane: Wallpaper },
  { id: "hide", lead: "[x] = hidden. the bell, video call, gift and sticker switches need discord in english.", Pane: Hide },
  { id: "servers", lead: "the server list on the left.", Pane: Servers },
  { id: "folders", lead: "give a server folder a look: ascii, an icon, your own text or a picture.", Pane: Folders }
];
function ResetButton() {
  const [armed, setArmed] = useArmed();
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "vc-rice-reset" + (armed ? " armed" : ""),
      onClick: () => {
        if (!armed) return setArmed(true);
        resetAll();
        setArmed(false);
      }
    },
    armed ? "↺ sure? click again" : "↺ reset defaults"
  );
}
function RiceWindow({ onClose, inline }) {
  const [tab, setTab] = useState(0);
  const ref = useRef(null);
  const { on: themeOn2 } = useThemeOn();
  const pluginsOn = PLUGINS.filter(([n]) => isPluginEnabled(n)).length;
  const current = TABS[tab];
  useEffect(() => {
    if (!inline) ref.current?.focus();
  }, []);
  const onKeyDown = (e) => {
    const target = e.target;
    if (target.closest("input, textarea")) return;
    if (e.key === "Escape" && onClose) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (target.getAttribute("role") === "tab" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const next = (tab + (e.key === "ArrowDown" ? 1 : -1) + TABS.length) % TABS.length;
      setTab(next);
      ref.current?.querySelector(`#vc-rice-tab-${TABS[next].id}`)?.focus();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= TABS.length && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      setTab(n - 1);
    }
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref,
      className: "vc-rice-win" + (inline ? " inline" : ""),
      role: inline ? "region" : "dialog",
      "aria-modal": inline ? void 0 : true,
      "aria-label": "discord-rice settings",
      tabIndex: -1,
      onKeyDown
    },
    /* @__PURE__ */ React.createElement("div", { className: "vc-rice-bar" }, /* @__PURE__ */ React.createElement("b", null, "discord-rice"), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-path" }, "~/.config/discord-rice/", current.id, ".conf"), onClose && /* @__PURE__ */ React.createElement("button", { className: "vc-rice-close", "aria-label": "Close", onClick: onClose }, "×")),
    /* @__PURE__ */ React.createElement("div", { className: "vc-rice-body" }, /* @__PURE__ */ React.createElement("div", { className: "vc-rice-side", role: "tablist", "aria-orientation": "vertical", "aria-label": "Sections" }, TABS.map((t, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: t.id,
        id: `vc-rice-tab-${t.id}`,
        role: "tab",
        "aria-selected": i === tab,
        "aria-controls": "vc-rice-panel",
        tabIndex: i === tab ? 0 : -1,
        className: "vc-rice-tab",
        onClick: () => setTab(i)
      },
      /* @__PURE__ */ React.createElement("i", { "aria-hidden": true }, i + 1),
      t.id
    )), /* @__PURE__ */ React.createElement(ResetButton, null)), /* @__PURE__ */ React.createElement("div", { key: current.id, id: "vc-rice-panel", className: "vc-rice-pane", role: "tabpanel", "aria-labelledby": `vc-rice-tab-${current.id}` }, /* @__PURE__ */ React.createElement("h2", { className: "vc-rice-title" }, current.id), /* @__PURE__ */ React.createElement("p", { className: "vc-rice-lead" }, current.lead), /* @__PURE__ */ React.createElement(ErrorBoundary, null, /* @__PURE__ */ React.createElement(current.Pane, null)))),
    /* @__PURE__ */ React.createElement("div", { className: "vc-rice-status" }, /* @__PURE__ */ React.createElement("span", { className: "vc-rice-mode" }, "RICE"), /* @__PURE__ */ React.createElement("span", null, "theme ", themeOn2 ? "on" : "off"), /* @__PURE__ */ React.createElement("span", null, "plugins ", pluginsOn, "/", PLUGINS.length), /* @__PURE__ */ React.createElement("span", { className: "vc-rice-keys" }, /* @__PURE__ */ React.createElement("kbd", null, "1-", TABS.length), " section · ", /* @__PURE__ */ React.createElement("kbd", null, "tab"), " move · ", /* @__PURE__ */ React.createElement("kbd", null, "space"), " toggle · ", /* @__PURE__ */ React.createElement("kbd", null, "←→"), " slide", onClose && /* @__PURE__ */ React.createElement(React.Fragment, null, " · ", /* @__PURE__ */ React.createElement("kbd", null, "esc"), " close")))
  );
}
function openRicePopup() {
  openModal((props) => /* @__PURE__ */ React.createElement("div", { className: "vc-rice-layer" }, /* @__PURE__ */ React.createElement(ErrorBoundary, null, /* @__PURE__ */ React.createElement(RiceWindow, { onClose: props.onClose }))));
}
function RicePage() {
  return /* @__PURE__ */ React.createElement(SettingsTab, null, /* @__PURE__ */ React.createElement(RiceWindow, { inline: true }));
}

// betterdiscord/src/shims/shims.css
var shims_default = "/* The plain interface pieces from shims/ui.tsx, in the theme's colours (with stand-ins for when the theme\n   is off). */\n\n.rice-bd-backdrop {\n    position: fixed;\n    inset: 0;\n    z-index: 10000;\n    display: grid;\n    place-items: center;\n    background: hsla(0, 0%, 0%, 0.6);\n}\n\n.rice-bd-dialog {\n    box-sizing: border-box;\n    width: min(440px, calc(100vw - 32px));\n    padding: 16px;\n    border: 1px solid var(--float-border, hsla(0, 0%, 100%, 0.2));\n    border-radius: var(--corners, 8px);\n    background: var(--popup, #1c1c1c);\n    color: var(--fg, #dbdbdb);\n    font-family: var(--font-primary, inherit);\n}\n.rice-bd-dialog h2 {\n    margin: 0 0 4px;\n    color: var(--fg-bright, #fafafa);\n    font-size: 16px;\n    font-weight: 600;\n}\n.rice-bd-dialog p {\n    margin: 0 0 12px;\n    color: var(--fg-dim, #a3a3a3);\n    font-size: 13px;\n    line-height: 1.4;\n}\n.rice-bd-notice {\n    color: var(--red, #e08a8a) !important;\n}\n.rice-bd-actions {\n    display: flex;\n    justify-content: flex-end;\n    gap: 8px;\n    margin-top: 16px;\n}\n\n.rice-bd-input {\n    box-sizing: border-box;\n    width: 100%;\n    height: 36px;\n    padding: 0 10px;\n    border: 1px solid var(--edge-strong, hsla(0, 0%, 100%, 0.14));\n    border-radius: var(--corners, 4px);\n    outline: none;\n    background: var(--glass, hsla(0, 0%, 100%, 0.04));\n    color: var(--fg-bright, #fafafa);\n    font: inherit;\n    font-size: 14px;\n}\n.rice-bd-input:focus {\n    border-color: var(--line-focus, hsla(0, 0%, 100%, 0.6));\n}\nselect.rice-bd-input option {\n    background: var(--popup, #1c1c1c);\n    color: var(--fg, #dbdbdb);\n}\n\n.rice-bd-btn {\n    height: 32px;\n    padding: 0 14px;\n    border: 1px solid transparent;\n    border-radius: var(--corners, 4px);\n    background: var(--button, #e0e0e0);\n    color: var(--ink, #141414);\n    font: inherit;\n    font-size: 13px;\n    font-weight: 600;\n    cursor: pointer;\n}\n.rice-bd-btn:hover {\n    background: var(--button-hover, #cccccc);\n}\n.rice-bd-btn.small {\n    height: 28px;\n    padding: 0 10px;\n}\n.rice-bd-btn:is(.secondary, .dangerSecondary) {\n    border-color: var(--button-edge, hsla(0, 0%, 100%, 0.12));\n    background: var(--raised, hsla(0, 0%, 100%, 0.08));\n    color: var(--fg-strong, #ebebeb);\n}\n.rice-bd-btn:is(.secondary, .dangerSecondary):hover {\n    background: var(--pressed, hsla(0, 0%, 100%, 0.14));\n}\n.rice-bd-btn.dangerSecondary {\n    color: var(--red, #e08a8a);\n}\n.rice-bd-btn:disabled {\n    opacity: 0.5;\n    cursor: default;\n}\n\n.rice-bd-p {\n    margin: 0;\n    color: var(--fg, #dbdbdb);\n    font-size: 14px;\n}\n\n/* the rice bowl button in the channel header corner. The theme sizes and colours the buttons there; these\n   are the same values for when it is off */\n.rice-bd-header {\n    display: flex;\n}\n.rice-bd-header > .vc-discord-rice-btn {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 32px;\n    height: 32px;\n    color: var(--fg-dim, #b5bac1);\n    cursor: pointer;\n    -webkit-app-region: no-drag;\n}\n.rice-bd-header > .vc-discord-rice-btn:hover {\n    color: var(--fg-bright, #ffffff);\n}\n";

// betterdiscord/src/discordRice.tsx
var STYLE_ID = "DiscordRice";
var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M2 12.5h20a10 8 0 0 1-20 0zM8 19.5h8V21a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1zM5 11a7 4 0 0 1 14 0z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9.5 1.8c-.9.9.9 1.8 0 2.7M14.5 1.8c-.9.9.9 1.8 0 2.7"/></svg>';
function findButtonRow() {
  for (const el of Array.from(document.querySelectorAll('[class*="trailing_"]'))) {
    if (/(^|\s)bar_/.test(el.parentElement?.className ?? "")) return el;
  }
  return null;
}
var DiscordRice = class {
  holder = null;
  timer;
  welcome;
  stopListening;
  start() {
    BdApi.DOM.addStyle(STYLE_ID, style_default + "\n" + shims_default);
    applyStyle();
    this.holder = document.createElement("div");
    this.holder.className = "rice-bd-header";
    const button = document.createElement("div");
    button.className = "vc-discord-rice-btn";
    button.setAttribute("role", "button");
    button.setAttribute("aria-label", "discord-rice");
    button.title = "discord-rice";
    button.tabIndex = 0;
    button.innerHTML = ICON;
    button.addEventListener("click", () => openRicePopup());
    button.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      openRicePopup();
    });
    this.holder.appendChild(button);
    this.syncHeader();
    this.timer = setInterval(() => this.syncHeader(), 2e3);
    this.stopListening = onSettingsChange(() => this.syncHeader());
    if (!settings.store.seenWelcome) {
      this.welcome = setTimeout(() => {
        settings.store.seenWelcome = true;
        openRicePopup();
      }, 1500);
    }
  }
  stop() {
    clearInterval(this.timer);
    clearTimeout(this.welcome);
    this.stopListening?.();
    closeAllModals();
    this.showInbox(findButtonRow(), true);
    this.holder?.remove();
    this.holder = null;
    teardown();
    BdApi.DOM.removeStyle(STYLE_ID);
  }
  getSettingsPanel() {
    return /* @__PURE__ */ React.createElement(RicePage, null);
  }
  syncHeader() {
    const row = findButtonRow();
    if (!row || !this.holder) return;
    if (this.holder.parentElement !== row) {
      const other = row.querySelector('[class*="clickable_"]:not(.vc-discord-rice-btn)');
      const clickable = other && Array.from(other.classList).find((c) => c.startsWith("clickable_"));
      const button = this.holder.firstElementChild;
      button.className = "vc-discord-rice-btn" + (clickable ? " " + clickable : "");
      row.appendChild(this.holder);
    }
    this.showInbox(row, !settings.store.hideInbox);
  }
  // The inbox button is the one piece of that row that is a box holding both a button and an empty,
  // hidden marker (which its popup hangs from). Help is a link, and the theme hides it itself.
  showInbox(row, show) {
    if (!row) return;
    for (const el of Array.from(row.children)) {
      if (el === this.holder || el.tagName !== "DIV") continue;
      if (!el.querySelector(':scope > span[aria-hidden="true"]') || !el.querySelector('[class*="clickable_"]')) continue;
      el.style.display = show ? "" : "none";
    }
  }
};
module.exports = module.exports.default;
