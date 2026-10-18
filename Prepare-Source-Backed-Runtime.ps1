param(
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot,
    [Parameter(Mandatory = $true)]
    [string]$OutputDir
)

$ErrorActionPreference = 'Stop'

function Normalize-Path([string]$Path) {
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Ensure-SourceJunction([string]$Name) {
    $linkPath = Join-Path $OutputDir $Name
    $targetPath = Join-Path (Join-Path $SourceRoot 'src') $Name
    $backupPath = Join-Path $OutputDir "$Name-built"

    if (-not (Test-Path -LiteralPath $targetPath -PathType Container)) {
        throw "Source directory is missing: $targetPath"
    }

    $link = Get-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
    if ($null -ne $link) {
        if (($link.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            $actualTarget = [string]$link.Target
            if (-not $actualTarget -or (Normalize-Path $actualTarget) -ne (Normalize-Path $targetPath)) {
                throw "Existing $Name link does not target the requested source directory: $linkPath"
            }
            Write-Output "$Name already links to $targetPath"
            return
        }

        if (-not $link.PSIsContainer) {
            throw "Expected a directory at $linkPath"
        }
        if (Test-Path -LiteralPath $backupPath) {
            throw "Refusing to replace existing preserved output: $backupPath"
        }
        Rename-Item -LiteralPath $linkPath -NewName ([System.IO.Path]::GetFileName($backupPath))
        Write-Output "Preserved generated output at $backupPath"
    }

    New-Item -ItemType Junction -Path $linkPath -Target $targetPath | Out-Null
    $created = Get-Item -LiteralPath $linkPath -Force
    if (($created.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0 -or
        (Normalize-Path ([string]$created.Target)) -ne (Normalize-Path $targetPath)) {
        throw "Source junction verification failed: $linkPath"
    }
    Write-Output "$Name now links to $targetPath"
}

$SourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
if (-not (Test-Path -LiteralPath $OutputDir -PathType Container)) {
    throw "Runtime output directory is missing: $OutputDir"
}

Ensure-SourceJunction 'ui-next'
Ensure-SourceJunction 'js'
