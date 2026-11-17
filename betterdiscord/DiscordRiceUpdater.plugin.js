/**
 * @name DiscordRiceUpdater
 * @author Pota
 * @description Keeps the discord-rice theme file and plugins up to date from github.com/Plyxen/discord-rice. A file you edited yourself is left alone.
 * @version 1.3.0
 * @source https://github.com/Plyxen/discord-rice
 * @website https://github.com/Plyxen/discord-rice
 */

/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * BetterDiscord only updates themes from its own store, so this small plugin does it for discord-rice.
 * Shortly after Discord starts, and every six hours after that, it asks GitHub whether the repo has a
 * new commit (free when nothing changed). If the theme changed, the new file is fetched by that commit's
 * id, checked against GitHub's file listing, and written over the one in the themes folder; BetterDiscord
 * reloads it on the spot. The discord-rice plugins in the plugins folder, this one included, are kept up
 * to date the same way.
 *
 * A file is replaced when the repo changed it and nobody changed it on this PC since the plugin last
 * looked. One you edited is left alone and you get a message instead; "Replace my changes" in the
 * plugin's settings takes the update anyway and keeps your file as .bak.
 *
 * The plugin's settings also say what happens when there is an update: it is installed by itself, or you
 * are told and it is installed when you click, or nothing is checked at all. BetterDiscord runs a plugin
 * file the moment it changes, so "tell me" is the way to look at an update before it runs.
 *
 * It only ever talks to github.com/Plyxen/discord-rice.
 */

const REPO = "Plyxen/discord-rice";
const BRANCH = "main";
const NAME = "DiscordRiceUpdater";
const HEADERS = { "User-Agent": "discord-rice-updater", "X-GitHub-Api-Version": "2022-11-28" };
const FIRST_CHECK = 30000;
const EVERY = 6 * 60 * 60000;
const MODES = [["auto", "Install it by itself"], ["ask", "Tell me, and install when I click"], ["off", "Don't check"]];

