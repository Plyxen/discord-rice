#!/usr/bin/env bash
# Installs discord-rice on Linux and macOS: the theme and the plugins, for Vencord, Vesktop and
# BetterDiscord. Run it from a copy of the repo, or straight from GitHub:
#
#   curl -fsSL https://raw.githubusercontent.com/Plyxen/discord-rice/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/Plyxen/discord-rice/main/install.sh | bash -s -- --plugins
#
# What it does, in this order:
#   1. Copies the theme into the themes folder of every mod it finds (Vencord, Vesktop, BetterDiscord).
#   2. BetterDiscord: also copies its plugins (the settings window, folder looks, the code block button and
#      the updater). They are single files, so there is nothing more to it.
#   3. Vencord, if you say yes: sets up the plugins. Vencord only takes extra plugins when it is built from
#      its source, so this finds your source build or downloads one (git clone), copies the plugin folders
#      into it, builds it, and points Discord at the build with Vencord's own installer. That needs git
#      and Node.js. If one is missing, the script offers to install it with your package manager (brew,
#      apt, dnf or pacman), shows the command first, and runs it only if you say yes.
#      With the plugins it also asks about Orion, which is somebody else's plugin (see --help).
#
# With plain Discord and no mod at all, it offers step 3 straight away: that brings Vencord too. Where
# Discord came from a package (pacman, apt, dnf) or is a Flatpak for the whole system, only an
# administrator may change it, so the last part of step 3 needs sudo; the script shows that command and
# asks before running it. If Discord is installed in more than one place (a Flatpak and an old /opt
# folder, say), each of them is pointed at the build: the script can't know which one you start.
#
# Run it again whenever you like: it replaces what it installed and leaves everything else alone. A theme
# file you edited yourself is kept next to the new one as .bak.

set -eo pipefail

REPO="Plyxen/discord-rice"
THEME_FILE="discord-rice.theme.css"
BD_UPDATER="DiscordRiceUpdater.plugin.js" # the one BetterDiscord plugin that also goes in with --theme-only
VENCORD_REPO="https://github.com/Vendicated/Vencord"
ORION_REPO="https://github.com/nyxxbit/discord-quest-completer"
ORION_FOLDER="discord-quest-completer" # the folder name Orion's own guide uses

theme_only=0
want_plugins=0
want_orion=0
install_tools=0
no_inject=0
uninstall=0
vencord_dir=""
tmp=""
src=""
built_dir="" # the Vencord folder, once the plugins are in and built
not_loaded=0 # 1 when that build is ready but Discord could not be pointed at it
flatpak_target=0 # 1 when the build is for a Flatpak Discord: that one can't update the plugins by itself
plain_target=0 # 1 when the build is for a Discord that is not a Flatpak
theme_id="" # the id git gives the new theme file
no_mod_at_start=0 # 1 when there was no Vencord, Vesktop or BetterDiscord before this run
orion_state="" # "added" or "updated" when this run brought Orion in, "present" when it was there already
orion_dir=""
orion_before="" # the commit Orion was at before this run updated it

usage() {
    cat <<'EOF'
Usage: install.sh [options]

  --theme-only        the theme only, without asking about the plugins (BetterDiscord still gets
                      the updater plugin, so the theme keeps itself up to date)
  --plugins           also set up the Vencord plugins, without asking
  --install-tools     with the plugins, install git and Node.js with your package manager without
                      asking, if they are missing
  --orion             with the plugins, also add Orion without asking (or update it). Orion
                      (github.com/nyxxbit/discord-quest-completer) completes Discord Quests without
                      playing them. It is not part of discord-rice: its newest code is downloaded
                      from its own repo into the same Vencord build, and its README warns that
                      Discord has been restricting accounts for quest automation since April 2026
  --vencord-dir DIR   where the Vencord source is, or where to download it to
                      (default: the build that is already in use, otherwise ~/Vencord)
  --no-inject         build Vencord with the plugins, but don't point Discord at the build
  --uninstall         remove what this script installed; Vencord and BetterDiscord themselves stay
  -h, --help          this text
EOF
}

step() { printf '\n\033[36m> %s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$1"; }
die() { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }
cleanup() { if [ -n "$tmp" ]; then rm -rf "$tmp"; fi; }
trap cleanup EXIT

while [ $# -gt 0 ]; do
    case "$1" in
        --theme-only) theme_only=1 ;;
        --plugins) want_plugins=1 ;;
        --orion) want_orion=1 ;;
        --install-tools) install_tools=1 ;;
        --no-inject) no_inject=1 ;;
        --uninstall) uninstall=1 ;;
        --vencord-dir)
            shift
            vencord_dir="${1:-}"
            [ -n "$vencord_dir" ] || die "--vencord-dir needs a folder."
            ;;
        --vencord-dir=*) vencord_dir="${1#*=}" ;;
        -h | --help) usage; exit 0 ;;
        *) usage >&2; die "Unknown option: $1" ;;
    esac
    shift
done

