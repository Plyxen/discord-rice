/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * FolderPictures, a Vencord user plugin that goes with the discord-rice theme.
 * Gives a server folder its own look in place of the 2x2 grid: a picture (from a file or a link),
 * a few characters of ASCII, or a line icon. Looks are kept in Vencord's local DataStore.
 */

import { addGlobalContextMenuPatch, GlobalContextMenuPatchCallback, removeGlobalContextMenuPatch } from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import definePlugin from "@utils/types";
import { GuildStore, Menu, Modal, openModal, Select, showToast, SortedGuildStore, TextInput, useEffect, useReducer, useState } from "@webpack/common";

import { ICONS } from "./icons";

const STORE_KEY = "FolderPictures_looks";
const OLD_STORE_KEY = "FolderPictures_pictures";
const MAX_SIDE = 128;
const KEEP_GIF_UP_TO = 1024 * 1024;

export type Look =
    | { kind: "picture"; url: string; }
    | { kind: "ascii"; text: string; }
    | { kind: "icon"; icon: string; };

// the folder kinds people usually sort servers into, each with an ASCII look and an icon look
export const PRESETS = [
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

let looks: Record<string, Look> = {};
let styleEl: HTMLStyleElement | null = null;
const listeners = new Set<() => void>();

const cssString = (s: string) => `"${s.replace(/["\\]/g, "\\$&").replace(/\n/g, "\\a ")}"`;

export const iconUrl = (icon: string) =>
    `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${ICONS[icon] ?? ""}</svg>`
    )}")`;

// smaller text the longer it is, so 5 characters still fit in the folder
const asciiSize = (text: string) => [0, 17, 16, 14, 12, 10][Math.min(text.length, 5)] ?? 10;

// the text and icon colour: the folder's own colour, lifted so it reads on the folder's tinted background
const INK = "color-mix(in srgb, var(--custom-folder-color, #fff), white 55%)";

// Speed: every rule here ends in a tag or in the folder's own data attribute, and no rule looks at class
// names with [class*=]. Discord checks rules that end in "*" or in [class*=] against every element in the
// window each time something changes, which added up with one set of rules per folder. So the servers in
// the tile are hidden through their parent (visibility) instead of one by one, and the look is drawn in
// the parent's ::before, which is switched back to visible.
function lookCss(id: string, look: Look) {
    // the tile is tagged with its folder id by the patch below. The second form is a fallback for when the
    // patch stops matching after a Discord update
    const tile = `:is([data-vc-folder-id=${cssString(id)}], [data-list-item-id=${cssString("guildsnav___" + id)}] .folderPreviewWrapper_RTMSuZ)`;
    const inner = `${tile} > div`;
    const base = `${inner} { position: relative; visibility: hidden; }\n`
        + `${inner}::before { visibility: visible; position: absolute; inset: 0 !important; mask: none !important; }\n`;

    switch (look.kind) {
        case "picture":
            return base
                + `${inner}::before { content: "" !important; width: auto !important; height: auto !important; margin: 0 !important;`
                + ` background: center / cover no-repeat url(${cssString(look.url)}) !important;`
                + " border-radius: max(2px, calc(var(--radius-lg, 12px) - var(--custom-folder-preview-padding, 4px))); }\n"
                + `${inner}::after { content: none !important; }`;
        case "ascii":
            return base
                + `${inner}::before { content: ${cssString(look.text)} !important; width: auto !important; height: auto !important; margin: 0 !important;`
                + " display: flex; align-items: center; justify-content: center; white-space: pre; text-align: center; background: none !important;"
                + ` color: ${INK}; font-family: var(--code-font, 'Iosevka'), ui-monospace, monospace; font-weight: 600; font-size: ${asciiSize(look.text)}px; line-height: 1; letter-spacing: -0.03em; }`;
        case "icon":
            return base
                + `${inner}::before { content: "" !important; margin: auto !important; width: 22px !important; height: 22px !important;`
                + ` background: ${INK} !important; mask: ${iconUrl(look.icon)} center / contain no-repeat !important; }`;
    }
}

