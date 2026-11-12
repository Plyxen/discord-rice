/**
 * @name DiscordRiceUpdater
 * @author Pota
 * @description Keeps the discord-rice theme file and plugins up to date from github.com/Plyxen/discord-rice. A file you edited yourself is left alone.
 * @version 1.1.0
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
 * It only ever talks to github.com/Plyxen/discord-rice.
 */

const REPO = "Plyxen/discord-rice";
const BRANCH = "main";
const NAME = "DiscordRiceUpdater";
const HEADERS = { "User-Agent": "discord-rice-updater", "X-GitHub-Api-Version": "2022-11-28" };
const FIRST_CHECK = 30000;
const EVERY = 6 * 60 * 60000;

module.exports = class DiscordRiceUpdater {
    start() {
        this.startTimer = setTimeout(() => this.run(false), FIRST_CHECK);
        this.interval = setInterval(() => this.run(false), EVERY);
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

    /**
     * @param force also replace a file that was changed on this PC
     * @returns one line saying what happened
     */
    async run(force) {
        if (this.busy) return "Still checking.";
        this.busy = true;
        const fs = require("fs");
        try {
            const state = BdApi.Data.load(NAME, "state") || {};
            state.seen = state.seen || {};
            const { commit, files: remote } = await this.listing(state, !force);
            const updated = [], held = [], differs = [];

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
            BdApi.Data.save(NAME, "state", state);

            if (updated.length) BdApi.UI.showToast(`discord-rice updated: ${updated.join(", ")}`, { type: "success" });
            if (firstReport) BdApi.UI.showToast(`discord-rice has an update, but ${held.join(", ")} was changed on this PC. See the ${NAME} settings.`, { type: "warning", timeout: 10000 });

            if (updated.length) return `Updated ${updated.join(", ")}.`;
            if (held.length) return `There is an update, but ${held.join(", ")} was changed on this PC and is left alone.`;
            if (differs.length) return `Your ${differs.join(", ")} isn't the same as the one on GitHub. It updates with GitHub's next change, or now with "Replace my changes".`;
            return "Up to date.";
        } catch (e) {
            console.error(`[${NAME}]`, e);
            return `Couldn't check: ${e && e.message || e}.`;
        } finally {
            this.busy = false;
        }
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        const line = document.createElement("div");
        line.textContent = "Checks GitHub when Discord starts and every six hours.";
        line.style.cssText = "color: var(--text-default, #ddd); margin-bottom: 12px;";

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

        panel.append(line, button("Check now", false), button("Replace my changes", true));
        return panel;
    }
};
