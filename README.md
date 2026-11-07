# discord-rice

A clean, Linux-rice-style Discord for Vencord: the **Chillnight** theme, plus a small plugin that adds a code block button.

## Chillnight

A Linux-rice Discord theme for Vencord, built on [midnight](https://github.com/refact0r/midnight-discord)'s maintained layout. It started out as a [Chillax](https://github.com/warrayquipsome/Chillax) look-alike.

- Tiled like i3 or Hyprland with no gaps: one misty forest wallpaper behind the whole window, the columns split by thin 1px lines. No floating panels, boxes or shadows.
- Iosevka everywhere, [Nord](https://www.nordtheme.com) colours, small corners, the Arch logo on the home button.
- Terminal touches: the chat bar is a prompt line (a `❯` in front, and its line lights up while you type), the selected channel is a solid bar like ranger's cursor, categories are frost blue like directories in `ls`, and message times sit in `[brackets]` like an IRC log.
- No top bar: the "Direct Messages" / server title, back/forward arrows and help button are gone. Inbox and window buttons sit in the channel header, as small grey dots that light up on hover.
- Drag the window by the empty space in the channel header, next to the name.
- Store clutter hidden: Nitro Home, Shop and Quests in the DM list, plus the gift and apps buttons in the chat bar.
- Menus, the GIF / emoji picker and other popouts look like rofi on Hyprland: dark frosted glass (see-through with a blur, the same misty dark as the rest of the window), small corners and a thin frost border instead of a shadow. The open picker tab and the menu item under the mouse are frost bars (red for dangerous ones like Leave Server). Settings and other popups keep a solid background in the same dark tone so they stay readable.

## Install

```powershell
.\install.ps1
```

That copies `chillnight.theme.css` into `%APPDATA%\Vencord\themes`. Then in Discord: **Settings → Vencord → Themes → Local Themes**, turn on **Chillnight**. After that, re-running the script updates it live (Vencord reloads theme files on save).

## Options

All options are CSS variables at the top of `chillnight.theme.css`.

| Variable | Default | What it does |
| --- | --- | --- |
| `--wallpaper` | misty forest | Any image: `url('https://i.imgur.com/....jpg')`. imgur, github.io and raw.githubusercontent.com links work. |
| `--wallpaper-dim` | `0.5` | How much the wallpaper is darkened (0 to 1). Raise it if text is hard to read. |
| `--grain` | `on` | Film grain over the wallpaper. |
| `--font` | `'Iosevka'` | `'figtree'` for midnight's font, `''` for Discord's own. `--code-font` does the same for code blocks. |
| `--corners` | `3px` | Corner size. `0px` for dead sharp. Avatars and pills stay round. |
| `--hide-store-tabs` | `on` | Nitro Home, Shop, Quests in the DM list. |
| `--hide-gift-button` | `on` | Gift button in the chat bar. |
| `--hide-apps-button` | `on` | Apps / activities launcher in the chat bar. |
| `--hide-sticker-button` | `off` | Sticker button in the chat bar. |
| `--custom-dms-icon` | `custom` | Arch logo on the home button. `off` brings back Discord's logo; `--dms-icon-svg-url` takes any svg. |
| `--mono-window-controls` | `on` | Grey window dots instead of red/yellow/green. |
| `--mono-server-icons` | `on` | Black-and-white server pictures and folders. `hover` brings the colour back under the mouse; `off` keeps them in colour. Badges stay coloured either way. |
| `--glass-menus` | `on` | Frosted-glass menus and pickers. `off` makes them solid dark. The tint and blur are `--bg-float` and `--float-blur` in the `:root` block. |
| `--top-bar-button-position` | `titlebar` | `titlebar` moves inbox + window buttons into the header; `hide` keeps a top bar without them; `off` is Discord's default. |
| `--small-user-panel` | `on` | User panel only under the channel list; server icons run full height. |
| `--gap` | `0px` | Space between the columns. Raise it for i3-style gaps. |
| `--line`, `--line-focus`, `--float-border` | faint grey, frost | Colour of the lines between the panes, of the chat bar's line while you type, and of the border around menus and pickers (in the `:root` block). |
| `--custom-guild-list-padding` | `6px` | Space left and right of the server icons (in the `:root` block). |

The default wallpaper is embedded in the theme file (the long line at the very bottom), so it needs no hosting. `wallpaper.jpg` is the same image. It is only 736×414; for a sharper look, point `--wallpaper` at a bigger copy.

## Code block button (Vencord plugin)

`vencord-plugins/codeBlockButton` adds a ``` button next to the `<>` button in the popup you get when you select text in the chat box. It wraps the selection in ``` ```; click again to unwrap. It reuses Discord's own wrap/unwrap code, so it behaves like the other buttons.

A theme can't add buttons, so this is a Vencord user plugin, and user plugins only run in a Vencord built from source:

- The source build lives in `Documents\Vencord`, with the plugin copied to `src\userplugins\codeBlockButton`.
- `%APPDATA%\Vencord\dist\patcher.js` (the file Discord loads) now just loads that build. The installer's original is next to it as `patcher.js.official`; delete `patcher.js` and rename that back to undo.
- Settings and themes stay in `%APPDATA%\Vencord`, same as before.
- Update Vencord from **Settings → Vencord → Updater** as usual: for a source build it pulls and rebuilds, and the plugin survives that.
- After changing the plugin: copy it into `Documents\Vencord\src\userplugins\codeBlockButton`, run `pnpm build` there and restart Discord.

## When Discord updates break it

Most of the layout is imported from midnight's hosted build, and midnight's maintainer fixes it when Discord renames its classes (as happened in November 2026), so those fixes arrive here automatically. The Chillnight extras mostly use links, labels and class-name prefixes (`href`, `aria-label`, `[class*='baseLayer_']`) that survive renames. Some rules use Discord class names directly and may need updating after a big update: the header search width (`.search_bWCaDq`), the DM list row (`.channel_zln_tS`, which has a class-free fallback), and the rice touches (pane lines, prompt, selected channel bar, category colour, timestamp brackets, menu and picker styling). If one of those stops showing, the rest of the theme still works.

## Credits

- Layout: [midnight-discord](https://github.com/refact0r/midnight-discord) by refact0r (MIT), loaded from its hosted build.
- Colours: [Nord](https://www.nordtheme.com) by Arctic Ice Studio (MIT).
- Font: [Iosevka](https://github.com/be5invis/Iosevka) by Belleve Invis (OFL), loaded from [Fontsource](https://fontsource.org) on jsDelivr.
- Home icon: Arch Linux logo from [Simple Icons](https://simpleicons.org) (CC0). The logo is a trademark of Arch Linux.
- Original look: [Chillax](https://github.com/warrayquipsome/Chillax) by the Chillax Squad.
