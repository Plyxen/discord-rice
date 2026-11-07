# Copies the theme into Vencord's themes folder. Run again after pulling changes; Vencord reloads it live.
$themes = Join-Path $env:APPDATA 'Vencord\themes'
if (-not (Test-Path $themes)) {
    Write-Error "Vencord themes folder not found at $themes. Is Vencord installed?"
    exit 1
}
Copy-Item -Path (Join-Path $PSScriptRoot 'discord-rice.theme.css') -Destination $themes -Force
# the theme used to be called chillnight.theme.css
Remove-Item -Path (Join-Path $themes 'chillnight.theme.css') -ErrorAction SilentlyContinue
Write-Host "Installed to $themes"
Write-Host "First time? Turn it on in Discord: Settings > Vencord > Themes > discord-rice."
