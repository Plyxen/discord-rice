<#
.SYNOPSIS
    Installs discord-rice on Windows: the theme and the plugins, for Vencord, Vesktop and BetterDiscord.

.DESCRIPTION
    Run it from a copy of the repo, or straight from GitHub:

        irm https://raw.githubusercontent.com/Plyxen/discord-rice/main/install.ps1 | iex

    What it does, in this order:
      1. Copies the theme into the themes folder of every mod it finds (Vencord, Vesktop, BetterDiscord).
      2. BetterDiscord: also copies its plugins (the settings window, folder looks, the code block button
         and the updater). They are single files, so there is nothing more to it.
      3. Vencord, if you say yes: sets up the plugins. Vencord only takes extra plugins when it is built
         from its source, so this finds your source build or downloads one (git clone), copies the plugin
         folders into it, builds it, and points Discord at the build with Vencord's own installer.
         That needs Git and Node.js. If one is missing, the script offers to install it with winget, the
         installer that comes with Windows, and does so only if you say yes.
         With the plugins it also asks about Orion, which is somebody else's plugin (see -Orion).

    Run it again whenever you like: it replaces what it installed and leaves everything else alone.

.PARAMETER ThemeOnly
    The theme only, without asking about the plugins. BetterDiscord still gets the updater plugin, so the
    theme keeps itself up to date.

.PARAMETER Plugins
    Also do step 3, without asking.

.PARAMETER InstallTools
    With the plugins, install Git and Node.js with winget without asking, if they are missing.

.PARAMETER Orion
    With the plugins, also add Orion (github.com/nyxxbit/discord-quest-completer) without asking, or update
    it if this script added it before. Orion completes Discord Quests without playing them. It is not part
    of discord-rice: its newest code is downloaded from its own repo into the same Vencord build, and its
    README warns that Discord has been restricting accounts for quest automation since April 2026.

.PARAMETER VencordDir
    Where the Vencord source is, or where to download it to. Default: the build Discord already uses if
    there is one, otherwise a "Vencord" folder in your user folder.

.PARAMETER NoInject
    Build Vencord with the plugins, but don't point Discord at the build.

.PARAMETER Uninstall
    Remove what this script installed: the theme files, the BetterDiscord plugins, and the Vencord plugin
    folders (Vencord is rebuilt without them). Vencord and BetterDiscord themselves stay.

.EXAMPLE
    .\install.ps1 -Plugins

.EXAMPLE
    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Plyxen/discord-rice/main/install.ps1))) -ThemeOnly
#>
[CmdletBinding()]
param(
    [switch]$ThemeOnly,
    [switch]$Plugins,
    [switch]$InstallTools,
    [switch]$Orion,
    [string]$VencordDir,
    [switch]$NoInject,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # the download bar makes Windows PowerShell crawl

$Repo = 'Plyxen/discord-rice'
$ThemeFile = 'discord-rice.theme.css'
$BdUpdater = 'DiscordRiceUpdater.plugin.js' # the one BetterDiscord plugin that also goes in with -ThemeOnly
$VencordRepo = 'https://github.com/Vendicated/Vencord'
$TempDir = $null
$BuiltDir = $null # the Vencord folder, once the plugins are in and built
$OrionRepo = 'https://github.com/nyxxbit/discord-quest-completer'
$OrionFolder = 'discord-quest-completer' # the folder name Orion's own guide uses
$OrionState = $null # 'added' or 'updated' when this run brought Orion in, 'present' when it was there already
$OrionDir = $null
$OrionBefore = $null # the commit Orion was at before this run updated it

function Step([string]$Text) { Write-Host "`n> $Text" -ForegroundColor Cyan }
function Info([string]$Text) { Write-Host "  $Text" }
function Warn([string]$Text) { Write-Host "  ! $Text" -ForegroundColor Yellow }
# The program file behind a command name (git.exe, npx.cmd), or nothing. Only real programs count: npm also
# ships .ps1 wrappers (npx.ps1, pnpm.ps1) that re-read the command line as it was typed, which goes wrong
# when a script calls them.
function Find-Tool([string]$Command) {
    $found = Get-Command $Command -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.Source }
    return $null
}
function Have([string]$Command) { [bool](Find-Tool $Command) }

