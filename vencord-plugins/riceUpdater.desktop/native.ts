/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR, THEMES_DIR } from "@main/utils/constants";
import type { IpcMainInvokeEvent } from "electron";
import { existsSync } from "fs";
import { stat } from "fs/promises";
import { join } from "path";

import { markBuildFailed, markBuilt, sync, SyncResult } from "./sync";

// This runs in Discord's main process, loaded from Vencord's dist folder (__dirname). In a source build
// that folder sits inside the Vencord checkout, next to src and scripts. A Flatpak Discord is only let
// into the dist folder itself, so there the source can't be reached: only the theme is updated, and the
// installer's note in the dist folder tells whether the plugins on GitHub are newer than the build.
const VENCORD_DIR = join(__dirname, "..");
const STATE_FILE = join(DATA_DIR, "discord-rice-updater.json");
const BUILT_FILE = join(__dirname, "renderer.js"); // every build of Vencord writes it
const NOTE_FILE = join(__dirname, "discord-rice-plugins.txt");
const STARTED = Date.now() - process.uptime() * 1000;

export interface CheckResult extends SyncResult {
    /** Discord runs in a Flatpak, which can't build Vencord and usually can't see its source */
    flatpak: boolean;
    /** Vencord was built after this Discord started, so a restart loads something newer */
    builtAfterStart: boolean;
}

function pluginsDir() {
    const dir = join(VENCORD_DIR, "src", "userplugins");
    return existsSync(dir) && existsSync(join(VENCORD_DIR, "scripts", "build", "build.mjs")) ? dir : null;
}

export async function check(_: IpcMainInvokeEvent, apply: boolean, force: boolean): Promise<CheckResult> {
    const result = await sync({
        themesDir: THEMES_DIR,
        pluginsDir: pluginsDir(),
        builtFile: BUILT_FILE,
        noteFile: NOTE_FILE,
        stateFile: STATE_FILE,
        apply: apply === true,
        force: force === true
    });
    const built = await stat(BUILT_FILE).then(s => s.mtimeMs, () => 0);
    return {
        ...result,
        flatpak: process.platform === "linux" && !!process.env.FLATPAK_ID,
        builtAfterStart: built > STARTED
    };
}

export function built(_: IpcMainInvokeEvent) {
    return markBuilt(STATE_FILE);
}

/** Says whether the failed build is news for the plugins that wait for it, so it is only announced once. */
export function buildFailed(_: IpcMainInvokeEvent) {
    return markBuildFailed(STATE_FILE);
}
