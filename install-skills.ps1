# install-skills.ps1
# Run this once to install your Claude Code skills globally on this machine.
# After running, all skills will be available in Claude Code / Antigravity IDE
# across every project via slash commands (e.g. /docx, /tdd, /deploy-to-vercel).

$skillsRoot = "C:\Users\risha\Journi_MVP_new\.claude\skills"
$destination = "$env:USERPROFILE\.claude\skills"

Write-Host "Creating skills directory at $destination..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $destination -Force | Out-Null

# Copy skills from skills/skills/
$source1 = "$skillsRoot\skills"
if (Test-Path $source1) {
    Write-Host "Copying project skills from $source1..." -ForegroundColor Cyan
    Copy-Item -Path "$source1\*" -Destination $destination -Recurse -Force
    Write-Host "  Done." -ForegroundColor Green
} else {
    Write-Host "  Skipped (path not found): $source1" -ForegroundColor Yellow
}

# Copy skills from agent-skills/skills/
$source2 = "$skillsRoot\agent-skills\skills"
if (Test-Path $source2) {
    Write-Host "Copying agent skills from $source2..." -ForegroundColor Cyan
    Copy-Item -Path "$source2\*" -Destination $destination -Recurse -Force
    Write-Host "  Done." -ForegroundColor Green
} else {
    Write-Host "  Skipped (path not found): $source2" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "All done! Skills installed to $destination" -ForegroundColor Green
Write-Host ""
Write-Host "Available skills:" -ForegroundColor Cyan
Get-ChildItem -Path $destination -Directory | ForEach-Object { Write-Host "  /$($_.Name)" }
