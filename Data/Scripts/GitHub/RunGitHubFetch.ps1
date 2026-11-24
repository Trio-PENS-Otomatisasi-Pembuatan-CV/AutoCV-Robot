param(
    [Parameter(Mandatory=$true)][string]$GitHubInput,
    [string]$GitHubToken = "",
    [string]$UseMockFallback = "true",
    [string]$OutputDir = "Data\Outputs"
)

$ErrorActionPreference = "Stop"

$scriptDir = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptDir "..\Shared\PathUtils.ps1")

$ctx = Get-RobotContext -BaseDir $scriptDir
$resolvedOutputDir = Resolve-SmartOutputDir $OutputDir -RobotDir $ctx.RobotDir

if (-not (Test-Path -LiteralPath $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null
}

$statusFile = Join-Path $resolvedOutputDir "github_repos_result.json"
$jsScript = Join-Path $scriptDir "FetchGitHubRepos.js"

$normalizedFlag = "$UseMockFallback".Trim().TrimStart([char]'$').ToLower()
$useMockFallback = @("1", "true", "yes", "y") -contains $normalizedFlag
$fallbackStr = if ($useMockFallback) { "true" } else { "false" }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = "`"$jsScript`" `"$GitHubInput`" `"$GitHubToken`" $fallbackStr `"$statusFile`""
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)
$output = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

if ($proc.ExitCode -ne 0) {
    throw "FetchGitHubRepos.js failed (exit code $($proc.ExitCode)): $stderr"
}

Write-Output $output
