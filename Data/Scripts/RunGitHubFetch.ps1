param(
    [Parameter(Mandatory=$true)][string]$GitHubInput,
    [string]$GitHubToken = "",
    [bool]$UseMockFallback = $true,
    [string]$OutputDir = "Data\Outputs"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$robotDir = (Get-Item (Join-Path $scriptDir "..\..")).FullName
$workspaceDir = (Get-Item (Join-Path $robotDir "..")).FullName

function Resolve-SmartOutputDir($p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return (Join-Path $robotDir "Data\Outputs") }
    if ([System.IO.Path]::IsPathRooted($p)) { return [System.IO.Path]::GetFullPath($p) }
    if (Test-Path $p) { return (Get-Item $p).FullName }

    $candidate = Join-Path $robotDir $p
    if (Test-Path $candidate) { return (Get-Item $candidate).FullName }

    return [System.IO.Path]::GetFullPath($candidate)
}

$resolvedOutputDir = Resolve-SmartOutputDir $OutputDir
if (-not (Test-Path $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null
}

$statusFile = Join-Path $resolvedOutputDir "github_repos_result.json"
$jsScript = Join-Path $scriptDir "FetchGitHubRepos.js"

$fallbackStr = if ($UseMockFallback) { "true" } else { "false" }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = "`"$jsScript`" `"$GitHubInput`" `"$GitHubToken`" $fallbackStr `"$statusFile`""
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)
$output = $proc.StandardOutput.ReadToEnd()
$errOutput = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

if (Test-Path $statusFile) {
    $resultJson = [System.IO.File]::ReadAllText($statusFile, [System.Text.Encoding]::UTF8)
    Write-Output $resultJson
} else {
    Write-Output $output
}
