/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// The discord-rice settings window: a small terminal-style config tool with a tab list on the left, [x]
// switches, block sliders and a status line. Opens as a popup (header button, toolbox, first start) and is
// also the discord-rice page in Discord's settings. Styles are in style.css.

import { isPluginEnabled, plugins } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings/tabs/BaseTab";
import { GuildStore, IconUtils, openModal, SortedGuildStore, useEffect, useReducer, useRef, UserStore, useState } from "@webpack/common";
import type { KeyboardEvent, ReactNode } from "react";

import { FONTS, isOurLink, resetAll, set, settings, Store, THEME_FILE, THEME_LINK } from "./store";

type Key = keyof Store;

/* ---------------- controls ---------------- */

function Heading({ children }: { children: ReactNode; }) {
    return <div className="vc-rice-h">{children}</div>;
}

// [x] label: the whole row is one switch
function Check({ k, label, desc }: { k: Key; label: string; desc?: string; }) {
    const on = settings.use([k])[k] as boolean;
    return (
        <button role="switch" aria-checked={on} className="vc-rice-check" onClick={() => set(k, !on as any)}>
            <span className="vc-rice-box" aria-hidden>{on ? "[x]" : "[ ]"}</span>
            <span className="vc-rice-label">{label}</span>
            {desc && <span className="vc-rice-desc">{desc}</span>}
        </button>
    );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: ReactNode; }) {
    return (
        <div className="vc-rice-field">
            <span className="vc-rice-label">{label}</span>
            {children}
            {desc && <span className="vc-rice-desc">{desc}</span>}
        </div>
    );
}

// one of a few: [ iosevka ] discord
function Choice({ k, label, desc, options }: { k: Key; label: string; desc?: string; options: [value: string, text: string][]; }) {
    const value = settings.use([k])[k];
    return (
        <Field label={label} desc={desc}>
            <div className="vc-rice-seg" role="radiogroup" aria-label={label}>
                {options.map(([v, text]) => (
                    <button key={v} role="radio" aria-checked={value === v} className="vc-rice-opt" onClick={() => set(k, v as any)}>
                        {text}
                    </button>
                ))}
            </div>
        </Field>
    );
}

// a slider drawn as blocks, one per allowed value: ‹ ▮▮▮█▯▯▯ › 3px
function Range({ k, label, desc, values, show }: { k: Key; label: string; desc?: string; values: number[]; show(v: number): string; }) {
    const value = settings.use([k])[k] as number;
    const at = Math.max(0, values.findIndex(v => v >= value - 1e-9));
    const go = (i: number) => set(k, values[Math.max(0, Math.min(values.length - 1, i))] as any);
    const keys: Record<string, () => void> = {
        ArrowLeft: () => go(at - 1), ArrowDown: () => go(at - 1),
        ArrowRight: () => go(at + 1), ArrowUp: () => go(at + 1),
        Home: () => go(0), End: () => go(values.length - 1)
    };

    return (
        <Field label={label} desc={desc}>
            <div
                className="vc-rice-range"
                role="slider"
                tabIndex={0}
                aria-label={label}
                aria-valuemin={values[0]}
                aria-valuemax={values[values.length - 1]}
                aria-valuenow={value}
                aria-valuetext={show(value)}
                onKeyDown={e => {
                    if (!keys[e.key]) return;
                    e.preventDefault();
                    keys[e.key]();
                }}
            >
                <button className="vc-rice-step" tabIndex={-1} aria-hidden onClick={() => go(at - 1)}>‹</button>
                <span className="vc-rice-cells">
                    {values.map((v, i) => (
                        <button
                            key={v}
                            tabIndex={-1}
                            aria-hidden
                            title={show(v)}
                            className={"vc-rice-cell" + (i < at ? " on" : i === at ? " cur" : "")}
                            onClick={() => go(i)}
                        />
                    ))}
                </span>
                <button className="vc-rice-step" tabIndex={-1} aria-hidden onClick={() => go(at + 1)}>›</button>
                <span className="vc-rice-value">{show(value)}</span>
            </div>
        </Field>
    );
}

