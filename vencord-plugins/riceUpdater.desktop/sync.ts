/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * The part of RiceUpdater that does the work. It runs in Discord's main process and uses nothing from
 * Vencord, only Node, so it can be run and tested on its own.
 *
 * It looks after two things, each as a whole:
 *   - the theme file, if there is one in the themes folder (not if you use the online link)
 *   - the plugin folders in src/userplugins that come from this repo's vencord-plugins folder
 *
 * It only ever talks to github.com/Plyxen/discord-rice: one small question to GitHub's API ("what is the
 * newest commit?", free when nothing changed), a file listing when there is a new one, and the changed
 * files themselves, fetched by that commit's id and checked against the listing before anything is
 * written.
 *
 * The rule for writing: a thing is updated when the repo changed it and nobody changed it on this PC
 * since the updater last looked. Files changed here (you edit the theme by hand, or work on a plugin) are
 * left alone and reported instead, unless asked to replace them.
 */

import { createHash } from "crypto";
import { existsSync } from "fs";
import { copyFile, mkdir, readdir, readFile, rm, rmdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

const REPO = "Plyxen/discord-rice";
const BRANCH = "main";
const THEME_FILE = "discord-rice.theme.css";
const PLUGIN_ROOT = "vencord-plugins";
const HEADERS = { "User-Agent": "discord-rice-updater", "X-GitHub-Api-Version": "2022-11-28" };
const TEXT_FILE = /\.(tsx?|jsx?|css|json|md|txt|svg)$/i;
const SAFE_PART = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** file path (with forward slashes) -> the id git gives its contents */
type Shas = Record<string, string>;

/** what one thing looked like the last time the updater dealt with it */
interface Unit {
    /** the repo's version of it then */
    remote: string;
    /** the files on this PC then */
    local: Shas;
}

interface Listing {
    commit: string;
    theme?: string;
    pluginsId?: string;
    plugins: Shas;
}

interface State {
    etag?: string;
    listing?: Listing;
    theme?: Unit;
    plugins?: Unit;
    /** plugin files were written, and Vencord hasn't been rebuilt with them yet */
    pendingBuild?: boolean;
    /** the commit for which "files were changed on this PC" was already reported */
    told?: string;
}

export type Outcome =
    /** not installed here (no theme file, or Vencord isn't a source build) */
    | "absent"
    | "current"
    | "updated"
    /** there is an update, and it wasn't installed because only a look was asked for */
    | "available"
    /** there is an update, but files were changed on this PC */
    | "changed-here"
    /** differs from the repo, but the repo hasn't changed it since the updater first saw it */
    | "differs";

export interface SyncResult {
    commit: string;
    theme: Outcome;
    plugins: Outcome;
    /** plugin folders that were, or would be, updated */
    pluginNames: string[];
    /** files changed on this PC that stopped an update */
    changedHere: string[];
    /** true the first time changedHere is reported for this commit */
    firstReport: boolean;
    needsBuild: boolean;
}

export interface SyncOptions {
    themesDir: string;
    /** src/userplugins of a Vencord source build, or null */
    pluginsDir: string | null;
    stateFile: string;
    /** false: only look */
    apply: boolean;
    /** replace files changed on this PC too (the theme is kept as .bak) */
    force: boolean;
}

function gitSha(data: Buffer) {
    return createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
}

// a file checked out or saved on Windows may have CRLF line ends; the repo has LF
async function localSha(path: string) {
    let data = await readFile(path);
    if (TEXT_FILE.test(path) && data.includes(13)) data = Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
    return gitSha(data);
}

async function readState(file: string): Promise<State> {
    try {
        const state = JSON.parse(await readFile(file, "utf8"));
        return state && typeof state === "object" ? state : {};
    } catch {
        return {};
    }
}

async function writeState(file: string, state: State) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(state, null, 1));
}

async function github(url: string, headers: Record<string, string> = {}) {
    let res: Response;
    try {
        res = await fetch(url, { headers: { ...HEADERS, ...headers } });
    } catch (e: any) {
        throw new Error(`couldn't reach GitHub (${e?.cause?.code ?? e?.message ?? e})`);
    }
    if (res.status === 403 || res.status === 429) throw new Error("GitHub is limiting requests from this network for now");
    if (!res.ok && res.status !== 304) throw new Error(`GitHub answered ${res.status} for ${url}`);
    return res;
}

/** What the repo has now. Asks GitHub only for the newest commit when nothing changed since last time. */
async function fetchListing(state: State, useCache: boolean): Promise<Listing> {
    const cached = useCache && state.etag && state.listing;
    const head = await github(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
        Accept: "application/vnd.github.sha",
        ...(cached ? { "If-None-Match": state.etag! } : {})
    });
    if (head.status === 304 && state.listing) return state.listing;

    const commit = (await head.text()).trim();
    if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("GitHub gave no commit id");
    if (cached && state.listing!.commit === commit) return state.listing!;

    const res = await github(`https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`, { Accept: "application/vnd.github+json" });
    const body = await res.json() as { truncated?: boolean; tree?: { path: string; type: string; sha: string; }[]; };
    if (!Array.isArray(body.tree) || body.truncated) throw new Error("GitHub gave no complete file list");

    const listing: Listing = { commit, plugins: {} };
    for (const { path, type, sha } of body.tree) {
        if (typeof path !== "string" || !/^[0-9a-f]{40}$/.test(sha)) continue;
        if (type === "tree" && path === PLUGIN_ROOT) listing.pluginsId = sha;
        if (type !== "blob") continue;
        if (path === THEME_FILE) listing.theme = sha;
        if (path.startsWith(PLUGIN_ROOT + "/")) {
            const rest = path.slice(PLUGIN_ROOT.length + 1);
            // folder/file at least, and nothing that could point outside the plugins folder
            const parts = rest.split("/");
            if (parts.length >= 2 && parts.every(p => SAFE_PART.test(p))) listing.plugins[rest] = sha;
        }
    }
    state.etag = head.headers.get("etag") ?? undefined;
    state.listing = listing;
    return listing;
}

