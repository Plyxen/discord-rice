/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Builds the BetterDiscord plugins that share their code with the Vencord ones:
 *
 *     node betterdiscord/src/build.mjs <a Vencord source folder>
 *
 * BetterDiscord loads a plugin as one plain .js file, so the shared TypeScript is bundled here, with the
 * Vencord modules it imports ("@api/Settings", "@webpack/common", ...) pointed at the stand-ins in
 * shims/. The bundler is esbuild, the one Vencord itself builds with, which is why this wants a Vencord
 * folder (one where "pnpm install" was run) instead of installing anything of its own.
 *
 * Run it after changing vencord-plugins/discordRice, vencord-plugins/folderPictures or anything in this
 * folder, and commit the .plugin.js files it writes: those are what users and the updater download.
 */

import { existsSync } from "fs";
import { createRequire } from "module";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..");
const vencord = process.argv[2] && resolve(process.argv[2]);
if (!vencord || !existsSync(join(vencord, "node_modules", "esbuild"))) {
    console.error("Usage: node betterdiscord/src/build.mjs <a Vencord source folder where pnpm install was run>");
    process.exit(1);
}
const esbuild = createRequire(join(vencord, "package.json"))("esbuild");

const shim = name => join(here, "shims", name);
const STAND_INS = {
    "@api/Settings": shim("settings.ts"),
    "@api/PluginManager": shim("misc.ts"),
    "@api/ContextMenu": shim("misc.ts"),
    "@api/DataStore": shim("misc.ts"),
    "@utils/types": shim("misc.ts"),
    "@webpack/common": shim("ui.tsx"),
    "@components/Button": shim("ui.tsx"),
    "@components/Paragraph": shim("ui.tsx"),
    "@components/ErrorBoundary": shim("ui.tsx"),
    "@components/settings/tabs/BaseTab": shim("ui.tsx")
};

const standIns = {
    name: "stand-ins",
    setup(build) {
        build.onResolve({ filter: /^@/ }, args => {
            const path = STAND_INS[args.path];
            if (path) return { path };
            return { errors: [{ text: `${args.path} has no stand-in in betterdiscord/src/shims yet (imported by ${args.importer})` }] };
        });
        // the settings window's wording for the mod it runs in
        build.onResolve({ filter: /^\.\/mod$/ }, () => ({ path: shim("mod.ts") }));
    }
};

const PLUGINS = [
    {
        name: "DiscordRice",
        entry: "discordRice.tsx",
        version: "1.1.0",
        description: "Settings for the discord-rice theme in one terminal-style window, behind a rice bowl button in the channel header: font, corners, wallpaper, ASCII wallpaper, what to hide, and folder looks."
    },
    {
        name: "FolderPictures",
        entry: "folderPictures.tsx",
        version: "1.0.0",
        description: "Give server folders their own look instead of the 2x2 grid of their servers: a picture (file or link), an ASCII preset or an icon. Right-click a folder > Folder look."
    }
];

for (const plugin of PLUGINS) {
    const header = `/**
 * @name ${plugin.name}
 * @author Pota
 * @description ${plugin.description}
 * @version ${plugin.version}
 * @source https://github.com/Plyxen/discord-rice
 * @website https://github.com/Plyxen/discord-rice
 */

/*
 * discord-rice (https://github.com/Plyxen/discord-rice)
 * Copyright (c) 2026 Pota
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This file is built, don't edit it: the source is betterdiscord/src/${plugin.entry} and the Vencord
 * plugin it shares its code with, and betterdiscord/src/build.mjs puts them together.
 */`;

    const outfile = join(out, `${plugin.name}.plugin.js`);
    await esbuild.build({
        entryPoints: [join(here, plugin.entry)],
        outfile,
        bundle: true,
        format: "cjs",
        platform: "browser",
        target: "chrome120",
        charset: "utf8",
        legalComments: "none",
        jsx: "transform",
        jsxFactory: "React.createElement",
        jsxFragment: "React.Fragment",
        inject: [shim("globals.ts")],
        define: { __PLUGIN_NAME__: JSON.stringify(plugin.name) },
        loader: { ".css": "text" },
        // Node's own modules, which BetterDiscord hands a plugin through require()
        external: ["fs", "path"],
        plugins: [standIns],
        banner: { js: header },
        // BetterDiscord wants the plugin's class itself as what the file exports
        footer: { js: "module.exports = module.exports.default;" },
        logLevel: "warning"
    });
    console.log("built", outfile);
}