function updateStyle() {
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "vc-folder-pictures";
    }
    if (!styleEl.isConnected) document.head.appendChild(styleEl);
    styleEl.textContent = Object.entries(looks).map(([id, look]) => lookCss(id, look)).join("\n");
    listeners.forEach(l => l());
}

export function getLooks() {
    return looks;
}

export async function setLook(folderId: string, look: Look | null) {
    const { [folderId]: _, ...rest } = looks;
    looks = look ? { ...rest, [folderId]: look } : rest;
    await DataStore.set(STORE_KEY, looks);
    updateStyle();
}

function readAsDataUrl(file: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string, crossOrigin = false) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// square crop from the middle, at most 128px
function squareCrop(img: HTMLImageElement) {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(MAX_SIDE, side);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/webp", 0.9);
}

async function fileToPicture(file: File) {
    const dataUrl = await readAsDataUrl(file);
    if (file.type === "image/gif" && file.size <= KEEP_GIF_UP_TO) return dataUrl;
    return squareCrop(await loadImage(dataUrl));
}

export function pickFile(folderId: string) {
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

// a link becomes a small local copy when the site allows that (CORS), otherwise the link itself is kept
async function linkToPicture(link: string): Promise<string> {
    const url = new URL(link.trim());
    if (url.protocol !== "https:") throw new Error("Use an https:// link.");
    if (/(^|\.)pinterest\.[a-z.]+$/.test(url.hostname) || url.hostname === "pin.it")
        throw new Error("That's a Pinterest page, not the picture. Right-click the picture → Copy image address, and paste that (it starts with https://i.pinimg.com).");

    try {
        return squareCrop(await loadImage(url.href, true));
    } catch {
        // no CORS: keep the link, if Discord is allowed to show pictures from that site
        // (the browser version of Vencord has no csp helper; there the link is just tried)
        const allowed = VencordNative.csp
            ? await VencordNative.csp.isDomainAllowed(url.href, ["img-src"]).catch(() => false)
            : true;
        const discordCdn = /(^|\.)(discordapp\.(com|net)|discord\.com)$/.test(url.hostname);
        if (!allowed && !discordCdn)
            throw new Error(`Discord won't load pictures from ${url.hostname}. Pinterest (i.pinimg.com), imgur and Discord image links work, or save the picture and use "Picture from file".`);
        await loadImage(url.href);
        return url.href;
    }
}

function LinkModal({ folderId, modalProps }: { folderId: string; modalProps: any; }) {
    const [link, setLink] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await setLook(folderId, { kind: "picture", url: await linkToPicture(link) });
            modalProps.onClose();
        } catch (e: any) {
            setError(e?.message && !(e instanceof Event) ? e.message : "Couldn't load a picture from that link.");
        }
        setBusy(false);
    };

    return (
        <Modal
            {...modalProps}
            size="sm"
            title="Picture from link"
            subtitle="Paste a link to a picture. On Pinterest: right-click the picture → Copy image address."
            notice={error ? { message: error, type: "critical" } : undefined}
            actions={[
                { text: "Cancel", variant: "secondary", onClick: modalProps.onClose },
                { text: "Use it", variant: "primary", onClick: save, loading: busy, disabled: !link.trim() }
            ]}
        >
            <TextInput value={link} onChange={(v: string) => setLink(v)} placeholder="https://i.pinimg.com/..." autoFocus />
        </Modal>
    );
}

export function pickLink(folderId: string) {
    openModal(props => <LinkModal folderId={folderId} modalProps={props} />);
}

