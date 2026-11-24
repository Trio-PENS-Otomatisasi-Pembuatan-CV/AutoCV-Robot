<#
.SYNOPSIS
    PathUtils.ps1 - Shared path resolution utility for AutoCV UiPath Robot scripts.
    Dynamically resolves Robot and Workspace roots by traversing directory hierarchy.
#>

function Get-RobotContext {
    param(
        [string]$BaseDir = ""
    )

    if ([string]::IsNullOrWhiteSpace($BaseDir)) {
        if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
            $BaseDir = $PSScriptRoot
        } else {
            $BaseDir = (Get-Location).Path
        }
    }

    # Walk up parent directories until project.json is found
    $curr = Get-Item -LiteralPath $BaseDir
    while ($curr -ne $null -and -not (Test-Path -LiteralPath (Join-Path $curr.FullName "project.json"))) {
        $curr = $curr.Parent
    }

    if ($curr -ne $null) {
        $robotDir = $curr.FullName
        $workspaceDir = if ($curr.Parent -ne $null) { $curr.Parent.FullName } else { $robotDir }
    } else {
        # Fallback to current working directory
        $robotDir = (Get-Location).Path
        $workspaceDir = $robotDir
    }

    $scriptsDir = Join-Path $robotDir "Data\Scripts"

    return [PSCustomObject]@{
        ScriptsDir   = $scriptsDir
        RobotDir     = $robotDir
        WorkspaceDir = $workspaceDir
    }
}

function Resolve-SmartPath {
    param(
        [string]$Path,
        [string]$RobotDir = "",
        [string]$WorkspaceDir = ""
    )

    if ([string]::IsNullOrWhiteSpace($Path)) { return "" }
    if ([System.IO.Path]::IsPathRooted($Path) -and (Test-Path -LiteralPath $Path)) {
        return (Get-Item -LiteralPath $Path).FullName
    }
    if (Test-Path -LiteralPath $Path) {
        return (Get-Item -LiteralPath $Path).FullName
    }

    if ([string]::IsNullOrWhiteSpace($RobotDir)) {
        $ctx = Get-RobotContext
        $RobotDir = $ctx.RobotDir
        $WorkspaceDir = $ctx.WorkspaceDir
    }

    $c1 = Join-Path $RobotDir $Path
    if (Test-Path -LiteralPath $c1) { return (Get-Item -LiteralPath $c1).FullName }

    $c2 = Join-Path $WorkspaceDir $Path
    if (Test-Path -LiteralPath $c2) { return (Get-Item -LiteralPath $c2).FullName }

    return [System.IO.Path]::GetFullPath($c1)
}

function Resolve-SmartOutputDir {
    param(
        [string]$OutputDir,
        [string]$RobotDir = ""
    )

    if ([string]::IsNullOrWhiteSpace($RobotDir)) {
        $ctx = Get-RobotContext
        $RobotDir = $ctx.RobotDir
    }

    if ([string]::IsNullOrWhiteSpace($OutputDir)) {
        return (Join-Path $RobotDir "Data\Outputs")
    }
    if ([System.IO.Path]::IsPathRooted($OutputDir)) {
        return [System.IO.Path]::GetFullPath($OutputDir)
    }
    if (Test-Path -LiteralPath $OutputDir) {
        return (Get-Item -LiteralPath $OutputDir).FullName
    }

    $c = Join-Path $RobotDir $OutputDir
    if (Test-Path -LiteralPath $c) {
        return (Get-Item -LiteralPath $c).FullName
    }

    return [System.IO.Path]::GetFullPath($c)
}
