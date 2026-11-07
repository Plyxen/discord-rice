/*
 * DiscordRice, a Vencord user plugin that goes with the discord-rice theme.
 *
 * - A "discord-rice" page in Discord's settings (in the Vencord section), and the same thing as a popup
 *   that shows once on first start. It explains what the theme does and has switches for its options,
 *   so nobody has to edit the CSS file.
 * - The switches set the theme's CSS variables on <body> from a small style sheet. That beats the
 *   defaults in the theme file, and turning this plugin off brings the file's own values back.
 * - The popup can be opened again from the Vencord toolbox, or from this plugin's entry in the
 *   Plugins list.
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings, Settings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { PaintbrushIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings/tabs/BaseTab";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Modal, openModal, Select, Slider, TextInput, useState } from "@webpack/common";
import type { ReactNode } from "react";

const THEME_FILE = "discord-rice.theme.css";
const ENTRY_KEY = "vencord_discord_rice";

const settings = definePluginSettings({
    hideNameplates: { type: OptionType.BOOLEAN, description: "Hide nameplates", default: true, hidden: true },
    hideQuests: { type: OptionType.BOOLEAN, description: "Hide quests", default: true, hidden: true },
    hideStoreTabs: { type: OptionType.BOOLEAN, description: "Hide Nitro / Shop / Quests tabs", default: true, hidden: true },
    hideGiftButton: { type: OptionType.BOOLEAN, description: "Hide the gift button", default: true, hidden: true },
    hideAppsButton: { type: OptionType.BOOLEAN, description: "Hide the apps button", default: true, hidden: true },
    hideStickerButton: { type: OptionType.BOOLEAN, description: "Hide the sticker button", default: false, hidden: true },
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
    seenWelcome: { type: OptionType.BOOLEAN, description: "Welcome popup shown", default: false, hidden: true }
});

type Store = typeof settings.store;

const DEFAULTS: Partial<Store> = {
    hideNameplates: true, hideQuests: true, hideStoreTabs: true, hideGiftButton: true, hideAppsButton: true,
    hideStickerButton: false, plainFolders: true, monoServerIcons: "on", glassMenus: true, archLogo: true,
    monoWindowControls: true, grain: true, font: "iosevka", corners: 3, gap: 0, wallpaper: "", wallpaperDim: 0.5
};

const cssString = (s: string) => `"${s.replace(/["\\]/g, "\\$&")}"`;
const onOff = (b: boolean) => b ? "on" : "off";

const FONTS: Record<string, [string, string]> = {
    iosevka: ["'Iosevka'", "'Iosevka'"],
    figtree: ["'figtree'", "'Iosevka'"],
    discord: ["''", "''"]
};

let styleEl: HTMLStyleElement | null = null;

function applyStyle() {
    const s = settings.store;
    const [font, codeFont] = FONTS[s.font] ?? FONTS.iosevka;
    const vars: Record<string, string> = {
        "--hide-nameplates": onOff(s.hideNameplates),
        "--hide-quests": onOff(s.hideQuests),
        "--hide-store-tabs": onOff(s.hideStoreTabs),
        "--hide-gift-button": onOff(s.hideGiftButton),
        "--hide-apps-button": onOff(s.hideAppsButton),
        "--hide-sticker-button": onOff(s.hideStickerButton),
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
    if (wallpaper) vars["--wallpaper"] = `url(${cssString(wallpaper)})`;

    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "vc-discord-rice";
    }
    // "html body" outranks the theme's plain "body" block, wherever the two style sheets end up
    styleEl.textContent = `html body {\n${Object.entries(vars).map(([k, v]) => `    ${k}: ${v};`).join("\n")}\n}`;
    if (!styleEl.isConnected) document.head.appendChild(styleEl);
}

function set<K extends keyof Store>(key: K, value: Store[K]) {
    settings.store[key] = value;
    applyStyle();
}

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
    const { enabledThemes } = useSettings(["enabledThemes"]);
    const themeOn = enabledThemes.includes(THEME_FILE);
    const plugin = (name: string) => isPluginEnabled(name) ? "on" : "off (turn it on in Plugins, then restart Discord)";

    return (
        <>
            <FormSwitch
                title="Theme"
                description={`${THEME_FILE} in Vencord's themes folder. Everything below needs it on.`}
                value={themeOn}
                onChange={on => {
                    const others = enabledThemes.filter(t => t !== THEME_FILE);
                    Settings.enabledThemes = on ? [...others, THEME_FILE] : others;
                }}
            />
            <Paragraph className={Margins.top8}>FolderPictures plugin: {plugin("FolderPictures")}</Paragraph>
            <Paragraph>CodeBlockButton plugin: {plugin("CodeBlockButton")}</Paragraph>
        </>
    );
}

function RicePanel() {
    // re-mount the sliders after a reset, since they only read their starting value
    const [resets, setResets] = useState(0);
    const { wallpaper } = settings.use(["wallpaper"]);

    return (
        <div>
            <Paragraph>
                discord-rice makes Discord look like a tiling-WM Linux rice: one wallpaper behind tiled panes split
                by thin lines, greyscale colours, Iosevka, frosted-glass menus, and terminal touches like a ❯ prompt
                and [timestamps]. Changes here apply straight away, no restart needed.
            </Paragraph>

            <Section title="Status">
                <ThemeStatus />
            </Section>

            <Section title="Tips">
                <Paragraph>• Right-click a server folder → Set folder picture… to give it its own picture.</Paragraph>
                <Paragraph>• Select text in the chat box, then the ``` button wraps it in a code block.</Paragraph>
                <Paragraph>• Drag the window by the empty space in the channel header, next to the channel name.</Paragraph>
                <Paragraph>• Open this again from the Vencord toolbox, or Settings → discord-rice.</Paragraph>
            </Section>

            <Section title="Hide">
                <Toggle k="hideNameplates" title="Nameplates" description="The picture strips behind names in the member list, DM list and user panel." />
                <Toggle k="hideQuests" title="Quests" description="The quest card above your user panel, and quest embeds in chat." />
                <Toggle k="hideStoreTabs" title="Nitro, Shop and Quests tabs" description="The rows at the top of the DM list." />
                <Toggle k="hideGiftButton" title="Gift button" description="In the chat bar." />
                <Toggle k="hideAppsButton" title="Apps button" description="The apps / activities launcher in the chat bar." />
                <Toggle k="hideStickerButton" title="Sticker button" description="In the chat bar." />
            </Section>

            <Section title="Server list">
                <Toggle k="plainFolders" title="Plain folders" description="A closed folder shows a folder icon instead of a 2×2 grid of its servers. A folder picture takes its place." />
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
                    A link to any image (imgur, github.io and raw.githubusercontent.com work). Leave it empty for the misty forest.
                </Paragraph>
                <TextInput value={wallpaper} placeholder="https://i.imgur.com/....jpg" onChange={(v: string) => set("wallpaper", v)} />
                <div className={Margins.top16}>
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
            size="md"
            title="discord-rice"
            subtitle="A Linux-rice look for Discord"
            actions={[{ text: "Done", variant: "primary", onClick: props.onClose }]}
        >
            <RicePanel />
        </Modal>
    ));
}

export default definePlugin({
    name: "DiscordRice",
    description: "Options and info for the discord-rice theme: hide nameplates and quests, plain folders, font, corners, wallpaper and more, without editing CSS.",
    authors: [{ name: "Pota", id: 0n }],
    enabledByDefault: true,
    settings,

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
        styleEl?.remove();
        removeFromArray(SettingsPlugin.customEntries, e => e.key === ENTRY_KEY);
    }
});