# Is there a terminal to ask on? (There is even when the script itself is piped in from curl.)
has_tty() { { : >/dev/tty; } 2>/dev/null; }

# Asks a yes/no question where just pressing Enter means yes. Without a terminal the answer is no.
ask_yes() {
    local answer=""
    has_tty || return 1
    printf '%s [Y/n] ' "$1" >/dev/tty
    read -r answer </dev/tty || return 1
    case "$answer" in
        n | N | no | No | NO) return 1 ;;
        *) return 0 ;;
    esac
}

# The command that installs git and Node.js with this system's package manager. Prints nothing if it
# knows none. npm is named too where it is a package of its own: it brings npx, which fetches pnpm.
tools_command() {
    local sudo=""
    if [ "$(id -u)" != 0 ]; then sudo="sudo "; fi
    if have brew; then
        printf 'brew install git node\n'
    elif have apt-get; then
        printf '%sapt-get install -y git nodejs npm\n' "$sudo"
    elif have dnf; then
        printf '%sdnf install -y git nodejs npm\n' "$sudo"
    elif have pacman; then
        printf '%spacman -S --needed --noconfirm git nodejs npm\n' "$sudo"
    fi
}

# Installs git and Node.js with the package manager, after showing the command and asking.
# Fails (returns 1) if it didn't go and try.
install_the_tools() {
    local command
    command="$(tools_command)"
    [ -n "$command" ] || return 1
    if [ "$install_tools" = 0 ]; then
        info "The plugins need git and Node.js, and this computer doesn't have both yet (or has too old)."
        info "They can be installed now with:  $command"
        ask_yes "  Run that now?" || return 1
    fi
    info "Running: $command"
    # the command is one of the fixed lines above, never anything typed in or downloaded
    if ! sh -c "$command"; then
        warn "That did not finish cleanly."
        case "$command" in
            *pacman*) info "If pacman couldn't download a package, update the system first (sudo pacman -Syu) and run this again." ;;
        esac
    fi
    hash -r 2>/dev/null || true
    return 0
}

# Asks a yes/no question. Without a terminal the answer is no.
ask() {
    local answer=""
    has_tty || return 1
    printf '%s [y/N] ' "$1" >/dev/tty
    read -r answer </dev/tty || answer=""
    case "$answer" in
        y | Y | yes | Yes | YES) return 0 ;;
        *) return 1 ;;
    esac
}

# The discord-rice files: the folder this script is in, or a fresh download of the repo. Sets $src.
get_source() {
    local here=""
    if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
        here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    fi
    if [ -n "$here" ] && [ -f "$here/$THEME_FILE" ]; then
        src="$here"
        return
    fi
    have curl || die "curl is needed to download discord-rice."
    have tar || die "tar is needed to unpack discord-rice."
    info "Downloading github.com/$REPO ..."
    tmp="$(mktemp -d)"
    curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.tar.gz" | tar -xz -C "$tmp"
    src="$tmp/discord-rice-main"
    [ -f "$src/$THEME_FILE" ] || die "The download is not what was expected."
}

# The folders a mod's data folder can be in: the normal one, and the Flatpak ones on Linux.
config_dirs() {
    case "$(uname -s)" in
        Darwin) printf '%s\n' "$HOME/Library/Application Support" ;;
        *)
            printf '%s\n' "${XDG_CONFIG_HOME:-$HOME/.config}" \
                "$HOME/.var/app/com.discordapp.Discord/config" \
                "$HOME/.var/app/dev.vencord.Vesktop/config"
            ;;
    esac
}

# The mods that are installed. Fills mod_names and mod_dirs.
mod_names=()
mod_dirs=()
find_mods() {
    local base pair name dir
    while IFS= read -r base; do
        for pair in "Vencord:Vencord" "Vesktop:vesktop" "BetterDiscord:BetterDiscord"; do
            name="${pair%%:*}"
            dir="$base/${pair#*:}"
            if [ -d "$dir" ]; then
                mod_names+=("$name")
                mod_dirs+=("$dir")
            fi
        done
    done < <(config_dirs)
}

# Adds a mod to the list, unless its folder is in it already (then it fails).
add_mod() { # name, folder
    local i
    for i in "${!mod_dirs[@]}"; do
        if [ "${mod_dirs[$i]}" = "$2" ]; then return 1; fi
    done
    mod_names+=("$1")
    mod_dirs+=("$2")
}

# Which Discord a folder name stands for, told the way Vencord's installer tells it.
branch_of() {
    case "$1" in
        *[Cc]anary) echo canary ;;
        *[Pp][Tt][Bb]) echo ptb ;;
        *[Dd]evelopment) echo development ;;
        *) echo stable ;;
    esac
}

# Discord's newer updater keeps the app next to its settings, one app-<version> folder per version. Prints
# the resources folder of the last one in plain byte order, which is the one Vencord's installer takes.
newest_app() {
    local d
    for d in "$1"/app-*/resources; do
        if [ -d "$d" ]; then printf '%s\n' "$d"; fi
    done | LC_ALL=C sort | tail -n 1
}

