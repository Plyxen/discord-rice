# Chillnight

A dark, clean Discord theme for Vencord: [midnight](https://github.com/refact0r/midnight-discord)'s layout with a [Chillax](https://github.com/warrayquipsome/Chillax)-style monochrome look.

- No top bar: the "Direct Messages" / server title, back/forward arrows and help button are gone. Inbox and window buttons sit in the channel header.
- Greyscale palette, frosted panels over a dark wallpaper, small grey window dots that light up on hover.
- Store clutter hidden: Nitro Home, Shop and Quests in the DM list, plus the gift and apps buttons in the chat bar.

## Install

```powershell
.\install.ps1
```

That copies `chillnight.theme.css` into `%APPDATA%\Vencord\themes`. Then in Discord: **Settings → Vencord → Themes → Local Themes**, turn on **Chillnight**. After that, re-running the script updates it live (Vencord reloads theme files on save).

## Options

All options are CSS variables at the top of `chillnight.theme.css`.

| Variable | Default | What it does |
| --- | --- | --- |
| `--background-image` | `on` | Wallpaper behind the panels. Set `--background-image-url` to any image link. |
| `--panel-blur` / `--blur-amount` | `on` / `24px` | Frosted glass on panels. |
| `--hide-store-tabs` | `on` | Nitro Home, Shop, Quests in the DM list. |
| `--hide-gift-button` | `on` | Gift button in the chat bar. |
| `--hide-apps-button` | `on` | Apps / activities launcher in the chat bar. |
| `--hide-sticker-button` | `off` | Sticker button in the chat bar. |
| `--mono-window-controls` | `on` | Grey window dots instead of red/yellow/green. |
| `--top-bar-button-position` | `titlebar` | `titlebar` moves inbox + window buttons into the header; `hide` keeps a top bar without them; `off` is Discord's default. |
| `--custom-chatbar` | `separated` | Chat bar as its own floating panel (`off` to attach it to the chat). |
| `--small-user-panel` | `on` | User panel only under the channel list. |
| `--font` | `'figtree'` | `''` for Discord's own font. |

For fully solid panels (no wallpaper): set `--background-image: off` and change the alpha of `--bg-1` to `--bg-4` to `1`.

## When Discord updates break it

Most of the layout is imported from midnight's hosted build, and midnight's maintainer fixes it when Discord renames its classes (as happened in November 2026), so those fixes arrive here automatically. The Chillnight extras mostly use links and labels (`href`, `aria-label`) that survive renames. Two rules use Discord class names directly and may need updating after a big update: the header search width (`.search_bWCaDq`) and the DM list row (`.channel_zln_tS`, which has a class-free fallback).

## Credits

- Layout: [midnight-discord](https://github.com/refact0r/midnight-discord) by refact0r (MIT), loaded from its hosted build.
- Look and default wallpaper: [Chillax](https://github.com/warrayquipsome/Chillax) by the Chillax Squad. The wallpaper is loaded from Chillax's own site, not copied here.