function Prompt({ value, onChange, placeholder, maxLength, onEnter, label }: {
    value: string; onChange(v: string): void; placeholder?: string; maxLength?: number; onEnter?(): void; label: string;
}) {
    return (
        <label className="vc-rice-input">
            <span aria-hidden>❯</span>
            <input
                value={value}
                placeholder={placeholder}
                maxLength={maxLength}
                spellCheck={false}
                aria-label={label}
                onChange={e => onChange(e.currentTarget.value)}
                onKeyDown={e => { if (e.key === "Enter") onEnter?.(); }}
            />
        </label>
    );
}

/* ---------------- about ---------------- */

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

const PALETTE = ["--fg-faint", "--fg-dim", "--fg", "--fg-strong", "--fg-bright", "--red", "--yellow", "--green", "--blue", "--purple"];

const PLUGINS: [name: string, what: string][] = [
    ["DiscordRice", "this window, the switches, the ascii wallpaper"],
    ["FolderPictures", "folder looks: pictures, ascii and icons"],
    ["CodeBlockButton", "the ``` button when you select text in the chat bar"]
];

function useThemeOn() {
    const { enabledThemes, themeLinks } = useSettings(["enabledThemes", "themeLinks"]);
    return { on: enabledThemes.includes(THEME_FILE) || themeLinks.some(isOurLink), enabledThemes, themeLinks };
}

