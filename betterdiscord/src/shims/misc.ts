/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Stands in for the small Vencord modules: "@utils/types", "@api/PluginManager", "@api/ContextMenu" and
// "@api/DataStore".

declare const BdApi: any;

/* ---------------- @utils/types ---------------- */

export const OptionType = { STRING: 0, NUMBER: 1, BIGINT: 2, BOOLEAN: 3, SELECT: 4, SLIDER: 5, COMPONENT: 6, CUSTOM: 7 };

/** In Vencord this registers the plugin. Here the object is just handed back, for the entry file to use. */
export default function definePlugin<T>(plugin: T) {
    return plugin;
}

/* ---------------- @api/PluginManager ---------------- */

// the one plugin that has another name here
const NAMES: Record<string, string> = { RiceUpdater: "DiscordRiceUpdater" };

export function isPluginEnabled(name: string) {
    try {
        return !!BdApi.Plugins.isEnabled(NAMES[name] ?? name);
    } catch {
        return false;
    }
}

/** plugins.FolderPictures and so on: the running plugin, or undefined */
export const plugins = new Proxy({} as Record<string, any>, {
    get(_, name: string) {
        try {
            return BdApi.Plugins.get(NAMES[name] ?? name)?.instance;
        } catch {
            return undefined;
        }
    }
});

/* ---------------- @api/ContextMenu ---------------- */

export type GlobalContextMenuPatchCallback = (navId: string, children: any[], ...args: any[]) => void;

const unpatch = new Map<GlobalContextMenuPatchCallback, () => void>();

/** Runs the callback for every right-click menu, with the menu's list of items to add to. */
export function addGlobalContextMenuPatch(callback: GlobalContextMenuPatchCallback) {
    const patch = (res: any, props: any) => {
        // what is handed over is the menu, or something wrapped around it
        const menu = res?.props?.navId ? res : res?.props?.children?.props?.navId ? res.props.children : res;
        if (!menu?.props) return;
        let { children } = menu.props;
        if (!Array.isArray(children)) children = menu.props.children = children == null ? [] : [children];
        callback(menu.props.navId, children, props);
    };
    unpatch.set(callback, BdApi.ContextMenu.patch(/./, patch));
}

export function removeGlobalContextMenuPatch(callback: GlobalContextMenuPatchCallback) {
    unpatch.get(callback)?.();
    unpatch.delete(callback);
}

/* ---------------- @api/DataStore ---------------- */

// A small key-value store in the browser's own database. Pictures can be a megabyte each, which is too
// much for the settings file BdApi.Data writes in one piece on every change.
let db: Promise<IDBDatabase> | undefined;

function open() {
    return db ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("discord-rice", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("keyval");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
    return open().then(database => new Promise<T>((resolve, reject) => {
        const request = action(database.transaction("keyval", mode).objectStore("keyval"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }));
}

export function get<T = any>(key: string): Promise<T | undefined> {
    return run<T>("readonly", store => store.get(key));
}

export function set(key: string, value: any): Promise<void> {
    return run("readwrite", store => store.put(value, key)).then(() => void 0);
}
