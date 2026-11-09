/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The DiscordRice settings, and what they do: theme variables set on <body> from a small style sheet, and
// the ASCII wallpaper. The settings window (ui.tsx) only reads and writes these.

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";
import { showToast } from "@webpack/common";

export const THEME_FILE = "discord-rice.theme.css";
// the online-theme link (Settings → Vencord → Themes → Online Themes), served by jsDelivr from the repo
export const THEME_LINK = "https://cdn.jsdelivr.net/gh/Plyxen/discord-rice@main/discord-rice.theme.css";
export const isOurLink = (link: string) => link.includes(THEME_FILE);
export const settings = definePluginSettings({
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
        type: OptionType.SELECT, description: "Black-and-white server icons", hidden: true,
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
        type: OptionType.SELECT, description: "Font", hidden: true,
        options: [
            { label: "Iosevka", value: "iosevka", default: true },
            { label: "Figtree (midnight's font)", value: "figtree" },
            { label: "Discord's own", value: "discord" }
        ]
    },
    corners: { type: OptionType.SLIDER, description: "Corners", markers: [0, 1, 2, 3, 4, 6, 8, 10, 12], default: 3, hidden: true },
    gap: { type: OptionType.SLIDER, description: "Gaps", markers: [0, 2, 4, 6, 8, 10, 12], default: 0, hidden: true },
    wallpaper: { type: OptionType.STRING, description: "Wallpaper link", default: "", hidden: true },
    wallpaperDim: { type: OptionType.SLIDER, description: "Wallpaper dim", markers: [0, 0.25, 0.5, 0.75, 1], default: 0.5, hidden: true },
    asciiWallpaper: {
        type: OptionType.SELECT, description: "ASCII wallpaper", hidden: true,
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

export type Store = typeof settings.store;

export const DEFAULTS: Partial<Store> = {
    hideInbox: true, hideNameplates: true, hideQuests: true, hideStoreTabs: true, hideGiftButton: true,
    hideAppsButton: true, hideStickerButton: false, hideNotificationButton: true, hideVideoCallButton: true, plainFolders: true, monoServerIcons: "on", glassMenus: true,
    archLogo: true, monoWindowControls: true, grain: true, font: "iosevka", corners: 3, gap: 0, wallpaper: "",
    wallpaperDim: 0.5, asciiWallpaper: "off", asciiSize: 10
};

const cssString = (s: string) => `"${s.replace(/["\\]/g, "\\$&")}"`;
const onOff = (b: boolean) => b ? "on" : "off";

export const FONTS: Record<string, [string, string, string]> = {
    iosevka: ["'Iosevka'", "'Iosevka'", "Iosevka"],
    figtree: ["'figtree'", "'Iosevka'", "Figtree"],
    discord: ["''", "''", "Discord's own"]
};

/* ---------------- ASCII wallpaper ---------------- */

let asciiUrl: string | null = null; // a blob: link, so the style sheet stays small
let asciiKey = "";
let asciiTimer: ReturnType<typeof setTimeout> | undefined;
let asciiRetries = 0;

function loadImage(src: string, crossOrigin: boolean) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// the picture the wallpaper is made from: the link set here, or the theme's built-in one
function wallpaperSource() {
    const custom = settings.store.wallpaper.trim();
    if (custom) return custom;
    const value = getComputedStyle(document.documentElement).getPropertyValue("--wallpaper-default").trim();
    return value.match(/^url\((['"]?)([\s\S]*)\1\)$/)?.[2] ?? null;
}

// a small seeded random, so the digits stay put when the wallpaper is redrawn
function random(seed: number) {
    let t = (seed + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const RAMP = " .,:;-~=+*#%@";

async function drawAscii(src: string, mode: string, cell: number) {
    const img = await loadImage(src, !src.startsWith("data:"));
    await document.fonts.load(`600 ${cell}px Iosevka`).catch(() => void 0);

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.min(Math.round(screen.width * scale), 3840);
    const H = Math.min(Math.round(screen.height * scale), 2160);
    const fontPx = cell * scale;

    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d")!;
    ctx.font = `600 ${fontPx}px Iosevka, ui-monospace, monospace`;
    const cw = ctx.measureText("0").width || fontPx * 0.5;
    const ch = fontPx * 1.2;
    const cols = Math.ceil(W / cw);
    const rows = Math.ceil(H / ch);

    // shrink the picture to one pixel per character, cropped to the screen's shape
    const small = document.createElement("canvas");
    small.width = cols;
    small.height = rows;
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    const ir = img.naturalWidth / img.naturalHeight;
    const or = W / H;
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (ir > or) { sw = sh * or; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / or; sy = (img.naturalHeight - sh) / 2; }
    sctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
    const px = sctx.getImageData(0, 0, cols, rows).data; // throws if the site doesn't allow reading it
    // a blurred copy, to pull out local detail: flat mist or sky alone would just turn into stripes
    sctx.filter = "blur(6px)";
    sctx.drawImage(small, 0, 0);
    const blurred = sctx.getImageData(0, 0, cols, rows).data;

    // brightness per character: part overall brightness, part detail (brightness minus its surroundings),
    // then stretched so the darkest 2% are black and the brightest 2% white
    const n = cols * rows;
    const luma = (d: Uint8ClampedArray, i: number) => (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
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
            let char: string, alpha: number;
            if (mode === "ramp") {
                // denser characters for brighter spots, all of them a bit see-through
                const v = Math.pow(b, 1.4);
                char = RAMP[Math.round(v * (RAMP.length - 1))];
                if (char === " ") continue;
                alpha = 0.3 + 0.45 * v;
            } else {
                // the same random digits everywhere; brightness only changes how strongly they show
                const digits = mode === "binary" ? "01" : "0123456789";
                char = digits[Math.floor(random(i) * digits.length)];
                alpha = 0.05 + 0.8 * Math.pow(b, 1.8);
            }
            ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
            ctx.fillText(char, x * cw, y * ch);
        }
    }
    const blob = await new Promise<Blob | null>(resolve => out.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("Couldn't encode the ASCII wallpaper");
    return URL.createObjectURL(blob);
}

function setAsciiUrl(url: string | null) {
    if (asciiUrl) URL.revokeObjectURL(asciiUrl);
    asciiUrl = url;
}

// redraw the ASCII wallpaper when its source, style or size changes
function syncAscii() {
    const { asciiWallpaper: mode, asciiSize: cell } = settings.store;
    if (mode === "off") {
        asciiKey = "";
        setAsciiUrl(null);
        return;
    }
    const src = wallpaperSource();
    if (!src) {
        // the theme loads after plugins start, so its built-in wallpaper may not be there yet
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
                // the settings changed while drawing; a newer drawing is on its way
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

/* ---------------- theme variables ---------------- */

let styleEl: HTMLStyleElement | null = null;

export function applyStyle(checkAscii = true) {
    const s = settings.store;
    const [font, codeFont] = FONTS[s.font] ?? FONTS.iosevka;
    const vars: Record<string, string> = {
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
        "--custom-dms-icon": s.archLogo ? "custom" : "off",
        "--mono-window-controls": onOff(s.monoWindowControls),
        "--grain": onOff(s.grain),
        "--font": font,
        "--code-font": codeFont,
        "--corners": `${s.corners}px`,
        "--gap": `${s.gap}px`,
        "--wallpaper-dim": String(s.wallpaperDim)
    };
    const wallpaper = s.wallpaper.trim();
    if (asciiUrl && s.asciiWallpaper !== "off") vars["--wallpaper"] = `url(${cssString(asciiUrl)})`;
    else if (wallpaper) vars["--wallpaper"] = `url(${cssString(wallpaper)})`;

    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "vc-discord-rice";
    }
    // "html body" outranks the theme's plain "body" block, wherever the two style sheets end up
    styleEl.textContent = `html body {\n${Object.entries(vars).map(([k, v]) => `    ${k}: ${v};`).join("\n")}\n}`;
    if (!styleEl.isConnected) document.head.appendChild(styleEl);

    if (checkAscii) syncAscii();
}

export function set<K extends keyof Store>(key: K, value: Store[K]) {
    settings.store[key] = value;
    applyStyle();
}

export function resetAll() {
    Object.assign(settings.store, DEFAULTS);
    applyStyle();
}

export function teardown() {
    clearTimeout(asciiTimer);
    asciiKey = "";
    setAsciiUrl(null);
    styleEl?.remove();
}
