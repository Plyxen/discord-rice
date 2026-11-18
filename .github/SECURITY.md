# Security

discord-rice runs inside Discord, with the access Discord itself has, and by default it keeps itself up to date. So a security problem here matters, and it is better heard about before it is public.

## Reporting a problem

Please don't open a normal issue for something that could be used against people.

- Use **Report a vulnerability** on this repo's [Security tab](https://github.com/Plyxen/discord-rice/security). Only the maintainer sees what you write there.
- If that button isn't there, open an issue that says only that you have a security report, with no details, and the maintainer will get in touch.

Say what you found, which file or step it is in, and how to make it happen. This is a one-person project: reports are read by the maintainer and answered as soon as possible.

Fixes go into the newest version on `main`, which is the only one looked after. The updaters bring everyone to it.

## What counts

- Anything that makes the updaters (`RiceUpdater`, `DiscordRiceUpdater`) or the installers fetch, write or run something other than what the README says they do.
- A way for a setting (a wallpaper link, a folder picture or its text, anything typed into the discord-rice window) to run code or reach data it shouldn't.
- Anything in the theme or the plugins that sends data somewhere.

Not for here: Discord's own rules about client mods, and problems in Vencord, Vesktop, BetterDiscord or Orion themselves, which belong with those projects.

## What it does, so you can judge for yourself

- **Updates.** When Discord starts, and every six hours after that, the updaters ask GitHub for this repo's newest commit and by default install what changed: the theme file and the plugins, the updater's own code included. Each file is fetched by that commit's id and checked against GitHub's listing. That catches a broken download, not a bad commit: there are no signed releases, so an updater that installs by itself means trusting whatever is on `main`, and with it the maintainer's GitHub account. Both updaters can be set to tell you first, or not to check at all.
- **What it talks to.** The theme loads the Iosevka font from jsDelivr, and nothing else. The updaters talk to `api.github.com` and `raw.githubusercontent.com`, about this repo only. A wallpaper or folder picture you set by link is fetched from the site the link points at.
- **The installers** change what the README lists and nothing else. Before replacing a theme file they ask GitHub whether it is one of this repo's own versions, sending the file's git id and nothing of the file. For the Vencord plugins they download Vencord's source, what its build needs (from the npm registry) and Vencord's own installer, each in its newest version. On Linux, where Discord is installed for the whole system, they show the `sudo` command for that installer and run it only if you say yes.
- **Orion** is somebody else's plugin, added only if you say yes. Nothing in it is checked by this project.
