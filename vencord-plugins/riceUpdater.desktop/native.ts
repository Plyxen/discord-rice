/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR, THEMES_DIR } from "@main/utils/constants";
import type { IpcMainInvokeEvent } from "electron";
import { existsSync } from "fs";
import { join } from "path";

import { markBuilt, sync } from "./sync";

// This runs in Discord's main process, loaded from Vencord's dist folder (__dirname). In a source build
// that folder sits inside the Vencord checkout, next to src and scripts. The normal Vencord install has
// no src folder (and no user plugins), so there the plugins are left out and only the theme is updated.
const VENCORD_DIR = join(__dirname, "..");
const STATE_FILE = join(DATA_DIR, "discord-rice-updater.json");

function pluginsDir() {
    const dir = join(VENCORD_DIR, "src", "userplugins");
    return existsSync(dir) && existsSync(join(VENCORD_DIR, "scripts", "build", "build.mjs")) ? dir : null;
}

export function check(_: IpcMainInvokeEvent, apply: boolean, force: boolean) {
    return sync({
        themesDir: THEMES_DIR,
        pluginsDir: pluginsDir(),
        stateFile: STATE_FILE,
        apply: apply === true,
        force: force === true
    });
}

export function built(_: IpcMainInvokeEvent) {
    return markBuilt(STATE_FILE);
}
