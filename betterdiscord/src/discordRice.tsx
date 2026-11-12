/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * DiscordRice for BetterDiscord. The settings window, the theme switches and the ASCII wallpaper are the
 * very same code as the Vencord plugin (vencord-plugins/discordRice: store.ts, ui.tsx, style.css); this
 * file is only what is different here:
 *
 * - Vencord rewrites Discord's own code to put the rice bowl button where the inbox button was.
 *   BetterDiscord can't do that, so the button is added to the page next to the inbox button, and the
 *   inbox button is hidden or shown from here.
 * - The window is also the plugin's settings (Settings > Plugins > DiscordRice > the cog).
 */

import { applyStyle, settings, teardown } from "../../vencord-plugins/discordRice/store";
import windowCss from "../../vencord-plugins/discordRice/style.css";
import { openRicePopup, RicePage } from "../../vencord-plugins/discordRice/ui";
import { onSettingsChange } from "./shims/settings";
import shimCss from "./shims/shims.css";
import { closeAllModals } from "./shims/ui";

declare const BdApi: any;

const STYLE_ID = "DiscordRice";
// a steaming bowl of rice, the same drawing as the Vencord button
const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">'
    + '<path fill="currentColor" d="M2 12.5h20a10 8 0 0 1-20 0zM8 19.5h8V21a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1zM5 11a7 4 0 0 1 14 0z"/>'
    + '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M9.5 1.8c-.9.9.9 1.8 0 2.7M14.5 1.8c-.9.9.9 1.8 0 2.7"/>'
    + "</svg>";

// The row of buttons at the right end of Discord's title bar (which the theme parks over the channel
// header). Found by the shape of its class name, since the letters after the underscore change.
function findButtonRow() {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[class*="trailing_"]'))) {
        if (/(^|\s)bar_/.test(el.parentElement?.className ?? "")) return el;
    }
    return null;
}

export default class DiscordRice {
    private holder: HTMLElement | null = null;
    private timer: ReturnType<typeof setInterval> | undefined;
    private welcome: ReturnType<typeof setTimeout> | undefined;
    private stopListening: (() => void) | undefined;

    start() {
        BdApi.DOM.addStyle(STYLE_ID, windowCss + "\n" + shimCss);
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
        button.addEventListener("keydown", e => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            openRicePopup();
        });
        this.holder.appendChild(button);

        // Discord rebuilds its title bar now and then, which drops the button; look every two seconds
        this.syncHeader();
        this.timer = setInterval(() => this.syncHeader(), 2000);
        this.stopListening = onSettingsChange(() => this.syncHeader());

        // say hello once
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
        return <RicePage />;
    }

    private syncHeader() {
        const row = findButtonRow();
        if (!row || !this.holder) return;
        if (this.holder.parentElement !== row) {
            // look like the buttons already there, whatever Discord calls their class this week
            const other = row.querySelector<HTMLElement>('[class*="clickable_"]:not(.vc-discord-rice-btn)');
            const clickable = other && Array.from(other.classList).find(c => c.startsWith("clickable_"));
            const button = this.holder.firstElementChild!;
            button.className = "vc-discord-rice-btn" + (clickable ? " " + clickable : "");
            row.appendChild(this.holder);
        }
        this.showInbox(row, !settings.store.hideInbox);
    }

    // The inbox button is the one piece of that row that is a box holding both a button and an empty,
    // hidden marker (which its popup hangs from). Help is a link, and the theme hides it itself.
    private showInbox(row: HTMLElement | null, show: boolean) {
        if (!row) return;
        for (const el of Array.from(row.children) as HTMLElement[]) {
            if (el === this.holder || el.tagName !== "DIV") continue;
            if (!el.querySelector(':scope > span[aria-hidden="true"]') || !el.querySelector('[class*="clickable_"]')) continue;
            el.style.display = show ? "" : "none";
        }
    }
}