# Asks a yes/no question. $Default is the answer to just pressing Enter. Without a keyboard to ask (a
# script, a scheduled run) the answer is $Unattended, which is no unless said otherwise.
function Ask([string]$Question, [bool]$Default = $false, [bool]$Unattended = $false) {
    $hint = '[y/N]'
    if ($Default) { $hint = '[Y/n]' }
    try { $answer = Read-Host "$Question $hint" } catch { return $Unattended }
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer.Trim() -match '^(y|yes)$'
}

# What the plugins need besides Vencord: the command to look for, the name to show, its winget id.
$Tools = @(
    [pscustomobject]@{ Command = 'git'; Name = 'Git'; Id = 'Git.Git'; Link = 'https://git-scm.com' },
    [pscustomobject]@{ Command = 'node'; Name = 'Node.js'; Id = 'OpenJS.NodeJS.LTS'; Link = 'https://nodejs.org' }
)

# A program installed a moment ago is on the PATH Windows keeps, but not yet on this window's copy of it.
function Update-Path {
    $fresh = @([Environment]::GetEnvironmentVariable('Path', 'Machine'), [Environment]::GetEnvironmentVariable('Path', 'User')) -join ';'
    $known = $env:Path -split ';'
    $added = $fresh -split ';' | Where-Object { $_ -and ($known -notcontains $_) }
    if ($added) { $env:Path = ($env:Path.TrimEnd(';') + ';' + ($added -join ';')) }
}

# Installs the given tools with winget, after asking. True if it went and tried.
function Install-Tools($Wanted) {
    $names = ($Wanted | ForEach-Object { $_.Name }) -join ' and '
    if (-not (Have winget)) { return $false }
    if (-not $InstallTools) {
        Info "The plugins need $names, which this PC doesn't have yet (or has too old)."
        Info 'It can be installed now with winget, the installer that comes with Windows. Windows will ask'
        Info 'for your permission while it does.'
        if (-not (Ask "  Install $names now?" $true $false)) { return $false }
    }
    foreach ($tool in $Wanted) {
        Info "Installing $($tool.Name) ..."
        & (Find-Tool winget) install --id $tool.Id --exact --source winget --silent | Out-Host
        if ($LASTEXITCODE -ne 0) { Warn "winget did not finish installing $($tool.Name) (exit code $LASTEXITCODE)." }
    }
    Update-Path
    return $true
}

# Runs a program in a folder and stops the script if it fails.
function Invoke-Tool([string]$Dir, [string]$Exe, [string[]]$Arguments) {
    $program = Find-Tool $Exe
    if (-not $program) { throw "$Exe was not found." }
    Push-Location $Dir
    try {
        & $program @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$Exe $($Arguments -join ' ') failed (exit code $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }
}

# The discord-rice files: the folder this script is in, or a fresh download of the repo.
function Get-Source {
    if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot $ThemeFile))) { return $PSScriptRoot }
    Info "Downloading github.com/$Repo ..."
    $script:TempDir = Join-Path ([IO.Path]::GetTempPath()) ('discord-rice-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $script:TempDir | Out-Null
    $zip = Join-Path $script:TempDir 'main.zip'
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $script:TempDir
    return (Join-Path $script:TempDir 'discord-rice-main')
}

# The mods that are installed, by their data folder.
function Get-Mods {
    foreach ($mod in @(@('Vencord', 'Vencord'), @('Vesktop', 'vesktop'), @('BetterDiscord', 'BetterDiscord'))) {
        $dir = Join-Path $env:APPDATA $mod[1]
        if (Test-Path $dir) { [pscustomobject]@{ Name = $mod[0]; Dir = $dir } }
    }
}

function Test-VencordSource([string]$Dir) {
    return [bool]$Dir -and (Test-Path (Join-Path $Dir 'scripts\build\build.mjs')) -and (Test-Path (Join-Path $Dir 'package.json'))
}