module.exports = class DiscordRiceUpdater {
    constructor() {
        this.busy = false;
        this.held = false; // the last check left files alone that aren't the same as GitHub's
        this.status = ""; // what the last check found, once there has been one
        this.watchers = new Set();

        // for the discord-rice window (the DiscordRice plugin), which has its own "check for updates"
        this.api = {
            status: () => this.line(),
            busy: () => this.busy,
            held: () => this.held,
            restartNeeded: () => false, // BetterDiscord reloads a plugin by itself when its file changes
            check: force => void this.run(!!force),
            restart: () => {},
            subscribe: listener => {
                this.watchers.add(listener);
                return () => void this.watchers.delete(listener);
            }
        };
    }

    /**
     * What the last check found. When an update replaces this plugin's own file, BetterDiscord starts a
     * new copy of it that has not checked anything yet: that one reads the line the old copy left.
     */
    line() {
        if (this.status) return this.status;
        const { last } = BdApi.Data.load(NAME, "state") || {};
        return last && Date.now() - last.at < 10 * 60000 ? last.text : "Not checked yet.";
    }

    say(text) {
        this.status = text;
        this.watchers.forEach(redraw => redraw());
    }

    /** what to do when there is an update: "auto", "ask" or "off" */
    mode() {
        const { mode } = BdApi.Data.load(NAME, "settings") || {};
        return MODES.some(([value]) => value === mode) ? mode : "auto";
    }

    /** the check that runs by itself: does what the setting says */
    automatic() {
        const mode = this.mode();
        if (mode !== "off") this.run(false, mode === "auto");
    }

    start() {
        this.startTimer = setTimeout(() => this.automatic(), FIRST_CHECK);
        this.interval = setInterval(() => this.automatic(), EVERY);
    }

    stop() {
        clearTimeout(this.startTimer);
        clearInterval(this.interval);
    }

    /** the files looked after: path in the repo -> file on this PC */
    files() {
        const path = require("path");
        const files = { "discord-rice.theme.css": path.join(BdApi.Themes.folder, "discord-rice.theme.css") };
        // only the ones that are installed here get updated; a plugin you left out stays out
        for (const name of ["DiscordRiceUpdater", "DiscordRice", "FolderPictures", "CodeBlockButton"]) {
            files[`betterdiscord/${name}.plugin.js`] = path.join(BdApi.Plugins.folder, `${name}.plugin.js`);
        }
        return files;
    }

    /** the id git gives a file's contents. The repo has LF line ends, a file saved on Windows may not */
    async gitSha(text) {
        const data = new TextEncoder().encode(text.replace(/\r\n/g, "\n"));
        const head = new TextEncoder().encode(`blob ${data.length}\0`);
        const all = new Uint8Array(head.length + data.length);
        all.set(head);
        all.set(data, head.length);
        const hash = await crypto.subtle.digest("SHA-1", all);
        return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
    }

    async github(url, headers = {}) {
        const res = await BdApi.Net.fetch(url, { headers: { ...HEADERS, ...headers } });
        if (res.status === 403 || res.status === 429) throw new Error("GitHub is limiting requests from this network for now");
        if (!res.ok && res.status !== 304) throw new Error(`GitHub answered ${res.status}`);
        return res;
    }

    /** what the repo has now: { commit, files: { path: id } } */
    async listing(state, useCache) {
        const cached = useCache && state.etag && state.listing;
        const head = await this.github(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
            Accept: "application/vnd.github.sha",
            ...(cached ? { "If-None-Match": state.etag } : {})
        });
        if (head.status === 304 && state.listing) return state.listing;
        const commit = (await head.text()).trim();
        if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("GitHub gave no commit id");
        if (cached && state.listing.commit === commit) return state.listing;

        const res = await this.github(`https://api.github.com/repos/${REPO}/git/trees/${commit}?recursive=1`, { Accept: "application/vnd.github+json" });
        const body = await res.json();
        if (!Array.isArray(body.tree) || body.truncated) throw new Error("GitHub gave no complete file list");
        const wanted = this.files();
        const files = {};
        for (const { path, type, sha } of body.tree) {
            if (type === "blob" && Object.hasOwn(wanted, path) && /^[0-9a-f]{40}$/.test(sha)) files[path] = sha;
        }
        state.etag = head.headers.get("etag") || undefined;
        state.listing = { commit, files };
        return state.listing;
    }

    /** says once that there is an update, with a button that installs it */
    offer(names) {
        const text = `discord-rice has an update (${names.join(", ")}).`;
        if (!BdApi.UI.showNotice) {
            BdApi.UI.showToast(`${text} "Check now" in the ${NAME} settings installs it.`, { type: "info", timeout: 10000 });
            return;
        }
        const close = BdApi.UI.showNotice(text, {
            type: "info",
            buttons: [{
                label: "Install",
                onClick: () => {
                    if (typeof close === "function") close();
                    this.run(false);
                }
            }]
        });
    }

    /**
     * @param force also replace a file that was changed on this PC
     * @param apply install what is found; false only looks
     * @returns one line saying what happened
     */
    async run(force, apply = true) {
        if (this.busy) return "Still checking.";
        this.busy = true;
        this.say("Checking GitHub…");
        const fs = require("fs");
        const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        let line;
        try {
            const state = BdApi.Data.load(NAME, "state") || {};
            state.seen = state.seen || {};
            const { commit, files: remote } = await this.listing(state, !force);
            const updated = [], available = [], held = [], differs = [];

            for (const [repoPath, file] of Object.entries(this.files())) {
                const theirs = remote[repoPath];
                // not installed here (the theme may be missing on purpose), or gone from the repo
                if (!theirs || !fs.existsSync(file)) continue;
                const text = String(fs.readFileSync(file, "utf8"));
                const mine = await this.gitSha(text);
                const seen = state.seen[repoPath];
                const name = repoPath.split("/").pop();

                if (mine === theirs) {
                    state.seen[repoPath] = { remote: theirs, local: mine };
                    continue;
                }
                if (!force) {
                    // first look at it: remember how it is. It gets updated from the repo's next change on
                    if (!seen) state.seen[repoPath] = { remote: theirs, local: mine };
                    // the repo hasn't changed it since, so whatever differs was done here on purpose
                    if (!seen || seen.remote === theirs) {
                        differs.push(name);
                        continue;
                    }
                    if (seen.local !== mine) {
                        held.push(name);
                        continue;
                    }
                }

                if (!apply) {
                    available.push(name);
                    continue;
                }

                const res = await this.github(`https://raw.githubusercontent.com/${REPO}/${commit}/${repoPath}`);
                const fresh = await res.text();
                if (await this.gitSha(fresh) !== theirs) throw new Error(`${name} didn't arrive whole`);
                // replacing a file that was edited here: keep the edited one next to it
                if (!seen || seen.local !== mine) fs.writeFileSync(file + ".bak", text);
                fs.writeFileSync(file, fresh);
                state.seen[repoPath] = { remote: theirs, local: theirs };
                updated.push(name);
            }

            const firstReport = held.length && state.told !== commit;
            if (held.length) state.told = commit;
            const firstOffer = available.length && state.offered !== commit;
            if (available.length) state.offered = commit;
            this.held = held.length > 0 || differs.length > 0;

            if (updated.length) line = `Updated ${updated.join(", ")}.`;
            else if (available.length) line = `There is an update for ${available.join(", ")}. "Check now" installs it.`;
            else if (held.length) line = `There is an update, but ${held.join(", ")} was changed on this PC and is left alone.`;
            else if (differs.length) line = `Your ${differs.join(", ")} isn't the same as the one on GitHub. It updates with GitHub's next change, or now with "Replace my changes".`;
            else line = "Up to date.";

            state.last = { text: `${line} Checked at ${clock()}, GitHub is at ${commit.slice(0, 7)}.`, at: Date.now() };
            BdApi.Data.save(NAME, "state", state);

            if (updated.length) BdApi.UI.showToast(`discord-rice updated: ${updated.join(", ")}`, { type: "success" });
            if (firstOffer) this.offer(available);
            if (firstReport) BdApi.UI.showToast(`discord-rice has an update, but ${held.join(", ")} was changed on this PC. See the ${NAME} settings.`, { type: "warning", timeout: 10000 });
            this.status = state.last.text;
        } catch (e) {
            console.error(`[${NAME}]`, e);
            line = `Couldn't check: ${e && e.message || e}.`;
            this.status = `Couldn't check at ${clock()}: ${e && e.message || e}.`;
        } finally {
            this.busy = false;
            this.say(this.status);
        }
        return line;
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        const text = "color: var(--text-default, #ddd); margin-bottom: 12px;";

        const choice = document.createElement("label");
        choice.textContent = "When the theme or the plugins change on GitHub: ";
        choice.style.cssText = "display: block; " + text;
        const select = document.createElement("select");
        select.style.cssText = "padding: 4px 8px; color: #ddd; background: #222; border: 1px solid #555; border-radius: 4px;";
        for (const [value, label] of MODES) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        }
        select.value = this.mode();
        select.onchange = () => BdApi.Data.save(NAME, "settings", { mode: select.value });
        choice.appendChild(select);

        const line = document.createElement("div");
        line.textContent = this.status || "GitHub is asked when Discord starts and every six hours.";
        line.style.cssText = text;

        const button = (label, force) => {
            const b = document.createElement("button");
            b.textContent = label;
            b.className = "bd-button bd-button-filled bd-button-color-brand bd-button-medium";
            b.style.marginRight = "8px";
            b.onclick = async () => {
                line.textContent = "Checking GitHub…";
                line.textContent = await this.run(force);
            };
            return b;
        };

        panel.append(choice, line, button("Check now", false), button("Replace my changes", true));
        return panel;
    }
};