# Every place Discord's own app is installed, found the way Vencord's installer finds them (the snap is
# not among them: Vencord can't change that one). One line each, with | between:
#   stable, ptb or canary | the folder Vencord's installer is told | its resources folder |
#   the folder its settings folder is in | "flatpak" for a Flatpak
discord_places() {
    local root name p res app
    case "$(uname -s)" in
        Darwin)
            for root in /Applications "$HOME/Applications"; do
                for name in "Discord" "Discord PTB" "Discord Canary"; do
                    p="$root/$name.app"
                    res="$p/Contents/Resources"
                    if [ -f "$res/app.asar" ]; then
                        printf '%s|%s|%s|%s|\n' "$(branch_of "$name")" "$p" "$res" "$HOME/Library/Application Support"
                    fi
                done
            done
            ;;
        *)
            # put there by a package (/opt, /usr), or unpacked by hand
            for root in /usr/share /usr/lib /usr/lib64 /opt "$HOME/.local/share" "$HOME/.dvm"; do
                for name in Discord DiscordPTB DiscordCanary discord discordptb discordcanary discord-ptb discord-canary; do
                    p="$root/$name"
                    if [ -f "$p/resources/app.asar" ]; then
                        printf '%s|%s|%s|%s|\n' "$(branch_of "$name")" "$p" "$p/resources" "${XDG_CONFIG_HOME:-$HOME/.config}"
                    fi
                done
            done
            # a Flatpak, for the whole system or for this user
            for root in /var/lib/flatpak/app "$HOME/.local/share/flatpak/app"; do
                for name in Discord DiscordPTB DiscordCanary; do
                    p="$root/com.discordapp.$name"
                    case "$name" in
                        Discord) app="discord" ;;
                        DiscordPTB) app="discord-ptb" ;;
                        *) app="discord-canary" ;;
                    esac
                    res="$p/current/active/files/$app/resources"
                    if [ -f "$res/app.asar" ]; then
                        printf '%s|%s|%s|%s|flatpak\n' "$(branch_of "$name")" "$p" "$res" "$HOME/.var/app/com.discordapp.$name/config"
                    fi
                done
            done
            # the app kept next to its settings by Discord's newer updater, outside and inside a Flatpak
            for name in discord discordcanary discordptb; do
                p="$HOME/.config/$name"
                res="$(newest_app "$p")"
                if [ -n "$res" ]; then
                    printf '%s|%s|%s|%s|\n' "$(branch_of "$name")" "$p" "$res" "$HOME/.config"
                fi
            done
            for name in Discord DiscordCanary DiscordPTB; do
                p="$HOME/.var/app/com.discordapp.$name/config/discord"
                res="$(newest_app "$p")"
                if [ -n "$res" ]; then
                    printf '%s|%s|%s|%s|flatpak\n' "$(branch_of "$name")" "$p" "$res" "$HOME/.var/app/com.discordapp.$name/config"
                fi
            done
            ;;
    esac
}

# The same list with each install in it once: /usr/lib64 is often just another name for /usr/lib.
discord_installs() {
    local line res k dup
    local kept=()
    while IFS= read -r line; do
        res="$(printf '%s
' "$line" | cut -d '|' -f 3)"
        dup=0
        for k in "${kept[@]}"; do
            if [ "$res" -ef "$k" ]; then dup=1; fi
        done
        if [ "$dup" = 0 ]; then
            kept+=("$res")
            printf '%s
' "$line"
        fi
    done < <(discord_places)
}

# The installs the build is for. Fills targets with lines from discord_installs: every place the regular
# Discord is in, or Canary's when there is no regular one, or PTB's (the order Vencord's installer has).
targets=()
find_targets() {
    local all branch line
    all="$(discord_installs)"
    targets=()
    for branch in stable canary ptb; do
        while IFS= read -r line; do
            if [ -n "$line" ] && [ "${line%%|*}" = "$branch" ]; then targets+=("$line"); fi
        done <<<"$all"
        if [ "${#targets[@]}" -gt 0 ]; then return 0; fi
    done
    return 0
}

# May this user change what is in a folder? Not where a package or a system-wide Flatpak put Discord.
can_change() { [ -w "$1" ]; }

# How an install is called in the messages.
install_name() { # the folder, "flatpak" or nothing
    if [ "$2" = flatpak ]; then printf '%s (Flatpak)\n' "$1"; else printf '%s\n' "$1"; fi
}

is_vencord_source() { [ -n "$1" ] && [ -f "$1/scripts/build/build.mjs" ] && [ -f "$1/package.json" ]; }

# Discord is pointed at Vencord by a tiny file that says require(".../dist/patcher.js"). Prints that path.
patcher_target() {
    local file="$1"
    [ -f "$file" ] || return 0
    [ "$(wc -c <"$file")" -le 4096 ] || return 0
    { LC_ALL=C grep -a -o 'require("[^"]*patcher\.js")' "$file" || true; } | head -n 1 | sed -e 's/^require("//' -e 's/")$//'
}

