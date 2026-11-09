/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * DiscordRice, a Vencord user plugin that goes with the discord-rice theme.
 *
 * - A button in the channel header (where the inbox button was) opens the discord-rice window: a small
 *   terminal-style settings tool with a neofetch summary, tips, folder looks and switches for every theme
 *   option, so nobody has to edit the CSS file. The same window is the discord-rice page in Discord's
 *   settings, and it opens once on first start. (ui.tsx, style.css)
 * - The switches set the theme's CSS variables on <body> from a small style sheet. That beats the
 *   defaults in the theme file, and turning this plugin off brings the file's own values back. (store.ts)
 * - ASCII wallpaper: redraws the wallpaper as characters (a brightness ramp, digits or 0s and 1s) on a
 *   canvas and uses that picture instead. (store.ts)
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { PaintbrushIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import type { ReactNode } from "react";

import { applyStyle, settings, teardown } from "./store";
import managedStyle from "./style.css?managed";
import { openRicePopup, PluginSettings, RicePage } from "./ui";

const ENTRY_KEY = "vencord_discord_rice";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_BOTTOM,", 'position:"bottom"');

// a steaming bowl of rice, filled like Discord's own header icons
function RiceIcon() {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20}>
            <path fill="currentColor" d="M2 12.5h20a10 8 0 0 1-20 0zM8 19.5h8V21a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1zM5 11a7 4 0 0 1 14 0z" />
            <path fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" d="M9.5 1.8c-.9.9.9 1.8 0 2.7M14.5 1.8c-.9.9.9 1.8 0 2.7" />
        </svg>
    );
}

function RiceButton() {
    return (
        <HeaderBarIcon
            className="vc-discord-rice-btn"
            onClick={openRicePopup}
            tooltip="discord-rice"
            icon={RiceIcon}
        />
    );
}

export default definePlugin({
    name: "DiscordRice",
    description: "Settings and info for the discord-rice theme in one terminal-style window, behind a button in the channel header: hide the inbox, nameplates and quests, folder looks, font, corners, wallpaper, ASCII wallpaper and more, without editing CSS.",
    authors: [{ name: "Pota", id: 0n }],
    enabledByDefault: true,
    settings,
    managedStyle,

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

    settingsAboutComponent: PluginSettings,

    toolboxActions: {
        "discord-rice settings": openRicePopup
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
        teardown();
        removeFromArray(SettingsPlugin.customEntries, e => e.key === ENTRY_KEY);
    }
});