function TextModal({ folderId, modalProps }: { folderId: string; modalProps: any; }) {
    const current = looks[folderId];
    const [text, setText] = useState(current?.kind === "ascii" ? current.text : "");
    return (
        <Modal
            {...modalProps}
            size="sm"
            title="Your own text"
            subtitle="Up to 5 characters, shown in the folder in the terminal font. Try >_ or (o.o) or ;-;"
            actions={[
                { text: "Cancel", variant: "secondary", onClick: modalProps.onClose },
                {
                    text: "Use it", variant: "primary", disabled: !text.trim(),
                    onClick: () => { setLook(folderId, { kind: "ascii", text: text.trim() }); modalProps.onClose(); }
                }
            ]}
        >
            <TextInput value={text} maxLength={5} onChange={(v: string) => setText(v)} placeholder="!!" autoFocus />
        </Modal>
    );
}

export function pickText(folderId: string) {
    openModal(props => <TextModal folderId={folderId} modalProps={props} />);
}

function MenuIcon({ icon }: { icon: string; }) {
    return <div style={{ width: 18, height: 18, flexShrink: 0, background: "currentColor", mask: `${iconUrl(icon)} center / contain no-repeat` }} />;
}

// Discord's newer menu style ignores a menu item's `icon` and only draws a `trailingIndicator`; the
// older style does the opposite. Pass both, so the icon shows either way
function menuIcon(icon: string) {
    const Icon = () => <MenuIcon icon={icon} />;
    return { icon: Icon, trailingIndicator: { type: "icon", icon: Icon } } as any;
}

// a preset's ASCII in a fixed-width column in front of its name
function AsciiLabel({ ascii, name }: { ascii: string; name: string; }) {
    return (
        <span style={{ whiteSpace: "pre" }}>
            <span style={{ fontFamily: "var(--code-font, 'Iosevka'), ui-monospace, monospace" }}>{ascii.padEnd(6, " ")}</span>
            {name}
        </span>
    );
}

// the folder right-click menu gets { folderId, folderName, folderColor, unread }. Its menu id isn't
// fixed, so check every menu for a folderId instead
const folderMenuPatch: GlobalContextMenuPatchCallback = (_navId, children, ...args) => {
    const props = args[0];
    if (props?.folderId == null || props.guild != null) return;
    const id = String(props.folderId);

    children.push(
        <Menu.MenuGroup>
            <Menu.MenuItem id="vc-folder-look" label="Folder look">
                <Menu.MenuItem id="vc-folder-look-file" label="Picture from file…" action={() => pickFile(id)} />
                <Menu.MenuItem id="vc-folder-look-link" label="Picture from link…" action={() => pickLink(id)} />
                <Menu.MenuSeparator />
                <Menu.MenuItem id="vc-folder-look-ascii" label="ASCII">
                    {PRESETS.map(p => (
                        <Menu.MenuItem key={p.name} id={`vc-folder-look-ascii-${p.icon}`} label={<AsciiLabel ascii={p.ascii} name={p.name} />}
                            action={() => setLook(id, { kind: "ascii", text: p.ascii })} />
                    ))}
                    <Menu.MenuSeparator />
                    <Menu.MenuItem id="vc-folder-look-text" label="Your own text…" action={() => pickText(id)} />
                </Menu.MenuItem>
                <Menu.MenuItem id="vc-folder-look-icon" label="Icon">
                    {PRESETS.map(p => (
                        <Menu.MenuItem key={p.name} id={`vc-folder-look-icon-${p.icon}`} label={p.name}
                            {...menuIcon(p.icon)}
                            action={() => setLook(id, { kind: "icon", icon: p.icon })} />
                    ))}
                </Menu.MenuItem>
                {id in looks && <Menu.MenuSeparator />}
                {id in looks && (
                    <Menu.MenuItem id="vc-folder-look-reset" label="Back to normal" color="danger" action={() => setLook(id, null)} />
                )}
            </Menu.MenuItem>
        </Menu.MenuGroup>
    );
};

