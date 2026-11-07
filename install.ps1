# Copies the theme into the themes folder of Vencord and/or Vesktop on Windows.
# Run it again after pulling changes; the theme reloads live.
$targets = @(
    @{ Name = 'Vencord'; Path = Join-Path $env:APPDATA 'Vencord\themes' },
    @{ Name = 'Vesktop'; Path = Join-Path $env:APPDATA 'vesktop\themes' }
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
    Write-Error "No Vencord or Vesktop themes folder found. Is Vencord installed? You can also use the online link from the README."
    exit 1
}
Write-Host "First time? Turn it on in Discord: Settings > Vencord > Themes > discord-rice."
