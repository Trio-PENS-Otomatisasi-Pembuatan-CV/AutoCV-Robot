param(
    [string]$PayloadFile,
    [string]$TemplatePath = "Data\Templates\ATS_Resume_Template.docx",
    [string]$OutputDir = "Data\Outputs"
)

$ErrorActionPreference = "Stop"

$scriptDir = if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptDir "..\Shared\PathUtils.ps1")

$ctx = Get-RobotContext -BaseDir $scriptDir
$resolvedPayload = Resolve-SmartPath $PayloadFile -RobotDir $ctx.RobotDir -WorkspaceDir $ctx.WorkspaceDir
$resolvedTemplate = Resolve-SmartPath $TemplatePath -RobotDir $ctx.RobotDir -WorkspaceDir $ctx.WorkspaceDir
$resolvedOutputDir = Resolve-SmartOutputDir $OutputDir -RobotDir $ctx.RobotDir

if (-not (Test-Path -LiteralPath $resolvedOutputDir)) {
    New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null
}

$generatorJs = Join-Path $scriptDir "GenerateResumeDocument.js"

# Execute Node generator with isolated stdout/stderr capture
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
        success       = $false
        error         = $reason
        docxPath      = ""
        pdfPath       = ""
        candidateName = ""
        timestamp     = (Get-Date).ToString("yyyyMMddHHmmss")
        pdfGenerated  = $false
    }
    $output = ($failure | ConvertTo-Json -Compress)
}

$statusFile = Join-Path $resolvedOutputDir "generation_result.json"
# UTF8 without BOM so UiPath's ReadTextFile receives clean JSON.
[System.IO.File]::WriteAllText($statusFile, $output, (New-Object System.Text.UTF8Encoding($false)))

Write-Output $output

if ($generationFailed) { exit 1 }
