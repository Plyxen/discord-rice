/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * FolderPictures for BetterDiscord. All of it is the Vencord plugin's code
 * (vencord-plugins/folderPictures); this file only starts and stops it.
 *
 * One difference: Vencord rewrites Discord's code to tag each folder with its id. That can't be done
 * here, so the looks find a folder by an id Discord puts on it itself, which the Vencord plugin already
 * keeps as its fallback.
 */

import plugin, { api, FolderList } from "../../vencord-plugins/folderPictures/index";
import shimCss from "./shims/shims.css";
import { closeAllModals } from "./shims/ui";

declare const BdApi: any;

const STYLE_ID = "FolderPictures";

export default class FolderPictures {
    /** what the discord-rice settings window uses to list and edit folder looks */
    api = api;

    start() {
        BdApi.DOM.addStyle(STYLE_ID, shimCss);
        plugin.start().catch((e: unknown) => console.error("[FolderPictures]", e));
    }

    stop() {
        closeAllModals();
        plugin.stop();
        BdApi.DOM.removeStyle(STYLE_ID);
    }

    getSettingsPanel() {
        return <FolderList />;
    }
}
