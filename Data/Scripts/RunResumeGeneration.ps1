param(
    [string]$PayloadFile,
    [string]$TemplatePath = "Data\Templates\ATS_Resume_Template.docx",
    [string]$OutputDir = "Data\Outputs"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$robotDir = (Get-Item (Join-Path $scriptDir "..\..")).FullName
$workspaceDir = (Get-Item (Join-Path $robotDir "..")).FullName

function Resolve-SmartPath($p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return "" }
    if ([System.IO.Path]::IsPathRooted($p) -and (Test-Path $p)) { return (Get-Item $p).FullName }
    if (Test-Path $p) { return (Get-Item $p).FullName }
    
    $candidate1 = Join-Path $robotDir $p
    if (Test-Path $candidate1) { return (Get-Item $candidate1).FullName }

    $candidate2 = Join-Path $workspaceDir $p
    if (Test-Path $candidate2) { return (Get-Item $candidate2).FullName }

    # If it still doesn't exist, return rooted candidate1
    return [System.IO.Path]::GetFullPath($candidate1)
}

function Resolve-SmartOutputDir($p) {
    if ([string]::IsNullOrWhiteSpace($p)) { return (Join-Path $robotDir "Data\Outputs") }
    if ([System.IO.Path]::IsPathRooted($p)) { return [System.IO.Path]::GetFullPath($p) }
    if (Test-Path $p) { return (Get-Item $p).FullName }

    $candidate1 = Join-Path $robotDir $p
    if (Test-Path $candidate1) { return (Get-Item $candidate1).FullName }

    return [System.IO.Path]::GetFullPath($candidate1)
}

$resolvedPayload = Resolve-SmartPath $PayloadFile
$resolvedTemplate = Resolve-SmartPath $TemplatePath
$resolvedOutputDir = Resolve-SmartOutputDir $OutputDir

if (-not (Test-Path $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null
}

$generatorJs = Join-Path $scriptDir "GenerateResumeDocument.js"

$nodeCmd = "node `"$generatorJs`" `"$resolvedPayload`" `"$resolvedTemplate`" `"$resolvedOutputDir`""
$output = Invoke-Expression $nodeCmd

$statusFile = Join-Path $resolvedOutputDir "generation_result.json"
[System.IO.File]::WriteAllText($statusFile, $output, [System.Text.Encoding]::UTF8)

Write-Output $output