function uptime() {
    const m = Math.floor(performance.now() / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function Fetch() {
    const s = settings.use();
    const { on } = useThemeOn();
    const user = UserStore.getCurrentUser();
    const folders = SortedGuildStore.getGuildFolders().filter(f => f.folderId != null).length;
    const title = `${user?.username ?? "you"}@discord`;
    const rows: [string, string][] = [
        ["theme", on ? "discord-rice" : "off"],
        ["wm", "tiled, no gaps"],
        ["font", FONTS[s.font]?.[2] ?? "Iosevka"],
        ["colors", "greyscale"],
        ["corners", `${s.corners}px`],
        ["wallpaper", s.asciiWallpaper !== "off" ? `ascii (${s.asciiWallpaper})` : s.wallpaper.trim() ? "custom" : "misty forest"],
        ["folders", String(folders)],
        ["plugins", PLUGINS.map(([n]) => n).filter(isPluginEnabled).join(", ")],
        ["uptime", uptime()]
    ];

    return (
        <div className="vc-rice-fetch">
            <pre aria-hidden>{BOWL.join("\n")}</pre>
            <div>
                <div className="who">{title}</div>
                <div aria-hidden>{"-".repeat(title.length)}</div>
                {rows.map(([k, v]) => <div key={k}><span className="k">{k}</span>{v}</div>)}
                <div className="vc-rice-palette" aria-hidden>
                    {PALETTE.map(v => <span key={v} style={{ background: `var(${v}, #888)` }} />)}
                </div>
            </div>
        </div>
    );
}

// the theme itself: in the themes folder, or the online link if the file isn't there
function ThemeCheck() {
    const { on, enabledThemes, themeLinks } = useThemeOn();
    const [hasFile, setHasFile] = useState(false);
    useEffect(() => {
        VencordNative.themes.getThemesList()
            .then(list => setHasFile(list.some(t => t.fileName === THEME_FILE)))
            .catch(() => void 0);
    }, []);

    const toggle = () => {
        if (!on) {
            if (hasFile) Settings.enabledThemes = [...enabledThemes, THEME_FILE];
            else Settings.themeLinks = [...themeLinks, THEME_LINK];
        } else {
            Settings.enabledThemes = enabledThemes.filter(t => t !== THEME_FILE);
            Settings.themeLinks = themeLinks.filter(l => !isOurLink(l));
        }
    };

    return (
        <button role="switch" aria-checked={on} className="vc-rice-check" onClick={toggle}>
            <span className="vc-rice-box" aria-hidden>{on ? "[x]" : "[ ]"}</span>
            <span className="vc-rice-label">theme</span>
            <span className="vc-rice-desc">from the themes folder or the online link. everything here needs it on.</span>
        </button>
    );
}

function About() {
    return (
        <>
            <Fetch />
            <Heading>status</Heading>
            <ThemeCheck />
            <div style={{ marginTop: 6 }}>
                {PLUGINS.map(([name, what]) => {
                    const on = isPluginEnabled(name);
                    return (
                        <div key={name} className="vc-rice-plugin">
                            <span className={"dot" + (on ? " on" : "")} aria-hidden>{on ? "●" : "○"}</span>
                            <b>{name}</b>
                            <span className="vc-rice-desc">{on ? what : "off: turn it on in Vencord → Plugins, then restart Discord"}</span>
                        </div>
                    );
                })}
            </div>
            <Heading>tips</Heading>
            <ul className="vc-rice-tips">
                <li>right-click a server folder → <kbd>Folder look</kbd>, or use the folders tab here.</li>
                <li>select text in the chat bar, then the <kbd>```</kbd> button wraps it in a code block.</li>
                <li>drag the window by the empty space in the channel header, next to the channel name.</li>
                <li>this window is behind the rice bowl button in the channel header, and in Settings → discord-rice.</li>
            </ul>
        </>
    );
}

/* ---------------- folders ---------------- */

type Look = { kind: "picture"; url: string; } | { kind: "ascii"; text: string; } | { kind: "icon"; icon: string; };
interface FolderApi {
    presets: { name: string; ascii: string; icon: string; }[];
    iconUrl(icon: string): string;
    getLooks(): Record<string, Look>;
    setLook(folderId: string, look: Look | null): Promise<void>;
    pickFile(folderId: string): void;
    folderLabel(folder: { folderName?: string | null; guildIds: string[]; }): string;
    setFromLink(folderId: string, link: string): Promise<void>;
    subscribe(listener: () => void): () => void;
}

const folderApi = () => isPluginEnabled("FolderPictures") ? (plugins.FolderPictures as any)?.api as FolderApi | undefined : undefined;

const describe = (look?: Look) =>
    !look ? "default" : look.kind === "ascii" ? `ascii ${look.text}` : look.kind === "icon" ? `icon ${look.icon}` : "picture";

function Preview({ look, api, guildIds }: { look?: Look; api: FolderApi; guildIds: string[]; }) {
    const { plainFolders, monoServerIcons } = settings.use(["plainFolders", "monoServerIcons"]);
    if (look?.kind === "picture") return <span className="vc-rice-preview" style={{ backgroundImage: `url(${JSON.stringify(look.url)})` }} />;
    if (look?.kind === "icon") return <span className="vc-rice-preview"><span className="icon" style={{ mask: `${api.iconUrl(look.icon)} center / contain no-repeat` }} /></span>;
    if (look?.kind === "ascii") return <span className="vc-rice-preview" style={{ fontSize: look.text.length > 3 ? 9 : 12 }}>{look.text}</span>;

    // no look: what the server list shows, a folder icon or Discord's 2×2 grid of the first four servers
    if (plainFolders) return <span className="vc-rice-preview"><span className="icon vc-rice-folder-glyph" /></span>;
    return (
        <span className={`vc-rice-preview vc-rice-grid${monoServerIcons === "off" ? "" : " mono"}`}>
            {guildIds.slice(0, 4).map(id => {
                const guild = GuildStore.getGuild(id);
                const url = guild?.icon ? IconUtils.getGuildIconURL({ id, icon: guild.icon, size: 32, canAnimate: false }) : undefined;
                return url ? <img key={id} src={url} alt="" /> : <span key={id}>{guild?.name?.[0] ?? ""}</span>;
            })}
        </span>
    );
}

function FolderRow({ id, name, guildIds, look, api, open, onToggle }: {
    id: string; name: string; guildIds: string[]; look?: Look; api: FolderApi; open: boolean; onToggle(): void;
}) {
    const [text, setText] = useState(look?.kind === "ascii" ? look.text : "");
    const [link, setLink] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const editId = `vc-rice-folder-${id}`;

    const setText_ = () => text.trim() && api.setLook(id, { kind: "ascii", text: text.trim() });
    const setLink_ = async () => {
        if (!link.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
            await api.setFromLink(id, link);
            setLink("");
        } catch (e: any) {
            setError(e?.message && !(e instanceof Event) ? e.message : "Couldn't load a picture from that link.");
        }
        setBusy(false);
    };

    return (
        <div className="vc-rice-folder">
            <button className="vc-rice-folder-row" aria-expanded={open} aria-controls={editId} onClick={onToggle}>
                <Preview look={look} api={api} guildIds={guildIds} />
                <span className="vc-rice-folder-name">{name}</span>
                <span className="vc-rice-folder-look">{describe(look)}</span>
                <span className="vc-rice-folder-arrow" aria-hidden>{open ? "▾" : "▸"}</span>
            </button>
            {open && (
                <div className="vc-rice-edit" id={editId}>
                    <span>ascii</span>
                    <div className="vc-rice-chips">
                        {api.presets.map(p => (
                            <button key={p.ascii} className="vc-rice-chip" title={p.name} aria-label={`${p.ascii}, ${p.name}`}
                                aria-pressed={look?.kind === "ascii" && look.text === p.ascii}
                                onClick={() => api.setLook(id, { kind: "ascii", text: p.ascii })}>
                                {p.ascii}
                            </button>
                        ))}
                    </div>

                    <span>icon</span>
                    <div className="vc-rice-chips">
                        {api.presets.map(p => (
                            <button key={p.icon} className="vc-rice-chip" title={p.name} aria-label={`${p.name} icon`}
                                aria-pressed={look?.kind === "icon" && look.icon === p.icon}
                                onClick={() => api.setLook(id, { kind: "icon", icon: p.icon })}>
                                <span className="icon" style={{ mask: `${api.iconUrl(p.icon)} center / contain no-repeat` }} />
                            </button>
                        ))}
                    </div>

                    <span>text</span>
                    <div className="vc-rice-inline">
                        <Prompt label="Your own text" value={text} onChange={setText} maxLength={5} placeholder="up to 5 characters, like >_ or ;-;" onEnter={setText_} />
                        <button className="vc-rice-btn" disabled={!text.trim()} onClick={setText_}>set</button>
                    </div>

                    <span>picture</span>
                    <div>
                        <div className="vc-rice-inline">
                            <Prompt label="Picture link" value={link} onChange={setLink} placeholder="https://i.pinimg.com/..." onEnter={setLink_} />
                            <button className="vc-rice-btn" disabled={!link.trim() || busy} onClick={setLink_}>{busy ? "loading…" : "set"}</button>
                            <button className="vc-rice-btn" onClick={() => api.pickFile(id)}>from file…</button>
                        </div>
                        {error
                            ? <p className="vc-rice-error" role="alert">{error}</p>
                            : <span className="vc-rice-desc">on pinterest: right-click the picture → copy image address.</span>}
                    </div>

                    {look && (
                        <>
                            <span />
                            <div><button className="vc-rice-btn danger" onClick={() => api.setLook(id, null)}>back to normal</button></div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function Folders() {
    const api = folderApi();
    const [, rerender] = useReducer((x: number) => x + 1, 0);
    const [open, setOpen] = useState<string | null>(null);
    useEffect(() => api?.subscribe(rerender), [api]);

    if (!api) return <p className="vc-rice-lead">turn on the FolderPictures plugin (then restart discord) to give folders a look.</p>;
    const folders = SortedGuildStore.getGuildFolders().filter(f => f.folderId != null);
    if (!folders.length) return <p className="vc-rice-lead">no server folders yet. drag one server onto another to make one.</p>;

    const looks = api.getLooks();
    return (
        <div>
            {folders.map(f => {
                const id = String(f.folderId);
                return (
                    <FolderRow key={id} id={id} name={api.folderLabel(f)} guildIds={f.guildIds} look={looks[id]} api={api}
                        open={open === id} onToggle={() => setOpen(open === id ? null : id)} />
                );
            })}
        </div>
    );
}

/* ---------------- the other tabs ---------------- */

function Look() {
    return (
        <>
            <Choice k="font" label="font" desc="iosevka is the terminal font the theme is drawn for." options={[
                ["iosevka", "iosevka"], ["discord", "discord's own"]
            ]} />
            <Range k="corners" label="corners" values={[0, 1, 2, 3, 4, 6, 8, 10, 12]} show={v => `${v}px`} desc="avatars and pills stay round." />
            <Heading>floating windows</Heading>
            <Check k="glassMenus" label="frosted glass" desc="menus and pickers are see-through with a blur. off makes them solid." />
            <Check k="monoWindowControls" label="grey window dots" desc="instead of red / yellow / green. they light up on hover." />
        </>
    );
}

const DIM = Array.from({ length: 21 }, (_, i) => i / 20);

function Wallpaper() {
    const { wallpaper } = settings.use(["wallpaper"]);
    return (
        <>
            <Field label="image" desc="a link to any picture: imgur, i.pinimg.com, github.io, raw.githubusercontent.com. empty = the misty forest.">
                <Prompt label="Wallpaper link" value={wallpaper} onChange={v => set("wallpaper", v)} placeholder="https://i.imgur.com/....jpg" />
            </Field>
            <Range k="wallpaperDim" label="darken" values={DIM} show={v => `${Math.round(v * 100)}%`} desc="raise it if text gets hard to read." />
            <Check k="grain" label="film grain" desc="a little noise over the wallpaper." />
            <Heading>ascii</Heading>
            <Choice k="asciiWallpaper" label="redraw as" desc="draws the wallpaper out of characters." options={[
                ["off", "off"], ["ramp", ".:-=+*#%@"], ["digits", "0-9"], ["binary", "01"]
            ]} />
            <Range k="asciiSize" label="character size" values={[6, 8, 10, 12, 14, 16]} show={v => `${v}px`} />
        </>
    );
}

function Hide() {
    return (
        <>
            <Heading>channel header</Heading>
            <Check k="hideInbox" label="inbox button" desc="the discord-rice button takes its place." />
            <Check k="hideNotificationButton" label="notification bell" desc="right-click a channel for the same settings." />
            <Check k="hideVideoCallButton" label="video call button" desc="in DMs. voice call stays; turn your camera on once in the call." />
            <Heading>chat bar</Heading>
            <Check k="hideGiftButton" label="gift button" />
            <Check k="hideAppsButton" label="apps button" desc="the apps / activities launcher." />
            <Check k="hideStickerButton" label="sticker button" />
            <Heading>lists</Heading>
            <Check k="hideNameplates" label="nameplates" desc="picture strips behind names in the member list, DM list and user panel." />
            <Check k="hideQuests" label="quests" desc="the card above your user panel, and quest embeds in chat." />
            <Check k="hideStoreTabs" label="nitro, shop, quests tabs" desc="the rows at the top of the DM list." />
        </>
    );
}

function Servers() {
    return (
        <>
            <Check k="plainFolders" label="plain folders" desc="a closed folder shows a folder icon instead of a 2×2 grid. a folder look takes its place." />
            <Choice k="monoServerIcons" label="b/w icons" desc="server pictures and folders in black and white." options={[
                ["on", "on"], ["hover", "colour on hover"], ["off", "off"]
            ]} />
            <Check k="archLogo" label="arch logo" desc="on the home button, instead of discord's logo." />
        </>
    );
}

const TABS = [
    { id: "about", lead: "what's running, and a few tips.", Pane: About },
    { id: "look", lead: "font, corners and floating windows. changes show straight away.", Pane: Look },
    { id: "wallpaper", lead: "the picture behind everything.", Pane: Wallpaper },
    { id: "hide", lead: "[x] = hidden. the bell, video call, gift and sticker switches need discord in english.", Pane: Hide },
    { id: "servers", lead: "the server list on the left.", Pane: Servers },
    { id: "folders", lead: "give a server folder a look: ascii, an icon, your own text or a picture.", Pane: Folders }
];

/* ---------------- the window ---------------- */

function ResetButton() {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        if (!armed) return;
        const t = setTimeout(() => setArmed(false), 3000);
        return () => clearTimeout(t);
    }, [armed]);

    return (
        <button
            className={"vc-rice-reset" + (armed ? " armed" : "")}
            onClick={() => {
                if (!armed) return setArmed(true);
                resetAll();
                setArmed(false);
            }}
        >
            {armed ? "↺ sure? click again" : "↺ reset defaults"}
        </button>
    );
}

function RiceWindow({ onClose, inline }: { onClose?(): void; inline?: boolean; }) {
    const [tab, setTab] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const { on: themeOn } = useThemeOn();
    const pluginsOn = PLUGINS.filter(([n]) => isPluginEnabled(n)).length;
    const current = TABS[tab];

    useEffect(() => {
        if (!inline) ref.current?.focus();
    }, []);

    const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("input, textarea")) return;
        if (e.key === "Escape" && onClose) {
            e.stopPropagation();
            onClose();
            return;
        }
        // up / down on the tab list moves between tabs
        if (target.getAttribute("role") === "tab" && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            const next = (tab + (e.key === "ArrowDown" ? 1 : -1) + TABS.length) % TABS.length;
            setTab(next);
            ref.current?.querySelector<HTMLElement>(`#vc-rice-tab-${TABS[next].id}`)?.focus();
            return;
        }
        const n = Number(e.key);
        if (n >= 1 && n <= TABS.length && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            setTab(n - 1);
        }
    };

    return (
        <div
            ref={ref}
            className={"vc-rice-win" + (inline ? " inline" : "")}
            role={inline ? "region" : "dialog"}
            aria-modal={inline ? undefined : true}
            aria-label="discord-rice settings"
            tabIndex={-1}
            onKeyDown={onKeyDown}
        >
            <div className="vc-rice-bar">
                <b>discord-rice</b>
                <span className="vc-rice-path">~/.config/discord-rice/{current.id}.conf</span>
                {onClose && <button className="vc-rice-close" aria-label="Close" onClick={onClose}>×</button>}
            </div>

            <div className="vc-rice-body">
                <div className="vc-rice-side" role="tablist" aria-orientation="vertical" aria-label="Sections">
                    {TABS.map((t, i) => (
                        <button
                            key={t.id}
                            id={`vc-rice-tab-${t.id}`}
                            role="tab"
                            aria-selected={i === tab}
                            aria-controls="vc-rice-panel"
                            tabIndex={i === tab ? 0 : -1}
                            className="vc-rice-tab"
                            onClick={() => setTab(i)}
                        >
                            <i aria-hidden>{i + 1}</i>{t.id}
                        </button>
                    ))}
                    <ResetButton />
                </div>

                <div key={current.id} id="vc-rice-panel" className="vc-rice-pane" role="tabpanel" aria-labelledby={`vc-rice-tab-${current.id}`}>
                    <h2 className="vc-rice-title">{current.id}</h2>
                    <p className="vc-rice-lead">{current.lead}</p>
                    <ErrorBoundary>
                        <current.Pane />
                    </ErrorBoundary>
                </div>
            </div>

            <div className="vc-rice-status">
                <span className="vc-rice-mode">RICE</span>
                <span>theme {themeOn ? "on" : "off"}</span>
                <span>plugins {pluginsOn}/{PLUGINS.length}</span>
                <span className="vc-rice-keys">
                    <kbd>1-{TABS.length}</kbd> section · <kbd>tab</kbd> move · <kbd>space</kbd> toggle · <kbd>←→</kbd> slide
                    {onClose && <> · <kbd>esc</kbd> close</>}
                </span>
            </div>
        </div>
    );
}

export function openRicePopup() {
    openModal(props => (
        <div className="vc-rice-layer">
            <ErrorBoundary>
                <RiceWindow onClose={props.onClose} />
            </ErrorBoundary>
        </div>
    ));
}

// the discord-rice page in Discord's settings
export function RicePage() {
    return (
        <SettingsTab>
            <RiceWindow inline />
        </SettingsTab>
    );
}

// the plugin's own settings popup (Vencord → Plugins → DiscordRice): just a way in
export function PluginSettings() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Paragraph>Everything for discord-rice is in its own window.</Paragraph>
            <Button onClick={openRicePopup}>Open discord-rice</Button>
        </div>
    );
}
