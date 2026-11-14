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
        // "is the theme file in the themes folder, and which version does it say it is?" Read from the
        // file itself: BetterDiscord's own list is a moment behind right after an update.
        async getThemesList() {
            try {
                if (!BdApi.Themes.get(THEME_FILE)) return [];
                const file = require("path").join(BdApi.Themes.folder, THEME_FILE);
                const head = String(require("fs").readFileSync(file, "utf8")).slice(0, 2000);
                return [{ fileName: THEME_FILE, version: /^\s*\*\s*@version\s+(\S+)/m.exec(head)?.[1] }];
            } catch {
                return [];
            }
        }
    },
    // BetterDiscord takes Discord's content rules away, so any picture link may load
    csp: undefined
};
