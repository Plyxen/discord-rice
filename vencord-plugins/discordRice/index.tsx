/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * DiscordRice, a Vencord user plugin that goes with the discord-rice theme.
 *
 * - A button in the channel header (where the inbox button was) opens the discord-rice popup: a
 *   neofetch-style summary, tips, folder looks, and switches for every theme option, so nobody has to
 *   edit the CSS file. The same page is in Discord's settings (Vencord section), and the popup shows
 *   once on first start.
 * - The switches set the theme's CSS variables on <body> from a small style sheet. That beats the
 *   defaults in the theme file, and turning this plugin off brings the file's own values back.
 * - ASCII wallpaper: redraws the wallpaper as characters (a brightness ramp, digits or 0s and 1s) on a
 *   canvas and uses that picture instead.
 */

import { isPluginEnabled, plugins } from "@api/PluginManager";
import { definePluginSettings, Settings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { PaintbrushIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import { Modal, openModal, Select, showToast, Slider, SortedGuildStore, TextInput, useEffect, UserStore, useState } from "@webpack/common";
import type { ComponentType, ReactNode } from "react";

const THEME_FILE = "discord-rice.theme.css";
// the online-theme link (Settings → Vencord → Themes → Online Themes), served by jsDelivr from the repo
const THEME_LINK = "https://cdn.jsdelivr.net/gh/Plyxen/discord-rice@main/discord-rice.theme.css";
const isOurLink = (link: string) => link.includes(THEME_FILE);
const ENTRY_KEY = "vencord_discord_rice";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

const settings = definePluginSettings({
    hideInbox: { type: OptionType.BOOLEAN, description: "Hide the inbox button", default: true, hidden: true },
    hideNameplates: { type: OptionType.BOOLEAN, description: "Hide nameplates", default: true, hidden: true },
    hideQuests: { type: OptionType.BOOLEAN, description: "Hide quests", default: true, hidden: true },
    hideStoreTabs: { type: OptionType.BOOLEAN, description: "Hide Nitro / Shop / Quests tabs", default: true, hidden: true },
    hideGiftButton: { type: OptionType.BOOLEAN, description: "Hide the gift button", default: true, hidden: true },
    hideAppsButton: { type: OptionType.BOOLEAN, description: "Hide the apps button", default: true, hidden: true },
    hideStickerButton: { type: OptionType.BOOLEAN, description: "Hide the sticker button", default: false, hidden: true },
    hideNotificationButton: { type: OptionType.BOOLEAN, description: "Hide the notification bell", default: true, hidden: true },
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

type Store = typeof settings.store;

const DEFAULTS: Partial<Store> = {
    hideInbox: true, hideNameplates: true, hideQuests: true, hideStoreTabs: true, hideGiftButton: true,
    hideAppsButton: true, hideStickerButton: false, hideNotificationButton: true, plainFolders: true, monoServerIcons: "on", glassMenus: true,
    archLogo: true, monoWindowControls: true, grain: true, font: "iosevka", corners: 3, gap: 0, wallpaper: "",
    wallpaperDim: 0.5, asciiWallpaper: "off", asciiSize: 10
};

const cssString = (s: string) => `"${s.replace(/["\\]/g, "\\$&")}"`;
const onOff = (b: boolean) => b ? "on" : "off";

const FONTS: Record<string, [string, string, string]> = {
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

function applyStyle(checkAscii = true) {
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

function set<K extends keyof Store>(key: K, value: Store[K]) {
    settings.store[key] = value;
    applyStyle();
}

/* ---------------- neofetch ---------------- */

const BOWL = [
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

const PALETTE = ["--text-5", "--text-4", "--text-3", "--text-2", "--text-1", "--red-2", "--yellow-2", "--green-2", "--blue-2", "--purple-2"];

function uptime() {
    const m = Math.floor(performance.now() / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

const mono = { margin: 0, fontFamily: "var(--code-font, 'Iosevka'), ui-monospace, monospace", fontSize: 12, lineHeight: 1.3, whiteSpace: "pre" } as const;

function Fetch() {
    const s = settings.use();
    const { enabledThemes, themeLinks } = useSettings(["enabledThemes", "themeLinks"]);
    const user = UserStore.getCurrentUser();
    const ours = ["DiscordRice", "FolderPictures", "CodeBlockButton"].filter(isPluginEnabled);
    const folders = SortedGuildStore.getGuildFolders().filter(f => f.folderId != null).length;

    const rows: [string, string][] = [
        ["theme", enabledThemes.includes(THEME_FILE) || themeLinks.some(isOurLink) ? "discord-rice" : "off"],
        ["wm", s.gap ? `tiled, ${s.gap}px gaps` : "tiled, no gaps"],
        ["font", FONTS[s.font]?.[2] ?? "Iosevka"],
        ["colors", "greyscale"],
        ["corners", `${s.corners}px`],
        ["wallpaper", s.asciiWallpaper !== "off" ? `ascii (${s.asciiWallpaper})` : s.wallpaper.trim() ? "custom" : "misty forest"],
        ["folders", String(folders)],
        ["plugins", ours.join(", ")],
        ["uptime", uptime()]
    ];
    const title = `${user?.username ?? "you"}@discord`;

    return (
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", padding: "4px 0 8px" }}>
            <pre style={{ ...mono, color: "var(--text-muted)" }}>{BOWL.join("\n")}</pre>
            <div style={mono}>
                <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>{title}</div>
                <div style={{ color: "var(--text-muted)" }}>{"-".repeat(title.length)}</div>
                {rows.map(([k, v]) => (
                    <div key={k}>
                        <span style={{ color: "var(--header-primary)", fontWeight: 600 }}>{k.padEnd(10)}</span>
                        <span style={{ color: "var(--text-default)" }}>{v}</span>
                    </div>
                ))}
                <div style={{ display: "flex", marginTop: 8 }}>
                    {PALETTE.map(v => <span key={v} style={{ width: 18, height: 12, background: `var(${v}, #888)` }} />)}
                </div>
            </div>
        </div>
    );
}

/* ---------------- the panel ---------------- */

function Section({ title, children }: { title: string; children: ReactNode; }) {
    return (
        <section className={Margins.top16}>
            <Heading tag="h3" className={Margins.bottom8}>{title}</Heading>
            {children}
        </section>
    );
}

function Toggle({ k, title, description }: { k: keyof Store; title: string; description?: string; }) {
    const s = settings.use([k]);
    return <FormSwitch title={title} description={description} value={s[k] as boolean} onChange={v => set(k, v as any)} />;
}

function Choice({ k, title, options }: { k: keyof Store; title: string; options: { label: string; value: string; }[]; }) {
    const s = settings.use([k]);
    return (
        <div className={Margins.bottom16}>
            <Paragraph className={Margins.bottom8}>{title}</Paragraph>
            <Select
                options={options}
                closeOnSelect
                select={v => set(k, v)}
                isSelected={v => v === s[k]}
                serialize={v => String(v)}
            />
        </div>
    );
}

function Range({ k, title, markers, render }: { k: keyof Store; title: string; markers: number[]; render(v: number): string; }) {
    return (
        <div className={Margins.bottom16}>
            <Paragraph className={Margins.bottom8}>{title}</Paragraph>
            <Slider
                markers={markers}
                minValue={markers[0]}
                maxValue={markers[markers.length - 1]}
                initialValue={settings.store[k] as number}
                onValueChange={v => set(k, v as any)}
                onValueRender={render}
                onMarkerRender={render}
                stickToMarkers={k !== "wallpaperDim"}
            />
        </div>
    );
}

function ThemeStatus() {
    const { enabledThemes, themeLinks } = useSettings(["enabledThemes", "themeLinks"]);
    // whether the theme file is in the themes folder; if not, turning the theme on adds the online link
    const [hasFile, setHasFile] = useState(false);
    useEffect(() => {
        VencordNative.themes.getThemesList()
            .then(list => setHasFile(list.some(t => t.fileName === THEME_FILE)))
            .catch(() => void 0);
    }, []);

    const themeOn = enabledThemes.includes(THEME_FILE) || themeLinks.some(isOurLink);
    const plugin = (name: string) => isPluginEnabled(name) ? "on" : "off (turn it on in Plugins, then restart Discord)";

    return (
        <>
            <FormSwitch
                title="Theme"
                description="From the themes folder or the online link. Everything below needs it on."
                value={themeOn}
                onChange={on => {
                    if (on) {
                        if (hasFile) Settings.enabledThemes = [...enabledThemes, THEME_FILE];
                        else Settings.themeLinks = [...themeLinks, THEME_LINK];
                    } else {
                        Settings.enabledThemes = enabledThemes.filter(t => t !== THEME_FILE);
                        Settings.themeLinks = themeLinks.filter(l => !isOurLink(l));
                    }
                }}
            />
            <Paragraph className={Margins.top8}>FolderPictures plugin: {plugin("FolderPictures")}</Paragraph>
            <Paragraph>CodeBlockButton plugin: {plugin("CodeBlockButton")}</Paragraph>
        </>
    );
}

function Folders() {
    const FolderList = plugins.FolderPictures?.settingsAboutComponent as ComponentType | undefined;
    if (!isPluginEnabled("FolderPictures") || !FolderList) {
        return <Paragraph>Turn on the FolderPictures plugin (then restart Discord) to give folders pictures, ASCII or icons.</Paragraph>;
    }
    return (
        <>
            <Paragraph className={Margins.bottom8}>
                Give a folder a preset (ASCII or an icon), a picture from a file, or a picture from a link: on Pinterest,
                right-click a picture → Copy image address. The same is in the folder's right-click menu → Folder look.
            </Paragraph>
            <FolderList />
        </>
    );
}

function RicePanel() {
    // re-mount the sliders after a reset, since they only read their starting value
    const [resets, setResets] = useState(0);
    const { wallpaper } = settings.use(["wallpaper"]);

    return (
        <div>
            <Fetch />
            <Paragraph>
                A tiling-WM Linux rice for Discord: one wallpaper behind tiled panes split by thin lines, greyscale,
                Iosevka, frosted-glass menus, and terminal touches like a ❯ prompt and [timestamps]. Changes here apply
                straight away.
            </Paragraph>

            <Section title="Status">
                <ThemeStatus />
            </Section>

            <Section title="Tips">
                <Paragraph>• Right-click a server folder → Folder look, for a picture, ASCII or an icon.</Paragraph>
                <Paragraph>• Select text in the chat box, then the ``` button wraps it in a code block.</Paragraph>
                <Paragraph>• Drag the window by the empty space in the channel header, next to the channel name.</Paragraph>
                <Paragraph>• This popup lives behind the sliders button in the channel header, and in Settings → discord-rice.</Paragraph>
            </Section>

            <Section title="Folders">
                <Folders />
            </Section>

            <Section title="Hide">
                <Toggle k="hideInbox" title="Inbox button" description="In the channel header. The discord-rice button takes its place." />
                <Toggle k="hideNotificationButton" title="Notification bell" description="In the channel header. Right-click a channel for the same settings. English Discord only." />
                <Toggle k="hideNameplates" title="Nameplates" description="The picture strips behind names in the member list, DM list and user panel." />
                <Toggle k="hideQuests" title="Quests" description="The quest card above your user panel, and quest embeds in chat." />
                <Toggle k="hideStoreTabs" title="Nitro, Shop and Quests tabs" description="The rows at the top of the DM list." />
                <Toggle k="hideGiftButton" title="Gift button" description="In the chat bar. English Discord only." />
                <Toggle k="hideAppsButton" title="Apps button" description="The apps / activities launcher in the chat bar." />
                <Toggle k="hideStickerButton" title="Sticker button" description="In the chat bar. English Discord only." />
            </Section>

            <Section title="Server list">
                <Toggle k="plainFolders" title="Plain folders" description="A closed folder shows a folder icon instead of a 2×2 grid of its servers. A folder look takes its place." />
                <Choice k="monoServerIcons" title="Black-and-white server icons and folders" options={[
                    { label: "On", value: "on" },
                    { label: "Colour under the mouse", value: "hover" },
                    { label: "Off, keep colour", value: "off" }
                ]} />
                <Toggle k="archLogo" title="Arch logo" description="On the home button, instead of Discord's logo." />
            </Section>

            <Section title="Look">
                <Choice k="font" title="Font" options={[
                    { label: "Iosevka", value: "iosevka" },
                    { label: "Figtree (midnight's font)", value: "figtree" },
                    { label: "Discord's own", value: "discord" }
                ]} />
                <Range key={`corners-${resets}`} k="corners" title="Corners" markers={[0, 1, 2, 3, 4, 6, 8, 10, 12]} render={v => `${v}px`} />
                <Range key={`gap-${resets}`} k="gap" title="Gaps between the columns (0 = tiled)" markers={[0, 2, 4, 6, 8, 10, 12]} render={v => `${v}px`} />
                <Toggle k="glassMenus" title="Frosted-glass menus" description="Menus and pickers are see-through with a blur. Off makes them solid." />
                <Toggle k="monoWindowControls" title="Grey window dots" description="Instead of red / yellow / green." />
            </Section>

            <Section title="Wallpaper">
                <Paragraph className={Margins.bottom8}>
                    A link to any image (imgur, Pinterest's i.pinimg.com, github.io and raw.githubusercontent.com work). Leave it empty for the misty forest.
                </Paragraph>
                <TextInput value={wallpaper} placeholder="https://i.imgur.com/....jpg" onChange={(v: string) => set("wallpaper", v)} />
                <div className={Margins.top16}>
                    <Choice k="asciiWallpaper" title="ASCII wallpaper: redraw the wallpaper out of characters" options={[
                        { label: "Off", value: "off" },
                        { label: "Characters  .:-=+*#%@", value: "ramp" },
                        { label: "Digits  0-9", value: "digits" },
                        { label: "Binary  0 1", value: "binary" }
                    ]} />
                    <Range key={`ascii-${resets}`} k="asciiSize" title="ASCII character size" markers={[6, 8, 10, 12, 14, 16]} render={v => `${v}px`} />
                    <Range key={`dim-${resets}`} k="wallpaperDim" title="Darken the wallpaper" markers={[0, 0.25, 0.5, 0.75, 1]} render={v => `${Math.round(v * 100)}%`} />
                </div>
                <Toggle k="grain" title="Film grain" description="A little noise over the wallpaper." />
            </Section>

            <div className={Margins.top16}>
                <Button
                    variant="secondary"
                    onClick={() => {
                        Object.assign(settings.store, DEFAULTS);
                        applyStyle();
                        setResets(r => r + 1);
                    }}
                >
                    Reset all to defaults
                </Button>
            </div>
        </div>
    );
}

function RicePage() {
    return <SettingsTab><RicePanel /></SettingsTab>;
}

export function openRicePopup() {
    openModal(props => (
        <Modal
            {...props}
            size="lg"
            title="discord-rice"
            subtitle="A Linux-rice look for Discord"
            actions={[{ text: "Done", variant: "primary", onClick: props.onClose }]}
        >
            <RicePanel />
        </Modal>
    ));
}

/* ---------------- header button ---------------- */

function SlidersIcon() {
    return (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
            <circle cx="15" cy="6" r="2" />
            <circle cx="9" cy="12" r="2" />
            <circle cx="17" cy="18" r="2" />
        </svg>
    );
}

function RiceButton() {
    return (
        <HeaderBarIcon
            className="vc-discord-rice-btn"
            onClick={openRicePopup}
            tooltip="discord-rice"
            icon={SlidersIcon}
        />
    );
}

export default definePlugin({
    name: "DiscordRice",
    description: "Options and info for the discord-rice theme, behind a button in the channel header: hide the inbox, nameplates and quests, folder looks, font, corners, wallpaper, ASCII wallpaper and more, without editing CSS.",
    authors: [{ name: "Pota", id: 0n }],
    enabledByDefault: true,
    settings,

    patches: [
        {
            // the buttons at the end of the title bar (the theme moves them into the channel header):
            // swap the inbox for the discord-rice button, or put it next to the inbox
            find: '?"BACK_FORWARD_NAVIGATION":',
            replacement: {
                match: /(\i)&&(\(0,(\i)\.jsx\)\(\i,\{\.\.\."RECENTS"===\i\?\i:\{\}\}\))/,
                replace: "(0,$3.jsx)($self.InboxSlot,{show:$1,inbox:$2})"
            }
        }
    ],

    InboxSlot({ show, inbox }: { show: boolean; inbox: ReactNode; }) {
        const { hideInbox } = settings.use(["hideInbox"]);
        return (
            <>
                {show && !hideInbox && inbox}
                <ErrorBoundary noop>
                    <RiceButton />
                </ErrorBoundary>
            </>
        );
    },

    settingsAboutComponent: RicePanel,

    toolboxActions: {
        "discord-rice options": openRicePopup
    },

    flux: {
        // say hello once, the first time Discord is ready with this plugin on
        CONNECTION_OPEN() {
            if (settings.store.seenWelcome) return;
            settings.store.seenWelcome = true;
            setTimeout(openRicePopup, 1500);
        }
    },

    start() {
        applyStyle();
        SettingsPlugin.customEntries.push({
            key: ENTRY_KEY,
            title: "discord-rice",
            Component: RicePage,
            Icon: PaintbrushIcon
        });
    },

    stop() {
        clearTimeout(asciiTimer);
        asciiKey = "";
        setAsciiUrl(null);
        styleEl?.remove();
        removeFromArray(SettingsPlugin.customEntries, e => e.key === ENTRY_KEY);
    }
});
