# discord-rice

Discord made to look like a tiling-WM Linux rice, for [Vencord](https://vencord.dev). It's a theme plus three small plugins.

![discord-rice: tiled panes on a misty wallpaper, Iosevka, greyscale, folder icons in the server list](screenshots/discord-rice.webp)

## The theme

`discord-rice.theme.css`, built on [midnight](https://github.com/refact0r/midnight-discord)'s layout.

- **Tiled, no gaps.** One misty wallpaper behind the whole window, with the columns split by 1px lines. No floating panels, boxes or shadows, and no top bar.
- **Greyscale.** Made to sit on a black-and-white desktop. Server icons and folders are black-and-white too. Only status dots, unread badges and red "danger" buttons keep a muted colour.
- **Terminal touches.** Iosevka everywhere, and the chat bar is a `❯` prompt whose line lights up while you type. The selected channel is a solid bar like ranger's cursor, categories are bold like directories in `ls`, and message times sit in `[brackets]`.
- **Menus like rofi.** Right-click menus, the emoji/GIF picker and other popouts are dark frosted glass with a thin border.
- **Plain folders.** A closed folder shows a folder icon instead of a 2×2 grid of tiny server icons. With the folder plugin it can show a picture, an icon or a bit of ASCII instead.
- **ASCII wallpaper.** With the discord-rice plugin, the wallpaper can be redrawn out of characters, digits or 0s and 1s, like the fetch screenshots on r/unixporn.
- **Less clutter.** Nitro, Shop and Quests are gone from the DM list, and so are the quest card above your user panel, nameplates behind names, the notification bell in the channel header, and the gift and apps buttons in the chat bar.
- **Small fixes.** The game page (click the game you're playing) opens as a smaller centred window, so its close button isn't stuck under the window controls. Drag the window by the empty space in the channel header.

### Install

You need [Vencord](https://vencord.dev) (or [Vesktop](https://github.com/Vencord/Vesktop), which has Vencord built in). The theme works on its own; the plugins below are optional extras.

**Online link (any OS, updates itself).** In Discord, open **Settings → Vencord → Themes → Online Themes** and paste:

```
https://cdn.jsdelivr.net/gh/Plyxen/discord-rice@main/discord-rice.theme.css
```

jsDelivr can take up to a day to pick up a new version.

**Or as a file.** Download `discord-rice.theme.css`, open **Settings → Vencord → Themes → Open Themes Folder**, drop the file in, and turn on **discord-rice** in the list. On Windows, `install.ps1` does the copying for Vencord and Vesktop:

```powershell
.\install.ps1
```

Edits to the file show up live.

### Options

The easy way is inside Discord: the **sliders button** in the channel header, where the inbox button used to be, opens a panel with switches for all of the options below, plus a short intro to the theme. The same panel is under **Settings → discord-rice** (in the Vencord section). It comes from the DiscordRice plugin, which also shows it as a popup the first time you start Discord with it. Changes apply straight away.

Without the plugin, every option is a CSS variable at the top of the theme file:

| Variable | Default | What it does |
| --- | --- | --- |
| `--wallpaper` | misty forest | Any image, e.g. `url('https://i.imgur.com/....jpg')`. imgur, github.io and raw.githubusercontent.com links work. |
| `--wallpaper-dim` | `0.5` | How dark the wallpaper is, from 0 to 1. Raise it if text is hard to read. |
| `--grain` | `on` | Film grain over the wallpaper. |
| `--font` | `'Iosevka'` | `'figtree'` for midnight's font, `''` for Discord's own. `--code-font` is the same for code blocks. |
| `--corners` | `3px` | Corner size. `0px` for dead sharp. Avatars and pills stay round. |
| `--gap` | `0px` | Space between the columns. Raise it for i3-style gaps. |
| `--plain-folders` | `on` | Closed folders show a folder icon. `off` brings back the 2×2 grid. |
| `--mono-server-icons` | `on` | Black-and-white server icons and folders. `hover` shows colour under the mouse; `off` keeps colour. |
| `--glass-menus` | `on` | Frosted-glass menus and pickers. `off` makes them solid. The tint and blur are `--bg-float` and `--float-blur`. |
| `--hide-quests` | `on` | The quest card above your user panel, and quest embeds in chat. |
| `--hide-nameplates` | `on` | The picture strips behind names in the member list, DM list and user panel. Shop and settings previews stay. |
| `--hide-store-tabs` | `on` | Nitro Home, Shop and Quests in the DM list. |
| `--hide-gift-button` | `on` | Gift button in the chat bar. |
| `--hide-apps-button` | `on` | Apps / activities button in the chat bar. |
| `--hide-sticker-button` | `off` | Sticker button in the chat bar. |
| `--hide-notification-button` | `on` | The bell in the channel header. Right-click a channel for the same settings. |
| `--custom-dms-icon` | `custom` | Arch logo on the home button. `off` brings back Discord's logo, and `--dms-icon-svg-url` takes any svg. |
| `--mono-window-controls` | `on` | Grey window dots instead of red / yellow / green. |
| `--top-bar-button-position` | `titlebar` | Where the inbox and window buttons go: `titlebar` puts them in the channel header, `hide` keeps a top bar without them, `off` is Discord's default. |
| `--small-user-panel` | `on` | User panel only under the channel list, so the server list runs full height. |
| `--line`, `--line-focus`, `--float-border` | faint / light grey | The lines between panes, the chat bar's line while typing, and the border around menus (in the `:root` block). |
| `--mention` | faint grey band | The background of messages that ping you (in the `:root` block). |

The wallpaper is embedded in the theme (the long line at the bottom), so it needs no hosting. `wallpaper.jpg` is the same image, at only 736×414, so for a sharper look point `--wallpaper` at a bigger copy.

## The plugins

All three are Vencord user plugins in `vencord-plugins/`. They're optional: the theme works without them. User plugins can't be added to the normal Vencord install; they need Vencord built from source, which takes [git](https://git-scm.com), [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io). Vencord's own guide is [here](https://docs.vencord.dev/installing/custom-plugins/).

```sh
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install --frozen-lockfile
```

Copy the three folders from `vencord-plugins/` into `Vencord/src/userplugins/` (create the folder if it isn't there), so you end up with `src/userplugins/discordRice/index.tsx` and so on. Then build it and install it into Discord:

```sh
pnpm build
pnpm inject
```

Fully restart Discord (quit from the tray, not just the window), then turn the plugins on under **Settings → Vencord → Plugins** if they aren't already. Your settings and themes carry over from the normal install. **Settings → Vencord → Updater** keeps working: it pulls Vencord and rebuilds, and the plugins stay.

For **Vesktop**, skip `pnpm inject` and point Vesktop at the build instead: **Settings → Vesktop Settings → Vencord Location** → the `dist` folder inside your Vencord clone.

After changing a plugin, copy it in again, run `pnpm build`, and restart Discord.

### discord-rice options

`discordRice` puts a sliders button in the channel header, in place of the inbox button (nobody uses the inbox; you can bring it back with the "Inbox button" switch). The button opens the discord-rice panel, which is also under **Settings → discord-rice**.

- The top of the panel is a neofetch-style block: your name `@discord`, the theme, font, corners, wallpaper, how many folders have a look, which plugins are on, and a colour row.
- Below that: whether the theme and the other plugins are on, your folders with their looks, and switches for the inbox button, notification bell, nameplates, quests, store tabs, chat bar buttons, plain folders, black-and-white icons, the Arch logo, font, corners, gaps, glass menus, window dots, wallpaper link, ASCII wallpaper, wallpaper dim and grain. There's a reset button too.
- The panel opens as a popup the first time you start Discord with the plugin, and never again on its own. It's also in the Vencord toolbox.
- The **Theme** switch at the top turns the theme on or off, whether you installed it as a file or as the online link.
- It works by setting the theme's CSS variables from a small style sheet, which beats the theme file's defaults. Turn the plugin off and the theme file's own values come back.

**ASCII wallpaper** redraws the wallpaper (yours or the default one) out of text, sized to your screen:

| Mode | Looks like |
| --- | --- |
| Characters | `.:-=+*#%@`, denser characters where the picture is brighter. |
| Digits | Random digits everywhere, brighter where the picture is. This one looks best on the misty forest. |
| Binary | The same with `0` and `1`. |

The character size slider goes from 6px (fine, more detail) to 16px (chunky). The wallpaper has to allow being read by the page: the default one and imgur links do, and if one doesn't you get a message and the normal wallpaper stays.

### Folder looks

`folderPictures` gives a server folder its own look, inside the folder and framed by its colour, in place of the folder icon or the 2×2 grid. Right-click a folder → **Folder look**:

- **Picture from file…** Pictures are cropped square from the middle and shrunk to 128px. GIFs up to 1 MB are kept as they are, so they stay animated.
- **Picture from link…** Paste an image link. For Pinterest, open the pin, right-click the picture → **Copy image address** (an `i.pinimg.com` link) and paste that. imgur and Discord image links work too. Pinterest and imgur pictures are cropped and saved like files; other sites only work if Discord allows loading from them.
- **ASCII** A few characters in the folder's colour, in the code font. There are presets, or **Your own text…** for up to 5 characters.
- **Icon** A line icon in the folder's colour.
- **Back to normal** shows up once a folder has a look.

The presets come in pairs, the same name as ASCII and as an icon:

| Preset | ASCII | Preset | ASCII |
| --- | --- | --- | --- |
| Important | `!!` | Anime | `^.^` |
| Semi important | `!` | Hot | `~*~` |
| Random | `??` | Night | `zZ` |
| Games | `[>]` | Chill | `c[_]` |
| Friends | `<3` | Bots | `[o_o]` |
| Music | `d\|b` | Dead | `x_x` |
| Code | `</>` | Archive | `[_]` |
| School / work | `[=]` | Home | `~/` |
| Art | `*~` | Terminal | `>_` |
| Memes | `:P` | Fast | `/!\` |

- The discord-rice panel (and **Settings → Vencord → Plugins → FolderPictures**) lists every folder with a preset picker and File / Link / Text / Reset buttons.
- Looks are stored locally and never uploaded.
- With `--mono-server-icons` on, pictures are black-and-white like everything else in the server list.

### Code block button

`codeBlockButton` adds a ``` button next to `<>` in the popup that appears when you select text in the chat box. It wraps the selection in a code block, and clicking it again unwraps it.

## Known limits

- The **notification bell**, **sticker button** and **gift button** switches find those buttons by their English labels, so they do nothing when Discord is set to another language. Everything else works in any language.
- The theme is made for Discord's dark mode on desktop.
- The ASCII wallpaper needs a picture the page is allowed to read: the default one and imgur links work; some sites don't allow it.

## When Discord updates break it

Most of the layout comes from midnight's hosted build, and midnight's maintainer fixes it when Discord renames its classes, so those fixes arrive here automatically. The extras mostly match links, labels and class-name prefixes (`href`, `aria-label`, `[class*='folderPreview_']`), which usually survive renames.

A few rules use Discord's exact class names and may need updating after a big update: the pane lines, the prompt, the selected channel bar, the timestamp brackets, menu styling, the game page window and the header search. If one stops working, the rest of the theme still works.

## Credits and licence

discord-rice is licensed under the [GPL-3.0-or-later](LICENSE), like Vencord. Third-party licence texts are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

- Layout: [midnight-discord](https://github.com/refact0r/midnight-discord) by refact0r (MIT), loaded from its hosted build.
- Font: [Iosevka](https://github.com/be5invis/Iosevka) by Belleve Invis (OFL), via [Fontsource](https://fontsource.org) on jsDelivr.
- Home icon: the Arch Linux logo from [Simple Icons](https://simpleicons.org) (CC0). The logo is a trademark of Arch Linux.
- Folder icons: [Lucide](https://lucide.dev) (ISC; a few from [Feather](https://feathericons.com), MIT).
