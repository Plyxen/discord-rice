# Copies the theme into the themes folder of Vencord, Vesktop and/or BetterDiscord on Windows.
# Run it again after pulling changes; the theme reloads live.
$targets = @(
    @{ Name = 'Vencord'; Path = Join-Path $env:APPDATA 'Vencord\themes' },
    @{ Name = 'Vesktop'; Path = Join-Path $env:APPDATA 'vesktop\themes' },
    @{ Name = 'BetterDiscord'; Path = Join-Path $env:APPDATA 'BetterDiscord\themes' }
)
$theme = Join-Path $PSScriptRoot 'discord-rice.theme.css'
$installed = 0
foreach ($t in $targets) {
    if (Test-Path $t.Path) {
        Copy-Item -Path $theme -Destination $t.Path -Force
        Write-Host "Installed for $($t.Name): $($t.Path)"
        $installed++
    }
}
if ($installed -eq 0) {
    Write-Error "No Vencord, Vesktop or BetterDiscord themes folder found. Is one of them installed? With Vencord you can also use the online link from the README."
    exit 1
}
Write-Host "First time? Turn it on in Discord: Settings > Themes (under Vencord or BetterDiscord) > discord-rice."
