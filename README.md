# discord-rice

Discord made to look like a tiling-WM Linux rice, for [Vencord](https://vencord.dev). It's a theme plus two small plugins.

## The theme

`discord-rice.theme.css`, built on [midnight](https://github.com/refact0r/midnight-discord)'s layout.

- **Tiled, no gaps.** One misty wallpaper behind the whole window, with the columns split by 1px lines. No floating panels, boxes or shadows, and no top bar.
- **Greyscale.** Made to sit on a black-and-white desktop. Server icons and folders are black-and-white too. Only status dots, unread badges and red "danger" buttons keep a muted colour.
- **Terminal touches.** Iosevka everywhere, and the chat bar is a `❯` prompt whose line lights up while you type. The selected channel is a solid bar like ranger's cursor, categories are bold like directories in `ls`, and message times sit in `[brackets]`.
- **Menus like rofi.** Right-click menus, the emoji/GIF picker and other popouts are dark frosted glass with a thin border.
- **Plain folders.** A closed folder shows a folder icon instead of a 2×2 grid of tiny server icons, or your own picture with the folder plugin.
- **Less clutter.** Nitro, Shop and Quests are gone from the DM list, and so are the quest card above your user panel, nameplates behind names, and the gift and apps buttons in the chat bar.
- **Small fixes.** The game page (click the game you're playing) opens as a smaller centred window, so its close button isn't stuck under the window controls. Drag the window by the empty space in the channel header.

### Install

```powershell
.\install.ps1
```

This copies the theme into `%APPDATA%\Vencord\themes`. The first time, turn it on in Discord under **Settings → Vencord → Themes → discord-rice**. After that, running the script again updates the theme live.

### Options

Everything is a CSS variable at the top of the theme file.

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
| `--custom-dms-icon` | `custom` | Arch logo on the home button. `off` brings back Discord's logo, and `--dms-icon-svg-url` takes any svg. |
| `--mono-window-controls` | `on` | Grey window dots instead of red / yellow / green. |
| `--top-bar-button-position` | `titlebar` | Where the inbox and window buttons go: `titlebar` puts them in the channel header, `hide` keeps a top bar without them, `off` is Discord's default. |
| `--small-user-panel` | `on` | User panel only under the channel list, so the server list runs full height. |
| `--line`, `--line-focus`, `--float-border` | faint / light grey | The lines between panes, the chat bar's line while typing, and the border around menus (in the `:root` block). |
| `--mention` | faint grey band | The background of messages that ping you (in the `:root` block). |

The wallpaper is embedded in the theme (the long line at the bottom), so it needs no hosting. `wallpaper.jpg` is the same image, at only 736×414, so for a sharper look point `--wallpaper` at a bigger copy.

## The plugins

Both are Vencord user plugins in `vencord-plugins/`. User plugins only run in a Vencord built from source, set up like this:

- The source build is in `Documents\Vencord`, with each plugin copied to `src\userplugins\<name>`.
- `%APPDATA%\Vencord\dist\patcher.js` (the file Discord loads) just points at that build. The installer's original is next to it as `patcher.js.official`. To undo, delete `patcher.js` and rename the original back.
- Settings and themes stay in `%APPDATA%\Vencord`. **Settings → Vencord → Updater** still works: it pulls and rebuilds, and the plugins survive that.
- After changing a plugin, copy it into `src\userplugins`, run `pnpm build` in `Documents\Vencord`, then fully restart Discord (quit from the tray, not just the window).

### Folder pictures

`folderPictures` gives a server folder its own picture.

- Right-click a folder → **Set folder picture…**. The same menu can change or remove the picture later.
- Or use **Settings → Vencord → Plugins → FolderPictures**, which lists every folder with Set / Change / Remove buttons.
- The picture sits inside the folder, framed by the folder's colour, in place of the folder icon or the 2×2 grid.
- Pictures are stored locally and never uploaded. They're cropped square from the middle and shrunk to 128px. GIFs up to 1 MB are kept as they are, so they stay animated.
- With `--mono-server-icons` on, pictures are black-and-white like everything else in the server list.

### Code block button

`codeBlockButton` adds a ``` button next to `<>` in the popup that appears when you select text in the chat box. It wraps the selection in a code block, and clicking it again unwraps it.

## When Discord updates break it

Most of the layout comes from midnight's hosted build, and midnight's maintainer fixes it when Discord renames its classes, so those fixes arrive here automatically. The extras mostly match links, labels and class-name prefixes (`href`, `aria-label`, `[class*='folderPreview_']`), which usually survive renames.

A few rules use Discord's exact class names and may need updating after a big update: the pane lines, the prompt, the selected channel bar, the timestamp brackets, menu styling, the game page window and the header search. If one stops working, the rest of the theme still works.

## Credits

- Layout: [midnight-discord](https://github.com/refact0r/midnight-discord) by refact0r (MIT), loaded from its hosted build.
- Font: [Iosevka](https://github.com/be5invis/Iosevka) by Belleve Invis (OFL), via [Fontsource](https://fontsource.org) on jsDelivr.
- Home icon: the Arch Linux logo from [Simple Icons](https://simpleicons.org) (CC0). The logo is a trademark of Arch Linux.