# Prints the Vencord source build that the Discord with this resources folder loads, if it loads one.
vencord_loaded_by() {
    local target dir i
    target="$(patcher_target "$1/app.asar")"
    # the file it names may itself only pass on to another build, so follow it once
    for i in 1 2; do
        if [ -z "$target" ]; then break; fi
        dir="$(dirname "$(dirname "$target")")"
        if is_vencord_source "$dir"; then
            printf '%s\n' "$dir"
            return 0
        fi
        target="$(patcher_target "$target")"
    done
    return 0
}

# A Vencord source build that is already in use: the one a Discord loads, or the one Vesktop is set to.
find_vencord_in_use() {
    local res dir base dist
    while IFS='|' read -r _ _ res _ _; do
        if [ -z "$res" ]; then continue; fi
        dir="$(vencord_loaded_by "$res")"
        if [ -n "$dir" ]; then
            printf '%s\n' "$dir"
            return 0
        fi
    done < <(discord_installs)
    while IFS= read -r base; do
        [ -f "$base/vesktop/settings.json" ] || continue
        dist="$(sed -n 's/.*"vencordDir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$base/vesktop/settings.json" | head -n 1)"
        [ -n "$dist" ] || continue
        dir="$(dirname "$dist")"
        if is_vencord_source "$dir"; then
            printf '%s\n' "$dir"
            return 0
        fi
    done < <(config_dirs)
    return 0
}

# pnpm, however it can be had: installed, or fetched for this one run by npx (which comes with Node.js), in
# the version Vencord asks for. Node's corepack is the last resort: older ones can't run newer pnpm.
run_pnpm() {
    local dir="$1" wanted
    shift
    if have pnpm; then
        (cd "$dir" && pnpm "$@")
    elif have npx; then
        wanted="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\(pnpm@[0-9.]*\)".*/\1/p' "$dir/package.json" | head -n 1)"
        (cd "$dir" && npx --yes "${wanted:-pnpm}" "$@")
    else
        (cd "$dir" && corepack pnpm "$@")
    fi
}

build_vencord() { (cd "$1" && node --require=./scripts/suppressExperimentalWarnings.js scripts/build/build.mjs); }

# Prints the id git gives a file's contents. Windows line ends count as plain ones, as they do in the
# repo. Prints nothing if this computer has no program to work it out with.
git_id() {
    local size sum=""
    if have sha1sum; then sum="sha1sum"; elif have shasum; then sum="shasum"; else return 0; fi
    size="$(tr -d '\r' <"$1" | wc -c | tr -d '[:space:]')"
    { printf 'blob %s\0' "$size"; tr -d '\r' <"$1"; } | "$sum" | cut -d ' ' -f 1
}

# Prints whether a file with this id is one of the versions the repo has had: yes, no, or unknown when
# GitHub can't be asked. Only the id goes to GitHub, nothing of the file itself.
repo_version() {
    local code=""
    if [ -n "$1" ] && have curl; then
        code="$(curl -s -o /dev/null -I -m 15 -A discord-rice-installer -w '%{http_code}' "https://api.github.com/repos/$REPO/git/blobs/$1" 2>/dev/null || true)"
    fi
    case "$code" in
        200) echo yes ;;
        404) echo no ;;
        *) echo unknown ;;
    esac
}

# A theme file that is about to be replaced and is not one of the repo's own versions was changed by
# hand, so it is kept next to the new one as .bak. When GitHub can't say, it is kept to be safe.
asked_id=""
asked_answer=""
backup_edited_theme() { # the file that is there, the new file's id, the mod's name
    local id
    [ -f "$1" ] || return 0
    if cmp -s "$1" "$src/$THEME_FILE"; then return 0; fi
    id="$(git_id "$1")"
    if [ -n "$id" ] && [ "$id" = "$2" ]; then return 0; fi
    if [ -z "$id" ] || [ "$id" != "$asked_id" ]; then
        asked_id="$id"
        asked_answer="$(repo_version "$id")"
    fi
    if [ "$asked_answer" = yes ]; then return 0; fi
    cp "$1" "$1.bak"
    if [ "$asked_answer" = no ]; then
        warn "$3: the theme file here was edited. Your version is kept next to the new one as $THEME_FILE.bak."
        info "  Changes made in the discord-rice window, QuickCSS or Custom CSS are not in that file and stay as they are."
    else
        info "$3: GitHub couldn't say whether the theme file here was edited, so it is kept as $THEME_FILE.bak."
    fi
}

