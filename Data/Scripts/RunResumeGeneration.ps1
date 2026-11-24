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

# Run node with stdout/stderr redirected to raw files via Start-Process.
# Two reasons: UiPath only reads this process's stdout, and PowerShell's own
# "2>" redirection wraps stderr in NativeCommandError records that bury the real
# message under position/category noise.
$runId = [System.Guid]::NewGuid().ToString("N")
$stdoutFile = Join-Path $resolvedOutputDir ("generation_stdout_" + $runId + ".log")
$stderrFile = Join-Path $resolvedOutputDir ("generation_stderr_" + $runId + ".log")

$nodeArgs = @(
    ('"{0}"' -f $generatorJs),
    ('"{0}"' -f $resolvedPayload),
    ('"{0}"' -f $resolvedTemplate),
    ('"{0}"' -f $resolvedOutputDir)
)

$generationFailed = $false
$reason = ""
$output = ""
$stderrText = ""

try {
    $nodeProcess = Start-Process -FilePath "node" -ArgumentList $nodeArgs -Wait -PassThru -NoNewWindow `
        -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    $nodeExitCode = $nodeProcess.ExitCode

    if (Test-Path -LiteralPath $stdoutFile) { $output = [System.IO.File]::ReadAllText($stdoutFile).TrimEnd() }
    if (Test-Path -LiteralPath $stderrFile) { $stderrText = [System.IO.File]::ReadAllText($stderrFile).Trim() }

    $generationFailed = ($nodeExitCode -ne 0) -or [string]::IsNullOrWhiteSpace($output)
    if ($generationFailed) {
        $reason = if ($nodeExitCode -ne 0) { "node exited with code $nodeExitCode" } else { "node produced no output" }
        if (-not [string]::IsNullOrWhiteSpace($stderrText)) { $reason = "$reason - $stderrText" }
    }
}
catch {
    $generationFailed = $true
    $reason = "node could not be started: $($_.Exception.Message)"
}
finally {
    Remove-Item -LiteralPath @($stdoutFile, $stderrFile) -Force -ErrorAction SilentlyContinue
}

if ($generationFailed) {
    $failure = [ordered]@{
        success      = $false
        error        = $reason
        docxPath     = ""
        pdfPath      = ""
        candidateName = ""
        timestamp    = (Get-Date).ToString("yyyyMMddHHmmss")
        pdfGenerated = $false
    }
    $output = ($failure | ConvertTo-Json -Compress)
}

$statusFile = Join-Path $resolvedOutputDir "generation_result.json"
# UTF8 without BOM so UiPath's ReadTextFile receives clean JSON.
[System.IO.File]::WriteAllText($statusFile, $output, (New-Object System.Text.UTF8Encoding($false)))

Write-Output $output

if ($generationFailed) { exit 1 }
