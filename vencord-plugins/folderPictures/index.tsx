/*
 * FolderPictures, a Vencord user plugin.
 * Give a server folder its own picture: right-click the folder → "Set folder picture…" and pick an
 * image. The closed folder then shows that picture instead of the 2x2 grid of its servers. The same
 * can be done from the plugin's settings page, which lists every folder.
 *
 * Pictures are kept locally in Vencord's storage (nothing is uploaded), cropped square and shrunk to
 * 128px so they stay small. GIFs up to 1 MB are kept as they are, so they stay animated.
 *
 * How it shows them: one small patch tags each folder's preview with its folder id, and a style sheet
 * puts the picture there. If Discord changes and the patch stops matching, a second selector (the
 * folder's list id) usually still finds it.
 */

import { addGlobalContextMenuPatch, GlobalContextMenuPatchCallback, removeGlobalContextMenuPatch } from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import { Button } from "@components/Button";
import definePlugin from "@utils/types";
import { GuildStore, Menu, showToast, SortedGuildStore, useEffect, useReducer } from "@webpack/common";

const STORE_KEY = "FolderPictures_pictures";
const MAX_SIDE = 128;
const KEEP_GIF_UP_TO = 1024 * 1024;

let pictures: Record<string, string> = {};
let styleEl: HTMLStyleElement | null = null;
const listeners = new Set<() => void>();

const cssString = (s: string) => `"${s.replace(/["\\]/g, "\\$&")}"`;

function updateStyle() {
    if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "vc-folder-pictures";
    }
    if (!styleEl.isConnected) document.head.appendChild(styleEl);

    styleEl.textContent = Object.entries(pictures).map(([id, url]) => {
        const sel = `:is([data-vc-folder-id=${cssString(id)}], [data-list-item-id=${cssString("guildsnav___" + id)}] [class*="folderPreviewWrapper_"])`;
        return `${sel} { background-image: url(${cssString(url)}); background-size: cover; background-position: center; }\n`
            + `${sel} > * { visibility: hidden; }`;
    }).join("\n");

    listeners.forEach(l => l());
}

async function save(next: Record<string, string>) {
    pictures = next;
    await DataStore.set(STORE_KEY, pictures);
    updateStyle();
}

function readAsDataUrl(file: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// square crop from the middle, at most 128px. Small GIFs stay as they are so they keep animating
async function toPictureUrl(file: File) {
    const dataUrl = await readAsDataUrl(file);
    if (file.type === "image/gif" && file.size <= KEEP_GIF_UP_TO) return dataUrl;

    const img = await loadImage(dataUrl);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(MAX_SIDE, side);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/webp", 0.9);
}

function pickPicture(folderId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            await save({ ...pictures, [folderId]: await toPictureUrl(file) });
        } catch {
            showToast({ text: "Couldn't read that picture.", variant: "critical" });
        }
    };
    input.click();
}

function removePicture(folderId: string) {
    const { [folderId]: _, ...rest } = pictures;
    save(rest);
}

// the folder right-click menu gets { folderId, folderName, folderColor, unread }. Its menu id isn't
// fixed, so check every menu for a folderId instead
const folderMenuPatch: GlobalContextMenuPatchCallback = (_navId, children, ...args) => {
    const props = args[0];
    if (props?.folderId == null || props.guild != null) return;
    const id = String(props.folderId);
    const has = id in pictures;

    children.push(
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="vc-folder-picture-set"
                label={has ? "Change folder picture…" : "Set folder picture…"}
                action={() => pickPicture(id)}
            />
            {has && (
                <Menu.MenuItem
                    id="vc-folder-picture-remove"
                    label="Remove folder picture"
                    color="danger"
                    action={() => removePicture(id)}
                />
            )}
        </Menu.MenuGroup>
    );
};

function folderLabel(folder: { folderName?: string | null; guildIds: string[]; }) {
    if (folder.folderName) return folder.folderName;
    const names = folder.guildIds.slice(0, 3).map(id => GuildStore.getGuild(id)?.name).filter(Boolean);
    return names.join(", ") || "Unnamed folder";
}

function FolderList() {
    const [, rerender] = useReducer(x => x + 1, 0);
    // re-render when a picture changes
    useEffect(() => {
        listeners.add(rerender);
        return () => void listeners.delete(rerender);
    }, []);

    const folders = SortedGuildStore.getGuildFolders().filter(f => f.folderId != null);
    if (!folders.length) return <p style={{ color: "var(--text-muted)" }}>You don't have any server folders.</p>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {folders.map(f => {
                const id = String(f.folderId);
                return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, flexShrink: 0, borderRadius: 8,
                            background: pictures[id] ? `center / cover url(${cssString(pictures[id])})` : "var(--background-mod-normal)"
                        }} />
                        <span style={{ flex: 1, color: "var(--text-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {folderLabel(f)}
                        </span>
                        <Button size="small" onClick={() => pickPicture(id)}>{pictures[id] ? "Change" : "Set picture"}</Button>
                        {pictures[id] && <Button size="small" variant="dangerSecondary" onClick={() => removePicture(id)}>Remove</Button>}
                    </div>
                );
            })}
        </div>
    );
}

export default definePlugin({
    name: "FolderPictures",
    description: "Give server folders their own picture instead of the 2x2 grid of their servers. Right-click a folder → Set folder picture…",
    authors: [{ name: "Pota", id: 0n }],
    enabledByDefault: true,

    patches: [
        {
            // the closed-folder preview (the 2x2 grid): tag it with its folder id so the style sheet can find it
            find: "#{intl::GUILD_FOLDER_TOOLTIP_A11Y_LABEL}",
            replacement: {
                match: /(\{folderNode:(\i),hovered:\i,sorting:\i\}=\i.{0,400}?\(0,\i\.jsx\)\("div",\{)(className:\i\.\i,children:\(0,\i\.jsx\)\("div",\{className:\i\.\i,children:\i\.slice\(0,4\))/,
                replace: '$1"data-vc-folder-id":$2.id,$3'
            }
        }
    ],

    settingsAboutComponent: FolderList,

    async start() {
        pictures = (await DataStore.get(STORE_KEY)) ?? {};
        updateStyle();
        addGlobalContextMenuPatch(folderMenuPatch);
    },

    stop() {
        removeGlobalContextMenuPatch(folderMenuPatch);
        styleEl?.remove();
    }
});
