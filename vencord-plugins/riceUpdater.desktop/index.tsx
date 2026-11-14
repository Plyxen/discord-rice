/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * RiceUpdater, a Vencord user plugin that keeps discord-rice up to date from its GitHub repo.
 *
 * - Shortly after Discord starts, and every six hours after that, it asks GitHub whether the repo has a
 *   new commit. (sync.ts, which runs in Discord's main process through native.ts)
 * - A new theme is written over the theme file in the themes folder, and Vencord reloads it on the spot.
 *   If you use the online link instead of a file, Vencord fetches it itself and this plugin leaves it be.
 * - New plugin files are written into src/userplugins, Vencord is rebuilt with its own updater, and a
 *   notification offers to restart Discord, which is what loads them.
 * - Files that were changed on this PC are never replaced without asking.
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { relaunch } from "@utils/native";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { useEffect, useReducer } from "@webpack/common";

import type { SyncResult } from "./sync";

const Native = VencordNative.pluginHelpers.RiceUpdater as PluginNative<typeof import("./native")>;

const FIRST_CHECK = 30_000; // after Discord has finished starting
const EVERY = 6 * 60 * 60_000;

let startTimer: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let busy = false;
let restartNeeded = false;
let held = false; // the last check left files alone that aren't the same as GitHub's
let offered = ""; // the commit an update was already offered for, in "tell me" mode
let status = "Not checked yet.";
const watchers = new Set<() => void>();

function setStatus(text: string) {
    status = text;
    watchers.forEach(redraw => redraw());
}

const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// an error from the main process arrives as "Error invoking remote method '...': Error: what went wrong"
const reason = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']*': (Error: )?/, "");

function describe(r: SyncResult, built: boolean | null) {
    const parts: string[] = [];
    if (r.theme === "updated") parts.push("The theme was updated.");
    if (r.plugins === "updated" || built) parts.push(`The plugins were updated${r.pluginNames.length ? ` (${r.pluginNames.join(", ")})` : ""}.`);
    if (built === false) parts.push("Building Vencord with them failed; it is tried again the next time Discord starts.");
    else if (restartNeeded) parts.push("Restart Discord to load them.");
    if (r.theme === "available" || r.plugins === "available") parts.push("There is an update.");
    if (r.changedHere.length) parts.push(`There is an update, but these files were changed on this PC and are left alone: ${r.changedHere.join(", ")}.`);
    if (r.theme === "differs" || r.plugins === "differs") parts.push("Your copy isn't the same as the one on GitHub. It updates with GitHub's next change, or now with \"Replace my changes\".");
    if (!parts.length) parts.push("Up to date.");
    return `${parts.join(" ")} Checked at ${clock()}, GitHub is at ${r.commit}.`;
}

/**
 * @param apply install what is found; false only looks
 * @param force also replace files that were changed on this PC
 * @param manual asked for with a button, so always say what happened
 */
async function run(apply: boolean, force = false, manual = false) {
    if (busy) return;
    // the main-process half only loads when Discord starts, not on a reload
    if (!Native) return setStatus("Restart Discord once to finish installing the updater.");
    busy = true;
    setStatus("Checking GitHub…");
    try {
        const r = await Native.check(apply, force);
        held = r.changedHere.length > 0 || r.theme === "differs" || r.plugins === "differs";

        // new plugin files are in place (from this check, or an earlier one whose build failed)
        let built: boolean | null = null;
        if (r.needsBuild && !IS_STANDALONE) {
            setStatus("Building Vencord with the new plugins…");
            const res = await VencordNative.updater.rebuild();
            built = res.ok && res.value;
            if (built) {
                await Native.built();
                restartNeeded = true;
            }
        }

        setStatus(describe(r, built));
        const { notify } = settings.store;

        if (built) {
            if (notify || manual) showNotification({
                title: "discord-rice updated",
                body: `${r.theme === "updated" ? "The theme and the plugins" : "The plugins"} were updated. Click to restart Discord and load them.`,
                permanent: true,
                onClick: relaunch
            });
        } else if (built === false) {
            showNotification({
                title: "discord-rice: update not finished",
                body: "The new plugin files are in place, but building Vencord failed. It is tried again the next time Discord starts.",
                permanent: true
            });
        } else if (r.theme === "updated" && (notify || manual)) {
            showNotification({ title: "discord-rice updated", body: "The theme was updated. It is already on." });
        }

        if ((r.theme === "available" || r.plugins === "available") && (manual || offered !== r.commit)) {
            offered = r.commit;
            showNotification({
                title: "discord-rice update available",
                body: `${[r.theme === "available" && "the theme", r.plugins === "available" && "the plugins"].filter(Boolean).join(" and ")}. Click to install it.`,
                permanent: true,
                onClick: () => run(true)
            });
        }

        if (r.changedHere.length && (r.firstReport || manual)) showNotification({
            title: "discord-rice: update left alone",
            body: `There is an update, but some files were changed on this PC (${r.changedHere.join(", ")}). To take it anyway, press "Replace my changes" in the RiceUpdater settings.`
        });
    } catch (e) {
        setStatus(`Couldn't check at ${clock()}: ${reason(e)}.`);
    } finally {
        busy = false;
        watchers.forEach(redraw => redraw());
    }
}

function automatic() {
    const { mode } = settings.store;
    if (mode !== "off") run(mode === "auto");
}

function Status() {
    const [, redraw] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
        watchers.add(redraw);
        return () => void watchers.delete(redraw);
    }, []);

    return (
        <div>
            <Paragraph>{status}</Paragraph>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <Button size="small" disabled={busy} onClick={() => run(true, false, true)}>Check now</Button>
                <Button size="small" variant="secondary" disabled={busy} onClick={() => run(true, true, true)}>Replace my changes</Button>
                {restartNeeded && <Button size="small" variant="positive" onClick={relaunch}>Restart Discord</Button>}
            </div>
        </div>
    );
}

const settings = definePluginSettings({
    mode: {
        type: OptionType.SELECT,
        description: "When the theme or the plugins change on GitHub",
        options: [
            { label: "Install it by itself", value: "auto", default: true },
            { label: "Tell me, and install when I click", value: "ask" },
            { label: "Don't check", value: "off" }
        ]
    },
    notify: {
        type: OptionType.BOOLEAN,
        description: "Show a notification after an update",
        default: true
    },
    status: {
        type: OptionType.COMPONENT,
        component: Status
    }
});

export default definePlugin({
    name: "RiceUpdater",
    description: "Keeps the discord-rice theme file and plugins up to date from github.com/Plyxen/discord-rice. Files you changed yourself are left alone.",
    authors: [{ name: "Pota", id: 0n }],
    enabledByDefault: true,
    settings,

    // for the discord-rice window, which has its own "check for updates" on the about tab
    api: {
        status: () => status,
        busy: () => busy,
        held: () => held,
        restartNeeded: () => restartNeeded,
        check: (force = false) => void run(true, force, true),
        restart: relaunch,
        subscribe(listener: () => void) {
            watchers.add(listener);
            return () => void watchers.delete(listener);
        }
    },

    start() {
        startTimer = setTimeout(automatic, FIRST_CHECK);
        interval = setInterval(automatic, EVERY);
    },

    stop() {
        clearTimeout(startTimer);
        clearInterval(interval);
    }
});
