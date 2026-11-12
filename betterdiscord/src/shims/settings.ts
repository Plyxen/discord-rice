/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Stands in for Vencord's "@api/Settings": a plugin's own settings, kept with BdApi.Data, and the little
// of Vencord's global settings the shared code reads (which themes are on).

import { THEME_FILE } from "./globals";

declare const BdApi: any;
/** set by the build: the name of the plugin being built */
declare const __PLUGIN_NAME__: string;

interface OptionDef {
    default?: unknown;
    options?: { value: unknown; default?: boolean; }[];
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

/** Calls back whenever one of this plugin's settings changes. Returns a function that stops it. */
export function onSettingsChange(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
}

function useChanges(source: Set<() => void>) {
    const [, redraw] = React.useReducer((n: number) => n + 1, 0);
    React.useEffect(() => {
        source.add(redraw);
        return () => void source.delete(redraw);
    }, []);
}

export function definePluginSettings<T extends Record<string, OptionDef>>(def: T) {
    const values: Record<string, unknown> = {};
    for (const [key, option] of Object.entries(def)) {
        values[key] = "default" in option ? option.default : option.options?.find(o => o.default)?.value;
    }
    try {
        Object.assign(values, BdApi.Data.load(__PLUGIN_NAME__, "settings") ?? {});
    } catch { }

    // several settings can change in one go (reset); write the file once
    let saving = false;
    const save = () => {
        if (saving) return;
        saving = true;
        queueMicrotask(() => {
            saving = false;
            try {
                BdApi.Data.save(__PLUGIN_NAME__, "settings", values);
            } catch { }
        });
    };

    const store = new Proxy(values, {
        set(target, key: string, value) {
            if (target[key] === value) return true;
            target[key] = value;
            save();
            notify();
            return true;
        }
    }) as any;

    return {
        def,
        store,
        /** the settings, re-rendering the component that asks whenever one changes */
        use(_keys?: string[]) {
            useChanges(listeners);
            return store;
        }
    };
}

/* ---------------- Vencord's own settings: only the theme switches ---------------- */

const themeListeners = new Set<() => void>();

function themeOn() {
    try {
        return !!BdApi.Themes.isEnabled(THEME_FILE);
    } catch {
        return false;
    }
}

export const Settings = {
    get enabledThemes(): string[] {
        return themeOn() ? [THEME_FILE] : [];
    },
    set enabledThemes(list: string[]) {
        const on = list.includes(THEME_FILE);
        try {
            if (on !== themeOn()) BdApi.Themes[on ? "enable" : "disable"](THEME_FILE);
        } catch { }
        themeListeners.forEach(l => l());
    },
    // BetterDiscord has no online themes
    get themeLinks(): string[] {
        return [];
    },
    set themeLinks(_: string[]) { }
};

export function useSettings(_keys?: string[]) {
    useChanges(themeListeners);
    // the theme can also be switched in BetterDiscord's own list, which sends no word of it
    // so look now and then; a changed answer redraws
    const [, setOn] = React.useState(themeOn);
    React.useEffect(() => {
        const timer = setInterval(() => setOn(themeOn()), 1500);
        return () => clearInterval(timer);
    }, []);
    return { enabledThemes: themeOn() ? [THEME_FILE] : [], themeLinks: [] as string[] };
}
