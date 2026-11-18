# Contributing

Bug reports, fixes and ideas are welcome. This is a small one-person project, so small changes with a line about what you tried are the easiest to take in.

## Reporting a problem

[Open an issue](https://github.com/Plyxen/discord-rice/issues/new/choose); there is a form for things that look or work wrong and one for the installers and updaters. What helps most:

- a screenshot,
- which mod (Vencord, Vesktop or BetterDiscord) and which system,
- the theme's version: the about tab of the discord-rice window shows it, and so do the first lines of the theme file,
- for an installer problem, everything the terminal printed.

Discord renames its classes now and then, and parts of the theme stop working until that is caught up with here. Those reports are useful too; the README's [When Discord updates break it](../README.md#when-discord-updates-break-it) lists the parts it usually hits.

A security problem doesn't go in an issue: see the [security policy](SECURITY.md).

## Changing the theme

- The theme is one file, `discord-rice.theme.css`. Put it in your themes folder and edit it there: both mods reload it when you save.
- Use the theme's own variables for colours, not new fixed ones.
- Keep selectors cheap. A rule whose last part is `*` or `[class*=...]`, or a `:has()` on a large part of the window, is checked against everything in the window each time something changes; an earlier version made every click slow that way. Exact class names and the attributes Discord keeps (`href`, `aria-label`, `data-list-item-id`) are fine.
- Raise `@version` in the header. The about tab shows it, and it is how people say which version they have.

## Changing the plugins

- **Vencord:** the folders in `vencord-plugins/` go into `src/userplugins/` of a Vencord source build (the installer sets one up). Build Vencord and restart Discord.
- **BetterDiscord:** `DiscordRice.plugin.js` and `FolderPictures.plugin.js` are built from the Vencord source, so don't edit them. Run `node betterdiscord/src/build.mjs <a Vencord source folder>` and commit what it writes. `CodeBlockButton.plugin.js` and `DiscordRiceUpdater.plugin.js` are written by hand.
- **The updater:** `vencord-plugins/riceUpdater.desktop/sync.ts` uses nothing but Node, so it can be run on its own against made-up folders and a stand-in for GitHub. Please do that for any change to it: it writes files on other people's PCs.

## Changing the installers

- `install.ps1` and `install.sh` do the same thing. A change to one usually belongs in the other too.
- They have to stay safe to run twice, show a command before running anything as administrator, and never run something that was typed in or downloaded as a command.
- Say what you ran it on. `install.ps1` is used for real on Windows. `install.sh` has run for real on one Linux PC with a Flatpak Discord; its `sudo` step and macOS have only been tried against stand-ins.

## What happens after a merge

Whatever is on `main` reaches people's Discord within about six hours, through the updaters. So `main` has to work as it is: nothing half finished goes there.

## Licence

discord-rice is [GPL-3.0-or-later](../LICENSE), and a change you send is taken under that licence. Anything from somebody else (an icon, a font, a snippet) needs its licence in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