async function download(commit: string, path: string, sha: string) {
    const res = await github(`https://raw.githubusercontent.com/${REPO}/${commit}/${path}`);
    const data = Buffer.from(await res.arrayBuffer());
    if (gitSha(data) !== sha) throw new Error(`${path} didn't arrive whole`);
    return data;
}

interface Plan {
    outcome: Outcome;
    write: string[];
    remove: string[];
    changedHere: string[];
    unit?: Unit;
}

/**
 * Decides what to do with one thing.
 * @param remote what the repo has
 * @param local what is on this PC, for every path in remote or in unit.local that exists
 */
function plan(remoteId: string, remote: Shas, local: Shas, unit: Unit | undefined, apply: boolean, force: boolean): Plan {
    const write = Object.keys(remote).filter(p => local[p] !== remote[p]);
    // files the updater put here once, which the repo no longer has
    const remove = Object.keys(unit?.local ?? {}).filter(p => !(p in remote) && p in local);
    const result = (outcome: Outcome, extra: Partial<Plan> = {}): Plan => ({ outcome, write: [], remove: [], changedHere: [], ...extra });

    if (!write.length && !remove.length) return result("current", { unit: { remote: remoteId, local: { ...remote } } });

    if (!force) {
        // first look at it: remember how it is. It gets updated from the repo's next change on
        if (!unit) return result("differs", { unit: { remote: remoteId, local } });
        // the repo hasn't changed it since, so whatever differs was done here on purpose
        if (unit.remote === remoteId) return result("differs");
        const changedHere = Object.keys(local).filter(p => local[p] !== unit.local[p]);
        if (changedHere.length) return result("changed-here", { changedHere });
    }
    if (!apply) return result("available", { write, remove });
    return result("updated", { write, remove, unit: { remote: remoteId, local: { ...remote } } });
}

async function existingShas(dir: string, paths: Iterable<string>) {
    const out: Shas = {};
    for (const p of new Set(paths)) {
        const file = join(dir, ...p.split("/"));
        if (existsSync(file)) out[p] = await localSha(file);
    }
    return out;
}

export async function sync(options: SyncOptions): Promise<SyncResult> {
    const { themesDir, pluginsDir, stateFile, apply, force } = options;
    const state = await readState(stateFile);
    const listing = await fetchListing(state, !force);
    const { commit } = listing;

    const result: SyncResult = {
        commit: commit.slice(0, 7),
        theme: "absent",
        plugins: "absent",
        pluginNames: [],
        changedHere: [],
        firstReport: false,
        needsBuild: false
    };

    // ---- the theme file
    const themePath = join(themesDir, THEME_FILE);
    if (listing.theme && existsSync(themePath)) {
        const remote = { [THEME_FILE]: listing.theme };
        const step = plan(listing.theme, remote, await existingShas(themesDir, [THEME_FILE]), state.theme, apply, force);
        if (step.outcome === "updated") {
            const data = await download(commit, THEME_FILE, listing.theme);
            // replacing a theme that was edited here: keep the edited one next to it
            if (state.theme?.local[THEME_FILE] !== await localSha(themePath)) await copyFile(themePath, themePath + ".bak");
            await writeFile(themePath, data);
        }
        if (step.unit) state.theme = step.unit;
        result.theme = step.outcome;
        result.changedHere.push(...step.changedHere);
    }

    // ---- the plugins
    if (pluginsDir && listing.pluginsId && Object.keys(listing.plugins).length) {
        const remote = listing.plugins;
        const local = await existingShas(pluginsDir, [...Object.keys(remote), ...Object.keys(state.plugins?.local ?? {})]);
        const step = plan(listing.pluginsId, remote, local, state.plugins, apply, force);
        if (step.outcome === "updated") {
            // everything is fetched and checked before the first file is touched
            const files = await Promise.all(step.write.map(async p => [p, await download(commit, `${PLUGIN_ROOT}/${p}`, remote[p])] as const));
            for (const [p, data] of files) {
                const file = join(pluginsDir, ...p.split("/"));
                await mkdir(dirname(file), { recursive: true });
                await writeFile(file, data);
            }
            for (const p of step.remove) {
                const file = join(pluginsDir, ...p.split("/"));
                await rm(file, { force: true });
                // a plugin the repo dropped leaves an empty folder, which Vencord's build would trip over
                const dir = dirname(file);
                if (dir !== pluginsDir && !(await readdir(dir)).length) await rmdir(dir);
            }
            state.pendingBuild = true;
        }
        if (step.unit) state.plugins = step.unit;
        result.plugins = step.outcome;
        result.pluginNames = [...new Set([...step.write, ...step.remove].map(p => p.split("/")[0]))];
        result.changedHere.push(...step.changedHere.map(p => `${PLUGIN_ROOT}/${p}`));
    }

    if (result.changedHere.length) {
        result.firstReport = state.told !== commit;
        state.told = commit;
    }
    result.needsBuild = !!state.pendingBuild && !!pluginsDir;
    await writeState(stateFile, state);
    return result;
}

/** Vencord was rebuilt with the new plugin files. */
export async function markBuilt(stateFile: string) {
    const state = await readState(stateFile);
    if (!state.pendingBuild) return;
    delete state.pendingBuild;
    await writeState(stateFile, state);
}
