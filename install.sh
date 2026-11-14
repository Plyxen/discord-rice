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
    sh -c "$command" || warn "That did not finish cleanly."
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

# Has Discord's own app (not Vesktop) been used here?
has_discord() {
    local base name
    while IFS= read -r base; do
        for name in discord discordptb discordcanary discorddevelopment Discord; do
            [ -d "$base/$name" ] && return 0
        done
    done < <(config_dirs)
    return 1
}

is_vencord_source() { [ -n "$1" ] && [ -f "$1/scripts/build/build.mjs" ] && [ -f "$1/package.json" ]; }

# Discord is pointed at Vencord by a tiny file that says require(".../dist/patcher.js"). Prints that path.
patcher_target() {
    local file="$1"
    [ -f "$file" ] || return 0
    [ "$(wc -c <"$file")" -le 4096 ] || return 0
    { LC_ALL=C grep -a -o 'require("[^"]*patcher\.js")' "$file" || true; } | head -n 1 | sed -e 's/^require("//' -e 's/")$//'
}

# A Vencord source build that is already in use: the one Discord loads, or the one Vesktop is set to.
find_vencord_in_use() {
    local asar target dir i base dist
    for asar in \
        "/Applications/Discord.app/Contents/Resources/app.asar" \
        "/usr/share/discord/resources/app.asar" \
        "/usr/lib/discord/resources/app.asar" \
        "/usr/lib64/discord/resources/app.asar" \
        "/opt/discord/resources/app.asar" \
        "/opt/Discord/resources/app.asar" \
        "$HOME/.local/share/Discord/resources/app.asar" \
        "/var/lib/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources/app.asar" \
        "$HOME/.local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources/app.asar"; do
        target="$(patcher_target "$asar")"
        # the file it names may itself only pass on to another build, so follow it once
        for i in 1 2; do
            [ -n "$target" ] || break
            dir="$(dirname "$(dirname "$target")")"
            if is_vencord_source "$dir"; then
                printf '%s\n' "$dir"
                return 0
            fi
            target="$(patcher_target "$target")"
        done
    done
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

install_theme() {
    local i themes plugins plugin new_id
    step "Theme"
    new_id="$(git_id "$src/$THEME_FILE")"
    for i in "${!mod_names[@]}"; do
        themes="${mod_dirs[$i]}/themes"
        mkdir -p "$themes"
        backup_edited_theme "$themes/$THEME_FILE" "$new_id" "${mod_names[$i]}"
        cp "$src/$THEME_FILE" "$themes/"
        info "${mod_names[$i]}: $themes"
        if [ "${mod_names[$i]}" = "BetterDiscord" ]; then
            plugins="${mod_dirs[$i]}/plugins"
            mkdir -p "$plugins"
            for plugin in "$src"/betterdiscord/*.plugin.js; do
                if [ "$theme_only" = 1 ] && [ "$(basename "$plugin")" != "$BD_UPDATER" ]; then continue; fi
                cp "$plugin" "$plugins/"
                info "${mod_names[$i]}: plugin $(basename "$plugin" .plugin.js)"
            done
        fi
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

# Sets $built_dir when the plugins are in and built.
install_plugins() {
    local in_use dir node_major needed plugin name now existing tried=0
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

    if [ -n "$in_use" ] && [ "${in_use%/}" = "${dir%/}" ]; then
        info "Discord (or Vesktop) already loads this build."
    elif [ "$no_inject" = 1 ]; then
        info "Not pointing Discord at the build (--no-inject)."
    elif has_discord; then
        if pgrep -x Discord >/dev/null 2>&1 || pgrep -x discord >/dev/null 2>&1; then
            warn "Discord is running. Quit it completely first."
            if has_tty; then
                printf '  Press Enter when it is closed ' >/dev/tty
                read -r _ </dev/tty || true
            fi
        fi
        info "Pointing Discord at the build with Vencord's installer ..."
        (cd "$dir" && node scripts/runInstaller.mjs -- --install --branch auto) || true
        # Vencord's installer doesn't say whether it worked, so look
        now="$(find_vencord_in_use)"
        if [ "${now%/}" != "${dir%/}" ]; then
            warn "Couldn't confirm that Discord loads this build. If Vencord's installer said it has no"
            info "permission, run it yourself with sudo, in $dir:"
            info "  sudo node scripts/runInstaller.mjs -- --install"
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

if [ "${#mod_names[@]}" -eq 0 ] && [ "$want_plugins" = 0 ]; then
    warn "Found no Vencord, Vesktop or BetterDiscord on this computer."
    info "Install one first (https://vencord.dev or https://betterdiscord.app) and run this again,"
    info "or run it with --plugins to set up Vencord from its source together with the plugins."
    exit 0
fi
if [ "${#mod_names[@]}" -eq 0 ]; then
    # Vencord is about to be set up from source; its data folder is where the theme goes
    mod_names=("Vencord")
    mod_dirs=("$(config_dirs | head -n 1)/Vencord")
fi
info "Found: $(printf '%s, ' "${mod_names[@]}" | sed 's/, $//')"

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
if [ -n "$built_dir" ]; then
    info "Fully restart Discord (quit it completely, then start it again)."
    info "The plugins are on by default; the rice bowl button in the channel header opens the settings."
    info "RiceUpdater keeps the theme file and the plugins up to date from GitHub from now on."
    if [ "$orion_state" = "added" ] || [ "$orion_state" = "updated" ]; then
        info "Orion: turn on OrionQuests under Settings > Vencord > Plugins. RiceUpdater leaves it alone;"
        info "run this installer again with --orion to update it."
    fi
fi
if [ "$for_vencord" = 1 ]; then
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