function folderLabel(folder: { folderName?: string | null; guildIds: string[]; }) {
    if (folder.folderName) return folder.folderName;
    const names = folder.guildIds.slice(0, 3).map(id => GuildStore.getGuild(id)?.name).filter(Boolean);
    return names.join(", ") || "Unnamed folder";
}

// a small copy of the folder, for the list
export function LookPreview({ look, size = 36 }: { look?: Look; size?: number; }) {
    const box = { width: size, height: size, flexShrink: 0, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--background-mod-normal)", overflow: "hidden" };
    if (!look) return <div style={box} />;
    if (look.kind === "picture") return <div style={{ ...box, background: `center / cover url(${cssString(look.url)})` }} />;
    if (look.kind === "icon") return <div style={box}><MenuIcon icon={look.icon} /></div>;
    return <div style={{ ...box, fontFamily: "var(--code-font, monospace)", fontWeight: 600, fontSize: Math.round(asciiSize(look.text) * size / 48), whiteSpace: "pre" }}>{look.text}</div>;
}

const presetOptions = [
    ...PRESETS.map(p => ({ label: `ASCII  ${p.ascii}  ${p.name}`, value: `ascii:${p.ascii}` })),
    ...PRESETS.map(p => ({ label: `Icon  ${p.name}`, value: `icon:${p.icon}` }))
];

export function FolderList() {
    const [, rerender] = useReducer(x => x + 1, 0);
    // re-render when a look changes
    useEffect(() => {
        listeners.add(rerender);
        return () => void listeners.delete(rerender);
    }, []);

    const folders = SortedGuildStore.getGuildFolders().filter(f => f.folderId != null);
    if (!folders.length) return <Paragraph>You don't have any server folders.</Paragraph>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {folders.map(f => {
                const id = String(f.folderId);
                const look = looks[id];
                const value = look?.kind === "ascii" ? `ascii:${look.text}` : look?.kind === "icon" ? `icon:${look.icon}` : null;
                return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <LookPreview look={look} />
                        <span style={{ width: 130, flexShrink: 0, color: "var(--text-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {folderLabel(f)}
                        </span>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <Select
                                placeholder="Preset…"
                                options={presetOptions}
                                closeOnSelect
                                isSelected={v => v === value}
                                serialize={v => String(v)}
                                select={(v: string) => {
                                    const [kind, rest] = [v.slice(0, v.indexOf(":")), v.slice(v.indexOf(":") + 1)];
                                    setLook(id, kind === "ascii" ? { kind: "ascii", text: rest } : { kind: "icon", icon: rest });
                                }}
                            />
                        </div>
                        <Button size="small" variant="secondary" onClick={() => pickFile(id)}>File</Button>
                        <Button size="small" variant="secondary" onClick={() => pickLink(id)}>Link</Button>
                        <Button size="small" variant="secondary" onClick={() => pickText(id)}>Text</Button>
                        {look && <Button size="small" variant="dangerSecondary" onClick={() => setLook(id, null)}>Reset</Button>}
                    </div>
                );
            })}
        </div>
    );
}

// what the discord-rice settings window uses to list and edit folder looks (it reaches this through
// plugins.FolderPictures.api, so DiscordRice still works without this plugin)
export const api = {
    presets: PRESETS,
    iconUrl,
    getLooks,
    setLook,
    pickFile,
    folderLabel,
    setFromLink: async (folderId: string, link: string) => setLook(folderId, { kind: "picture", url: await linkToPicture(link) }),
    subscribe(listener: () => void) {
        listeners.add(listener);
        return () => void listeners.delete(listener);
    }
};

export default definePlugin({
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
        let saved = await DataStore.get<Record<string, Look>>(STORE_KEY);
        if (!saved) {
            // pictures saved by the first version were plain strings
            const old = await DataStore.get<Record<string, string>>(OLD_STORE_KEY);
            saved = Object.fromEntries(Object.entries(old ?? {}).map(([id, url]) => [id, { kind: "picture", url } as Look]));
            if (old) await DataStore.set(STORE_KEY, saved);
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
