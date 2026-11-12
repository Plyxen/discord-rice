/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Names the shared plugin code expects to simply be there. The build puts these in place of every
// loose "React" and "VencordNative" in the bundle.

declare const BdApi: any;

export const THEME_FILE = "discord-rice.theme.css";

/** JSX in the shared files compiles to React.createElement */
export const React = BdApi.React;

/** the two things the shared code asks Vencord's native side for */
export const VencordNative = {
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
    csp: undefined
};