# Puts the theme into one mod's themes folder, and BetterDiscord's plugins into its plugins folder.
put_theme() { # the mod's folder, the mod's name
    local themes="$1/themes" plugins plugin
    if [ -z "$theme_id" ]; then theme_id="$(git_id "$src/$THEME_FILE")"; fi
    mkdir -p "$themes"
    backup_edited_theme "$themes/$THEME_FILE" "$theme_id" "$2"
    cp "$src/$THEME_FILE" "$themes/"
    info "$2: $themes"
    if [ "$2" = "BetterDiscord" ]; then
        plugins="$1/plugins"
        mkdir -p "$plugins"
        for plugin in "$src"/betterdiscord/*.plugin.js; do
            if [ "$theme_only" = 1 ] && [ "$(basename "$plugin")" != "$BD_UPDATER" ]; then continue; fi
            cp "$plugin" "$plugins/"
            info "$2: plugin $(basename "$plugin" .plugin.js)"
        done
    fi
}

install_theme() {
    local i
    step "Theme"
    for i in "${!mod_names[@]}"; do
        put_theme "${mod_dirs[$i]}" "${mod_names[$i]}"
    done
}

# Prints the folder of Orion in a Vencord build's userplugins, whatever it is called there.
find_orion() {
    local folder
    for folder in "$1"/*/; do
        if [ -f "${folder}orion.ts" ] && [ -f "${folder}index.tsx" ]; then
            printf '%s\n' "${folder%/}"
            return 0
        fi
    done
    return 0
}

ask_orion() {
    printf '\n'
    info "Orion (github.com/nyxxbit/discord-quest-completer) is somebody else's Vencord plugin. It completes"
    info "Discord Quests without playing them. It is not part of discord-rice and not checked by it: saying"
    info "yes downloads its newest code from its own repo into this Vencord build."
    warn "Its own README says Discord has been restricting accounts for quest automation since April 2026."
    ask "  Add Orion too?"
}

# Fetches Orion into the build, or updates the copy that is there. Sets $orion_state.
install_orion() {
    local userplugins="$1" existing
    existing="$(find_orion "$userplugins")"
    if [ -n "$existing" ] && [ -e "$existing/.git" ]; then
        info "Orion: updating $existing ..."
        orion_before="$(git -C "$existing" rev-parse HEAD)"
        if git -C "$existing" pull --ff-only; then
            orion_state="updated"
            orion_dir="$existing"
        else
            warn "Orion couldn't be updated (git pull failed). The copy that is there is kept."
            orion_state="present"
        fi
    elif [ -n "$existing" ]; then
        info "Orion is already in this build ($existing), not as a git download, so it is left as it is."
        orion_state="present"
    else
        info "Orion: downloading $ORION_REPO ..."
        if git clone --depth 1 "$ORION_REPO" "$userplugins/$ORION_FOLDER"; then
            orion_state="added"
            orion_dir="$userplugins/$ORION_FOLDER"
        else
            warn "Orion could not be downloaded. Carrying on without it."
        fi
    fi
}

# Vencord no longer builds, and this run brought Orion in or updated it: take that back.
undo_orion() {
    if [ "$orion_state" = "added" ]; then
        warn "Vencord doesn't build with Orion in it, so Orion is taken out again."
        rm -rf "$orion_dir"
    elif [ "$orion_state" = "updated" ] && [ -n "$orion_before" ]; then
        warn "Vencord doesn't build with the updated Orion, so Orion is put back to how it was."
        git -C "$orion_dir" reset --hard "$orion_before"
    else
        return 1
    fi
    orion_state=""
}

# Notes next to the build which plugin files it was made from. A Flatpak Discord can't see Vencord's source,
# only the build folder; with this note RiceUpdater can still tell there that the plugins on GitHub are newer.
write_stamp() {
    local out="$1/dist/discord-rice-plugins.txt" file id
    if [ ! -d "$1/dist" ]; then return 0; fi
    : >"$out"
    while IFS= read -r file; do
        id="$(git_id "$src/vencord-plugins/$file")"
        if [ -z "$id" ]; then
            # no program here to work the ids out with: better no note than half of one
            rm -f "$out"
            return 0
        fi
        printf '%s %s\n' "$id" "$file" >>"$out"
    done < <(cd "$src/vencord-plugins" && find . -type f | sed 's|^\./||' | LC_ALL=C sort)
}

# The command that points one install at the build as administrator. Vencord's installer is told where the
# build is the same way its own script (scripts/runInstaller.mjs) tells it.
root_command() { # the Vencord folder, Vencord's installer, the install's folder
    printf 'sudo env VENCORD_USER_DATA_DIR=%q VENCORD_DEV_INSTALL=1 %q --install --location %q\n' "$1" "$2" "$3"
}