# Discord is pointed at Vencord by a tiny file that says require("...\dist\patcher.js"). Returns that path.
function Get-PatcherTarget([string]$File) {
    if (-not $File -or -not (Test-Path $File) -or (Get-Item $File).Length -gt 4096) { return $null }
    $text = [IO.File]::ReadAllText($File)
    if ($text -match 'require\("([^"]+?patcher\.js)"\)') { return ($Matches[1] -replace '\\\\', '\' -replace '/', '\') }
    return $null
}

function Get-DiscordFolders {
    foreach ($branch in @('Discord', 'DiscordPTB', 'DiscordCanary', 'DiscordDevelopment')) {
        $root = Join-Path $env:LOCALAPPDATA $branch
        if (Test-Path $root) { $root }
    }
}

# A Vencord source build that is already in use: the one Discord loads, or the one Vesktop is set to.
function Find-VencordInUse {
    foreach ($root in Get-DiscordFolders) {
        $app = Get-ChildItem $root -Directory -Filter 'app-*' | Sort-Object LastWriteTime | Select-Object -Last 1
        if (-not $app) { continue }
        $target = Get-PatcherTarget (Join-Path $app.FullName 'resources\app.asar')
        # the file it names may itself only pass on to another build, so follow it once
        for ($i = 0; $target -and $i -lt 2; $i++) {
            $dir = Split-Path (Split-Path $target -Parent) -Parent
            if (Test-VencordSource $dir) { return $dir }
            $target = Get-PatcherTarget $target
        }
    }
    $settings = Join-Path $env:APPDATA 'vesktop\settings.json'
    if (Test-Path $settings) {
        try {
            $dist = (Get-Content $settings -Raw | ConvertFrom-Json).vencordDir
            if ($dist) {
                $dir = Split-Path $dist -Parent
                if (Test-VencordSource $dir) { return $dir }
            }
        } catch { }
    }
    return $null
}

# pnpm, however it can be had: installed, or fetched for this one run by npx (which comes with Node.js), in
# the version Vencord asks for. Node's corepack is the last resort: older ones can't run newer pnpm.
function Invoke-Pnpm([string]$Dir, [string[]]$Arguments) {
    if (Have pnpm) { Invoke-Tool $Dir 'pnpm' $Arguments; return }
    if (Have npx) {
        $wanted = 'pnpm'
        try {
            $manager = (Get-Content (Join-Path $Dir 'package.json') -Raw | ConvertFrom-Json).packageManager
            if ($manager -match '^pnpm@[\d.]+$') { $wanted = $manager }
        } catch { }
        Invoke-Tool $Dir 'npx' (@('--yes', $wanted) + $Arguments)
        return
    }
    Invoke-Tool $Dir 'corepack' (@('pnpm') + $Arguments)
}

function Build-Vencord([string]$Dir) {
    Invoke-Tool $Dir 'node' @('--require=./scripts/suppressExperimentalWarnings.js', 'scripts/build/build.mjs')
}

function Install-Theme([string]$Source, $Mods) {
    Step 'Theme'
    foreach ($mod in $Mods) {
        $themes = Join-Path $mod.Dir 'themes'
        New-Item -ItemType Directory -Force -Path $themes | Out-Null
        Copy-Item -Path (Join-Path $Source $ThemeFile) -Destination $themes -Force
        Info "$($mod.Name): $themes"
        if ($mod.Name -eq 'BetterDiscord') {
            $plugins = Join-Path $mod.Dir 'plugins'
            New-Item -ItemType Directory -Force -Path $plugins | Out-Null
            foreach ($plugin in Get-ChildItem (Join-Path $Source 'betterdiscord') -Filter '*.plugin.js') {
                if ($ThemeOnly -and $plugin.Name -ne $BdUpdater) { continue }
                Copy-Item -Path $plugin.FullName -Destination $plugins -Force
                Info "$($mod.Name): plugin $($plugin.BaseName -replace '\.plugin$', '')"
            }
        }
    }
}

# The folder of Orion in a Vencord build's userplugins, whatever it is called there, or nothing.
function Find-Orion([string]$Userplugins) {
    if (-not (Test-Path $Userplugins)) { return $null }
    foreach ($folder in Get-ChildItem $Userplugins -Directory) {
        if ((Test-Path (Join-Path $folder.FullName 'orion.ts')) -and (Test-Path (Join-Path $folder.FullName 'index.tsx'))) { return $folder.FullName }
    }
    return $null
}

function Ask-Orion {
    Write-Host ''
    Info "Orion (github.com/nyxxbit/discord-quest-completer) is somebody else's Vencord plugin. It completes"
    Info 'Discord Quests without playing them. It is not part of discord-rice and not checked by it: saying'
    Info 'yes downloads its newest code from its own repo into this Vencord build.'
    Warn 'Its own README says Discord has been restricting accounts for quest automation since April 2026.'
    return (Ask '  Add Orion too?')
}

# Fetches Orion into the build, or updates the copy that is there. Sets $OrionState. Prints, returns nothing.
function Install-Orion([string]$Userplugins) {
    $existing = Find-Orion $Userplugins
    if ($existing -and (Test-Path (Join-Path $existing '.git'))) {
        Info "Orion: updating $existing ..."
        $script:OrionBefore = (& git -C $existing rev-parse HEAD)
        & git -C $existing pull --ff-only
        if ($LASTEXITCODE -eq 0) {
            $script:OrionState = 'updated'
            $script:OrionDir = $existing
        } else {
            Warn "Orion couldn't be updated (git pull failed). The copy that is there is kept."
            $script:OrionState = 'present'
        }
    } elseif ($existing) {
        Info "Orion is already in this build ($existing), not as a git download, so it is left as it is."
        $script:OrionState = 'present'
    } else {
        $target = Join-Path $Userplugins $OrionFolder
        Info "Orion: downloading $OrionRepo ..."
        & git clone --depth 1 $OrionRepo $target
        if ($LASTEXITCODE -ne 0) {
            Warn 'Orion could not be downloaded. Carrying on without it.'
            return
        }
        $script:OrionState = 'added'
        $script:OrionDir = $target
    }
}

# Vencord no longer builds, and this run brought Orion in or updated it: take that back. True if it did.
function Undo-Orion {
    if ($script:OrionState -eq 'added') {
        Warn "Vencord doesn't build with Orion in it, so Orion is taken out again."
        Remove-Item $script:OrionDir -Recurse -Force
    } elseif ($script:OrionState -eq 'updated' -and $script:OrionBefore) {
        Warn "Vencord doesn't build with the updated Orion, so Orion is put back to how it was."
        & git -C $script:OrionDir reset --hard $script:OrionBefore | Out-Host
    } else {
        return $false
    }
    $script:OrionState = $null
    return $true
}

# Sets $BuiltDir when the plugins are in and built. Returns nothing, so what git and the build print is shown.
function Install-Plugins([string]$Source) {
    Step 'Vencord plugins'

    $missing = @($Tools | Where-Object { -not (Have $_.Command) })
    if ($missing) {
        $tried = Install-Tools $missing
        $missing = @($Tools | Where-Object { -not (Have $_.Command) })
    }
    if ($missing) {
        if ($tried) {
            Warn 'Not everything is there yet. Windows may only show new programs to a new window.'
            Info 'Open a new PowerShell window and run this again.'
        } else {
            Warn 'The plugins need these, which are not installed (or not on PATH yet in this window):'
            $missing | ForEach-Object { Info "  - $($_.Name) ($($_.Link), or: winget install $($_.Id))" }
            Info 'Install them, open a new PowerShell window and run this again. Nothing was changed for the plugins.'
        }
        return
    }

    $inUse = Find-VencordInUse
    $dir = $VencordDir
    if (-not $dir) { $dir = $inUse }
    if (-not $dir) { $dir = Join-Path $HOME 'Vencord' }
    $dir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($dir)
    $userplugins = Join-Path $dir 'src\userplugins'

    # asked now, before the slow part, so the rest can run unattended
    $wantOrion = [bool]$Orion
    if (-not $wantOrion -and -not (Find-Orion $userplugins)) { $wantOrion = Ask-Orion }

    if (Test-VencordSource $dir) {
        Info "Vencord source: $dir"
    } elseif ((Test-Path $dir) -and (Get-ChildItem $dir -Force | Select-Object -First 1)) {
        throw "$dir exists but isn't a Vencord source folder. Pass another one with -VencordDir."
    } else {
        Info "Downloading Vencord's source to $dir ..."
        & git clone $VencordRepo $dir
        if ($LASTEXITCODE -ne 0) { throw 'git clone failed.' }
    }

    $nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
    $needed = 18
    try {
        $engines = (Get-Content (Join-Path $dir 'package.json') -Raw | ConvertFrom-Json).engines.node
        if ($engines -match '(\d+)') { $needed = [int]$Matches[1] }
    } catch { }
    if ($nodeMajor -lt $needed) {
        # the newer one replaces the old one where it was installed the usual way
        if (Install-Tools @($Tools | Where-Object { $_.Command -eq 'node' })) {
            $nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
        }
    }
    if ($nodeMajor -lt $needed) {
        Warn "Vencord needs Node.js $needed or newer; this PC has $nodeMajor. Update Node.js (https://nodejs.org) and run this again."
        return
    }

    New-Item -ItemType Directory -Force -Path $userplugins | Out-Null
    foreach ($plugin in Get-ChildItem (Join-Path $Source 'vencord-plugins') -Directory) {
        $target = Join-Path $userplugins $plugin.Name
        if (Test-Path $target) { Remove-Item $target -Recurse -Force }
        Copy-Item -Path $plugin.FullName -Destination $target -Recurse
        Info "plugin: $($plugin.Name)"
    }
    if ($wantOrion) {
        Install-Orion $userplugins
    } elseif (Find-Orion $userplugins) {
        Info "Orion is already in this build ($(Find-Orion $userplugins)) and stays as it is."
        $script:OrionState = 'present'
    }

    if (-not (Test-Path (Join-Path $dir 'node_modules'))) {
        Info "Fetching what Vencord's build needs (pnpm install) ..."
        Invoke-Pnpm $dir @('install', '--frozen-lockfile')
    }
    Info 'Building Vencord ...'
    try {
        Build-Vencord $dir
    } catch {
        # a Vencord checkout that was updated since its packages were last fetched
        Warn 'The build failed. Fetching packages again and retrying once ...'
        $problem = $null
        try {
            Invoke-Pnpm $dir @('install', '--frozen-lockfile')
            Build-Vencord $dir
        } catch {
            $problem = $_
        }
        if ($problem) {
            # still no build: if this run brought Orion in, see whether Vencord builds without it
            if (-not (Undo-Orion)) { throw $problem }
            Build-Vencord $dir
        }
    }

    $hasDiscord = [bool](Get-DiscordFolders)
    if ($inUse -and ($inUse.TrimEnd('\') -eq $dir.TrimEnd('\'))) {
        Info 'Discord (or Vesktop) already loads this build.'
    } elseif ($NoInject) {
        Info 'Not pointing Discord at the build (-NoInject).'
    } elseif ($hasDiscord) {
        $running = Get-Process -Name 'Discord', 'DiscordPTB', 'DiscordCanary', 'DiscordDevelopment' -ErrorAction SilentlyContinue
        if ($running) {
            Warn 'Discord is running. Quit it first: right-click its icon next to the clock > Quit Discord.'
            try { Read-Host '  Press Enter when it is closed' | Out-Null } catch { }
        }
        Info "Pointing Discord at the build with Vencord's installer ..."
        Invoke-Tool $dir 'node' @('scripts/runInstaller.mjs', '--', '--install', '--branch', 'auto')
        # Vencord's installer doesn't say whether it worked, so look
        $now = Find-VencordInUse
        if (-not $now -or ($now.TrimEnd('\') -ne $dir.TrimEnd('\'))) {
            Warn "Discord doesn't load this build yet. In $dir, run: node scripts/runInstaller.mjs -- --install"
        }
    }
    if (Test-Path (Join-Path $env:APPDATA 'vesktop')) {
        Info "Vesktop: set Settings > Vesktop Settings > Vencord Location to $(Join-Path $dir 'dist')"
    }
    $script:BuiltDir = $dir
}

function Uninstall-All([string]$Source) {
    Step 'Removing discord-rice'
    foreach ($mod in Get-Mods) {
        $files = @((Join-Path $mod.Dir "themes\$ThemeFile"), (Join-Path $mod.Dir "themes\$ThemeFile.bak"))
        if ($mod.Name -eq 'BetterDiscord') {
            foreach ($plugin in Get-ChildItem (Join-Path $Source 'betterdiscord') -Filter '*.plugin.js') {
                $name = $plugin.BaseName -replace '\.plugin$', ''
                $files += (Join-Path $mod.Dir "plugins\$($plugin.Name)"), (Join-Path $mod.Dir "plugins\$($plugin.Name).bak"), (Join-Path $mod.Dir "plugins\$name.config.json")
            }
        } else {
            $files += (Join-Path $mod.Dir 'discord-rice-updater.json')
        }
        foreach ($file in $files) {
            if (Test-Path $file) { Remove-Item $file -Force; Info "removed $file" }
        }
    }

    $dir = $VencordDir
    if (-not $dir) { $dir = Find-VencordInUse }
    if (-not $dir) { $dir = Join-Path $HOME 'Vencord' }
    if (-not (Test-VencordSource $dir)) { return }
    $removed = $false
    foreach ($plugin in Get-ChildItem (Join-Path $Source 'vencord-plugins') -Directory) {
        $target = Join-Path $dir "src\userplugins\$($plugin.Name)"
        if (Test-Path $target) { Remove-Item $target -Recurse -Force; Info "removed $target"; $removed = $true }
    }
    if ($removed -and (Have node) -and (Test-Path (Join-Path $dir 'node_modules'))) {
        Info 'Building Vencord without the plugins ...'
        Build-Vencord $dir
        Info 'Restart Discord to finish.'
    }
    $orionDir = Find-Orion (Join-Path $dir 'src\userplugins')
    if ($orionDir) { Info "Orion ($orionDir) is somebody else's plugin and stays. Delete that folder to remove it." }
}

try {
    Write-Host 'discord-rice installer' -ForegroundColor White
    $source = Get-Source

    if ($Uninstall) {
        Uninstall-All $source
        return
    }

    $mods = @(Get-Mods)
    $wantPlugins = [bool]$Plugins
    if (-not $mods -and -not $wantPlugins) {
        Warn 'Found no Vencord, Vesktop or BetterDiscord on this PC.'
        Info 'Install one first (https://vencord.dev or https://betterdiscord.app) and run this again,'
        Info 'or run it with -Plugins to set up Vencord from its source together with the plugins.'
        return
    }
    if (-not $mods) {
        # Vencord is about to be set up from source; its data folder is where the theme goes
        $mods = @([pscustomobject]@{ Name = 'Vencord'; Dir = (Join-Path $env:APPDATA 'Vencord') })
    }
    Info ('Found: ' + (($mods | ForEach-Object { $_.Name }) -join ', '))

    Install-Theme $source $mods

    $forVencord = [bool]($mods | Where-Object { $_.Name -ne 'BetterDiscord' })
    if ($forVencord -and -not $ThemeOnly -and -not $wantPlugins) {
        Write-Host ''
        Info 'The plugins (settings window, folder looks, code block button, updater) are for Vencord.'
        Info 'They need Vencord built from its source, which this script can set up (needs Git and Node.js).'
        $wantPlugins = Ask '  Set up the plugins too?'
    }
    if ($wantPlugins -and -not $ThemeOnly) { Install-Plugins $source }
    $vencord = $script:BuiltDir

    Step 'Done'
    if ($vencord) {
        Info 'Fully restart Discord (quit it from the icon next to the clock, then start it again).'
        Info 'The plugins are on by default; the rice bowl button in the channel header opens the settings.'
        Info 'RiceUpdater keeps the theme file and the plugins up to date from GitHub from now on.'
        if ($script:OrionState -eq 'added' -or $script:OrionState -eq 'updated') {
            Info 'Orion: turn on OrionQuests under Settings > Vencord > Plugins. RiceUpdater leaves it alone;'
            Info 'run this installer again with -Orion to update it.'
        }
    }
    if ($forVencord) {
        Info 'Vencord: turn the theme on under Settings > Vencord > Themes > discord-rice.'
        if (-not $vencord) {
            Info 'Without the plugins the theme file does not update itself. For that, use the online link'
            Info 'from the README instead of the file, or run this again with -Plugins.'
        }
    }
    if ($mods | Where-Object { $_.Name -eq 'BetterDiscord' }) {
        Info 'BetterDiscord: turn on discord-rice under Settings > Themes, and the plugins under Settings >'
        Info 'Plugins. DiscordRiceUpdater is the one that keeps the theme and the others up to date.'
    }
} finally {
    if ($TempDir -and (Test-Path $TempDir)) { Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