# Points every install in $targets at the build in $1, with Vencord's own installer. Sets not_loaded when
# none of them loads the build afterwards.
point_discord() {
    local dir="$1" line loc res base kind cli="" loaded=0 names=""
    local todo=() as_root=() missed=()

    for line in "${targets[@]}"; do
        IFS='|' read -r _ loc res base kind <<<"$line"
        if [ "$(vencord_loaded_by "$res")" = "$dir" ]; then
            info "Already loads this build: $(install_name "$loc" "$kind")"
        else
            todo+=("$line")
        fi
    done

    if [ "${#todo[@]}" -gt 0 ]; then
        if pgrep -x Discord >/dev/null 2>&1 || pgrep -x discord >/dev/null 2>&1; then
            warn "Discord is running. Quit it completely first."
            if has_tty; then
                printf '  Press Enter when it is closed ' >/dev/tty
                read -r _ </dev/tty || true
            fi
        fi
        case "$(uname -s)" in
            Darwin) cli="$dir/dist/Installer/VencordInstallerCli-darwin" ;;
            *) cli="$dir/dist/Installer/VencordInstallerCli-linux" ;;
        esac
        # Vencord's own script downloads its installer into the build folder. Asked for its version, it does
        # only that; the installer is then told which Discord to change, one at a time
        info "Fetching Vencord's installer ..."
        (cd "$dir" && node scripts/runInstaller.mjs -- --version) || true
        if [ ! -x "$cli" ]; then
            not_loaded=1
            warn "Vencord's installer could not be downloaded, so Discord does not load the build yet."
            info "Run this again later. Or, in $dir:  node scripts/runInstaller.mjs -- --install"
            return 0
        fi

        for line in "${todo[@]}"; do
            IFS='|' read -r _ loc res base kind <<<"$line"
            if can_change "$res"; then
                info "Pointing Discord at the build: $(install_name "$loc" "$kind")"
                VENCORD_USER_DATA_DIR="$dir" VENCORD_DEV_INSTALL=1 "$cli" --install --location "$loc" || true
            else
                as_root+=("$line")
            fi
        done

        if [ "${#as_root[@]}" -gt 0 ]; then
            info "Installed for the whole system, so only an administrator may change it:"
            for line in "${as_root[@]}"; do
                IFS='|' read -r _ loc res base kind <<<"$line"
                info "  $(install_name "$loc" "$kind")"
            done
            info "The same step as administrator:"
            for line in "${as_root[@]}"; do
                IFS='|' read -r _ loc res base kind <<<"$line"
                info "  $(root_command "$dir" "$cli" "$loc")"
            done
            if have sudo && ask_yes "  Run that now? (sudo asks for your password)"; then
                for line in "${as_root[@]}"; do
                    IFS='|' read -r _ loc res base kind <<<"$line"
                    sudo env VENCORD_USER_DATA_DIR="$dir" VENCORD_DEV_INSTALL=1 "$cli" --install --location "$loc" || true
                done
            fi
        fi
    fi

    # Vencord's installer doesn't say whether it worked, so look
    for line in "${targets[@]}"; do
        IFS='|' read -r _ loc res base kind <<<"$line"
        if [ "$(vencord_loaded_by "$res")" = "$dir" ]; then
            loaded=$((loaded + 1))
        else
            missed+=("$line")
            names="$names${names:+, }$(install_name "$loc" "$kind")"
        fi
    done

    if [ "${#missed[@]}" -eq 0 ]; then return 0; fi
    if [ "$loaded" = 0 ]; then
        not_loaded=1
        warn "Couldn't confirm that Discord loads this build."
        info "Run this in a terminal yourself, then fully restart Discord:"
    else
        warn "Left as it was: $names"
        info "If that is the Discord you start, run this in a terminal, then fully restart Discord:"
    fi
    for line in "${missed[@]}"; do
        IFS='|' read -r _ loc res base kind <<<"$line"
        if can_change "$res" || [ ! -x "$cli" ]; then
            info "  (cd $(printf '%q' "$dir") && node scripts/runInstaller.mjs -- --install --location $(printf '%q' "$loc"))"
        else
            info "  $(root_command "$dir" "$cli" "$loc")"
        fi
    done
}

# Sets $built_dir when the plugins are in and built.
install_plugins() {
    local in_use dir node_major needed plugin name existing i line base kind tried=0 uses_vesktop=0
    step "Vencord plugins"

    if ! have git || ! have node; then
        if install_the_tools; then tried=1; fi
    fi
    if ! have git || ! have node; then
        if [ "$tried" = 1 ]; then
            warn "git and Node.js are still not both there. Open a new terminal and run this again."
        else
            warn "The plugins need git and Node.js (https://nodejs.org), and at least one is missing."
            info "Install them with your package manager and run this again. Nothing was changed for the plugins."
        fi
        return 0
    fi

    in_use="$(find_vencord_in_use)"
    dir="${vencord_dir:-${in_use:-$HOME/Vencord}}"
    case "$dir" in
        /*) ;;
        *) dir="$PWD/$dir" ;;
    esac

    # asked now, before the slow part, so the rest can run unattended
    if [ "$want_orion" = 0 ] && [ -z "$(find_orion "$dir/src/userplugins")" ]; then
        if ask_orion; then want_orion=1; fi
    fi

    if is_vencord_source "$dir"; then
        info "Vencord source: $dir"
    elif [ -e "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then
        die "$dir exists but isn't a Vencord source folder. Pass another one with --vencord-dir."
    else
        info "Downloading Vencord's source to $dir ..."
        git clone "$VENCORD_REPO" "$dir"
    fi

    node_major="$(node -p "process.versions.node.split('.')[0]")"
    needed="$(sed -n 's/.*"node"[[:space:]]*:[[:space:]]*"[^0-9]*\([0-9][0-9]*\).*/\1/p' "$dir/package.json" | head -n 1)"
    needed="${needed:-18}"
    if [ "$node_major" -lt "$needed" ]; then
        warn "Vencord needs Node.js $needed or newer; this computer has $node_major, and package managers often"
        info "carry an older one. Get a current Node.js from https://nodejs.org (or with nvm) and run this again."
        return 0
    fi

    mkdir -p "$dir/src/userplugins"
    for plugin in "$src"/vencord-plugins/*/; do
        name="$(basename "$plugin")"
        rm -rf "$dir/src/userplugins/$name"
        cp -R "${plugin%/}" "$dir/src/userplugins/$name"
        info "plugin: $name"
    done
    existing="$(find_orion "$dir/src/userplugins")"
    if [ "$want_orion" = 1 ]; then
        install_orion "$dir/src/userplugins"
    elif [ -n "$existing" ]; then
        info "Orion is already in this build ($existing) and stays as it is."
        orion_state="present"
    fi

    if [ ! -d "$dir/node_modules" ]; then
        info "Fetching what Vencord's build needs (pnpm install) ..."
        run_pnpm "$dir" install --frozen-lockfile
    fi
    info "Building Vencord ..."
    if ! build_vencord "$dir"; then
        # a Vencord checkout that was updated since its packages were last fetched
        warn "The build failed. Fetching packages again and retrying once ..."
        if ! { run_pnpm "$dir" install --frozen-lockfile && build_vencord "$dir"; }; then
            # still no build: if this run brought Orion in, see whether Vencord builds without it
            undo_orion || die "Vencord doesn't build; the messages above say why."
            build_vencord "$dir"
        fi
    fi

    write_stamp "$dir"

    find_targets
    # Vencord keeps its themes next to the settings folder of the Discord it runs in, which for a Flatpak is
    # not where the others are. So each Discord the build is for gets the theme there, also when pointing
    # it at the build is left to you (--no-inject) or to the sudo step
    for line in "${targets[@]}"; do
        IFS='|' read -r _ _ _ base kind <<<"$line"
        if [ "$kind" = flatpak ]; then flatpak_target=1; else plain_target=1; fi
        if add_mod "Vencord" "$base/Vencord"; then put_theme "$base/Vencord" "Vencord"; fi
    done
    if [ "$no_inject" = 1 ]; then
        info "Not pointing Discord at the build (--no-inject)."
    elif [ "${#targets[@]}" -gt 0 ]; then
        point_discord "${dir%/}"
    else
        for i in "${!mod_names[@]}"; do
            if [ "${mod_names[$i]}" = "Vesktop" ]; then uses_vesktop=1; fi
        done
        if [ "$uses_vesktop" = 0 ]; then
            not_loaded=1
            warn "Found no Discord app on this computer, so nothing points at the build yet."
            info "Install Discord (not the snap: Vencord can't change that one) and run this again."
        fi
    fi
    for i in "${!mod_names[@]}"; do
        if [ "${mod_names[$i]}" = "Vesktop" ]; then
            info "Vesktop: set Settings > Vesktop Settings > Vencord Location to $dir/dist"
            break
        fi
    done
    built_dir="$dir"
}

uninstall_all() {
    local i dir file plugin name removed=0
    step "Removing discord-rice"
    for i in "${!mod_names[@]}"; do
        dir="${mod_dirs[$i]}"
        for file in "$dir/themes/$THEME_FILE" "$dir/themes/$THEME_FILE.bak" "$dir/discord-rice-updater.json"; do
            if [ -f "$file" ]; then
                rm -f "$file"
                info "removed $file"
            fi
        done
        for plugin in "$src"/betterdiscord/*.plugin.js; do
            name="$(basename "$plugin" .plugin.js)"
            for file in "$dir/plugins/$name.plugin.js" "$dir/plugins/$name.plugin.js.bak" "$dir/plugins/$name.config.json"; do
                if [ -f "$file" ]; then
                    rm -f "$file"
                    info "removed $file"
                fi
            done
        done
    done

    dir="${vencord_dir:-$(find_vencord_in_use)}"
    dir="${dir:-$HOME/Vencord}"
    is_vencord_source "$dir" || return 0
    for plugin in "$src"/vencord-plugins/*/; do
        name="$(basename "$plugin")"
        if [ -d "$dir/src/userplugins/$name" ]; then
            rm -rf "$dir/src/userplugins/$name"
            info "removed $dir/src/userplugins/$name"
            removed=1
        fi
    done
    rm -f "$dir/dist/discord-rice-plugins.txt"
    if [ "$removed" = 1 ] && have node && [ -d "$dir/node_modules" ]; then
        info "Building Vencord without the plugins ..."
        build_vencord "$dir"
        info "Restart Discord to finish."
    fi
    plugin="$(find_orion "$dir/src/userplugins")"
    if [ -n "$plugin" ]; then
        info "Orion ($plugin) is somebody else's plugin and stays. Delete that folder to remove it."
    fi
}

printf '\033[1mdiscord-rice installer\033[0m\n'
get_source
find_mods

if [ "$uninstall" = 1 ]; then
    uninstall_all
    exit 0
fi

if [ "${#mod_names[@]}" -eq 0 ] && [ "$want_plugins" = 0 ] && [ "$theme_only" = 0 ]; then
    # plain Discord with no mod yet: this script can bring Vencord itself, as the build the plugins need
    info "Found no Vencord, Vesktop or BetterDiscord on this computer."
    info "This script can set Vencord up for you: built from its source, with the discord-rice plugins in it."
    info "That needs git and Node.js, which it offers to install if they are missing."
    if ask_yes "  Set up Vencord with the theme and the plugins now?"; then want_plugins=1; fi
fi
if [ "${#mod_names[@]}" -eq 0 ] && [ "$want_plugins" = 0 ]; then
    warn "Nothing was installed: there is no Vencord, Vesktop or BetterDiscord here to put the theme in."
    info "To set up Vencord with the theme and the plugins without being asked anything, run:"
    info "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- --plugins --install-tools"
    info "Or install a mod yourself first (https://vencord.dev or https://betterdiscord.app) and run this again."
    exit 0
fi
if [ "${#mod_names[@]}" -eq 0 ]; then
    # Vencord is about to be set up from source; its data folder is where the theme goes. That folder is
    # next to the settings folder of each Discord it is set up for (somewhere else for a Flatpak Discord)
    no_mod_at_start=1
    find_targets
    for line in "${targets[@]}"; do
        IFS='|' read -r _ _ _ base _ <<<"$line"
        add_mod "Vencord" "$base/Vencord" || true
    done
    if [ "${#mod_names[@]}" -eq 0 ]; then add_mod "Vencord" "$(config_dirs | head -n 1)/Vencord"; fi
else
    info "Found: $(printf '%s, ' "${mod_names[@]}" | sed 's/, $//')"
fi

install_theme

for_vencord=0
for_bd=0
for name in "${mod_names[@]}"; do
    if [ "$name" = "BetterDiscord" ]; then for_bd=1; else for_vencord=1; fi
done

if [ "$for_vencord" = 1 ] && [ "$theme_only" = 0 ] && [ "$want_plugins" = 0 ]; then
    printf '\n'
    info "The plugins (settings window, folder looks, code block button, updater) are for Vencord."
    info "They need Vencord built from its source, which this script can set up (needs git and Node.js)."
    if ask "  Set up the plugins too?"; then want_plugins=1; fi
fi
if [ "$want_plugins" = 1 ] && [ "$theme_only" = 0 ]; then install_plugins; fi

step "Done"
if [ -n "$built_dir" ] && [ "$not_loaded" = 1 ]; then
    warn "Vencord with the plugins is built in $built_dir, but Discord does not load it yet: see above."
    info "Once it does:"
elif [ -n "$built_dir" ]; then
    info "Fully restart Discord (quit it completely, then start it again)."
fi
if [ -n "$built_dir" ]; then
    info "The plugins are on by default; the rice bowl button in the channel header opens the settings."
    if [ "$flatpak_target" = 1 ] && [ "$plain_target" = 0 ]; then
        info "RiceUpdater keeps the theme file up to date from GitHub from now on. A Flatpak Discord can't build"
        info "Vencord, so for the plugins it tells you when GitHub has new ones: run this installer again then."
    else
        info "RiceUpdater keeps the theme file and the plugins up to date from GitHub from now on."
        if [ "$flatpak_target" = 1 ]; then
            info "The Flatpak Discord can't build Vencord, so in that one it only updates the theme, and tells you"
            info "when GitHub has new plugins: run this installer again then."
        fi
    fi
    if [ "$orion_state" = "added" ] || [ "$orion_state" = "updated" ]; then
        info "Orion: turn on OrionQuests under Settings > Vencord > Plugins. RiceUpdater leaves it alone;"
        info "run this installer again with --orion to update it."
    fi
fi
if [ "$no_mod_at_start" = 1 ] && [ -z "$built_dir" ]; then
    warn "Vencord was not set up, so Discord looks the same as before. See the messages above, then run this again."
elif [ "$for_vencord" = 1 ]; then
    info "Vencord: turn the theme on under Settings > Vencord > Themes > discord-rice."
    if [ -z "$built_dir" ]; then
        info "Without the plugins the theme file does not update itself. For that, use the online link"
        info "from the README instead of the file, or run this again with --plugins."
    fi
fi
if [ "$for_bd" = 1 ]; then
    info "BetterDiscord: turn on discord-rice under Settings > Themes, and the plugins under Settings >"
    info "Plugins. DiscordRiceUpdater is the one that keeps the theme and the others up to date."
fi
