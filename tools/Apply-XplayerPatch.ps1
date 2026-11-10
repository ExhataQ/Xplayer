# Xplayer Patch Manager  (lives in the project's tools folder: <Source>\tools\Apply-XplayerPatch.ps1)
#
# Apply patches to the Xplayer source, safely: checks first, backup, apply, history, undo.
# It never forces a patch, never resets the repository and never overwrites a file that does not match the patch.
# The project folder is found from where this script sits, and a patch can be anywhere: you give its path by
# dragging the file, so there is no fixed Downloads folder.
#
# Easiest:   drag one or more .patch files onto  tools\Apply-Patch.bat
# Menu:      double-click tools\Apply-Patch.bat, choose 1, then drag a patch file into the window and press Enter
# Review:    choose 2 (or -Review) and drag a patch in: it says whether that patch is already applied, and changes nothing
# Direct:    powershell -ExecutionPolicy Bypass -File tools\Apply-XplayerPatch.ps1 "C:\path\fix.patch"
# Help:      ... -Help     (also the ? choice in the menu)
#
# The window stays open when it is finished and goes back to the menu (use -Close to leave at once).
#
# What it keeps: .dev-data\patch-manager\history.json and a copy of every applied patch.
# .dev-data is git-ignored, so none of it ever lands in a commit.

[CmdletBinding()]
param(
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$Patch,
    [switch]$Help,
    [switch]$Review,
    [switch]$Close,
    [switch]$Undo,
    [switch]$History,
    [switch]$DryRun,
    [switch]$Test,
    [switch]$NoBackup
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$script:Repo = $null          # found in Test-Repository, from the folder this script sits in
$script:Store = $null
$script:PatchStore = $null
$script:HistoryFile = $null
$script:BackedUp = $false
$Interactive = -not ($Patch -or $Undo -or $History -or $Review -or $Help)

# ---------------------------------------------------------------- small helpers

function Say([string]$Text = '', [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color }

function Ask-YesNo([string]$Question, [bool]$Default = $false) {
    $hint = if ($Default) { '[Y/n]' } else { '[y/N]' }
    $a = (Read-Host "$Question $hint").Trim()
    if ($a -eq '') { return $Default }
    return ($a -match '^(y|yes)$')
}

# Run a program and capture its output and exit code. Native programs that write to stderr must not stop the script
# (Windows PowerShell 5.1 turns redirected stderr into errors), so errors are relaxed for the call.
function Invoke-Native([string]$Exe, [string[]]$ArgList) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $lines = @(& $Exe @ArgList 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
    }
    finally { $ErrorActionPreference = $old }
    return [pscustomobject]@{ Code = $code; Lines = $lines; Out = ($lines -join "`n") }
}

function Invoke-Git([string[]]$ArgList) { return (Invoke-Native 'git' $ArgList) }

# Every unexpected error is also written to .dev-data\patch-manager\errors.log (when the project folder is known), so it can be looked at later.
function Write-ErrorLog([string]$Where, $ErrorRecord) {
    try {
        if (-not $script:Store) { return }
        if (-not (Test-Path -LiteralPath $script:Store)) { New-Item -ItemType Directory -Path $script:Store -Force | Out-Null }
        $text = ('{0}  {1}: {2}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Where, $ErrorRecord.Exception.Message) + "`n" + [string]$ErrorRecord.ScriptStackTrace + "`n`n"
        [IO.File]::AppendAllText((Join-Path $script:Store 'errors.log'), $text)
    }
    catch { }   # the log is a convenience: never let it cause a second error
}

# Show an error in plain words and keep going. Returns $false when the block failed.
function Invoke-Safe([string]$What, [scriptblock]$Block) {
    try { & $Block; return $true }
    catch {
        Say ''
        Say ("Problem while {0}: {1}" -f $What, $_.Exception.Message) Red
        Say '  (details are in .dev-data\patch-manager\errors.log)' DarkGray
        Write-ErrorLog $What $_
        return $false
    }
}

function Get-Python {
    foreach ($name in 'python', 'py', 'python3') {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

# ---------------------------------------------------------------- help

function Show-Help {
    Say ''
    Say 'XPLAYER PATCH MANAGER - HELP' Cyan
    Say ''
    Say 'What it does'
    Say '  Applies a .patch file to the Xplayer source: checks it, makes a backup, applies it, and remembers it so it can be undone.'
    Say '  It never forces a patch, never resets the repository, and never overwrites a file that does not match the patch.'
    Say ''
    Say 'Three ways to give it a patch (the file can be anywhere)'
    Say '  1. Drag the .patch file onto tools\Apply-Patch.bat in Explorer. Several files at once are applied in order.'
    Say '  2. Start the tool, choose 1, then drag the file into the window. Its path appears, press Enter.'
    Say '  3. From a terminal:  .\tools\Apply-XplayerPatch.ps1 "C:\path\to\fix.patch"'
    Say ''
    Say 'Menu'
    Say '  1  Apply a patch          2  Review a patch (is it applied?)    3  Undo an applied patch'
    Say '  4  History                5  Unit tests + ESLint              ?  This help      6  Exit'
    Say ''
    Say 'What happens to each patch'
    Say '  1. It is read, and refused if it touches anything outside the project or inside .git.'
    Say '  2. A summary is shown: size, SHA256, the files, lines added and removed.'
    Say '  3. It is checked against your files. Already applied: skipped. Conflict: stopped, nothing changed.'
    Say '  4. A backup is made (tools\backup_source.py, once per run).'
    Say '  5. It is applied, checked once more, and written to the history with a copy of the patch.'
    Say ''
    Say 'Review (menu 2, or -Review)'
    Say '  Drag a patch in and it tells you, without changing anything: NOT APPLIED (it would apply cleanly), ALREADY APPLIED,'
    Say '  PARTLY APPLIED (some of its files are in, some are not) or CANNOT APPLY (the files changed). A conflict is broken down'
    Say '  file by file, and the history says whether this tool applied it, and when.'
    Say ''
    Say 'Options (terminal or shortcut)'
    Say '  -DryRun     check only, change nothing           -Test       run unit tests and ESLint afterwards'
    Say '  -Undo       undo an applied patch                -History    show what was applied'
    Say '  -Review     is this patch applied? (no changes)  -Help       this text'
    Say '  -NoBackup   skip the backup (not recommended)    -Close      close the window when done instead of going to the menu'
    Say ''
    Say 'Good to know'
    Say '  - Patches that depend on each other go in order. If one fails, the ones before it stay applied and the rest are untouched.'
    Say '  - Undo works only if the files still match: newer patches that changed the same files must be undone first.'
    Say '  - History and patch copies: .dev-data\patch-manager\ (git-ignored, never committed).'
    Say '  - It does not commit or push. Run the tests, then commit yourself.'
    Say '  - The window stays open after a patch is applied: you land in the menu. Choose 6 to leave.'
    Say '  - If PowerShell blocks the script, start it through Apply-Patch.bat, which allows it for this run only.'
}

# ---------------------------------------------------------------- history

# A list that may hold lists (an old history file written by the 5.1 quirk): the entries only, one flat list
function Expand-Flat($Items) {
    foreach ($i in @($Items)) {
        if ($i -is [System.Array]) { Expand-Flat $i } else { $i }
    }
}

function Read-PatchHistory {
    if (-not (Test-Path -LiteralPath $script:HistoryFile)) { return @() }
    $raw = [IO.File]::ReadAllText($script:HistoryFile)
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    try { $null = ConvertFrom-Json -InputObject $raw -ErrorAction Stop }
    catch {
        # The history file cannot be read (edited by hand, or cut off). Keep it under another name, start a new one, and say so.
        $kept = Join-Path $script:Store ('history.damaged-{0}.json' -f (Get-Date).ToString('yyyyMMdd-HHmmss'))
        try { Move-Item -LiteralPath $script:HistoryFile -Destination $kept -Force } catch { }
        Say ('The history file could not be read, so it was kept as ' + (Split-Path -Leaf $kept) + ' and a new history was started.') Yellow
        return @()
    }
    # Windows PowerShell 5.1 hands a JSON array back as ONE object, and piping it to ConvertFrom-Json then wrapping it in @() leaves a list inside a list
    # once there are two or more entries. Read it with -InputObject and unroll it by hand, so both versions give a flat list.
    $items = ConvertFrom-Json -InputObject $raw
    return @(Expand-Flat $items)
}

function Save-PatchHistory($Items) {
    if (-not (Test-Path -LiteralPath $script:Store)) { New-Item -ItemType Directory -Path $script:Store -Force | Out-Null }
    $json = ConvertTo-Json -InputObject @($Items) -Depth 6
    [IO.File]::WriteAllText($script:HistoryFile, $json, (New-Object System.Text.UTF8Encoding($false)))
}

function Show-PatchHistory {
    $hist = @(Read-PatchHistory)
    Say ''
    Say 'Patch history (newest last)' Cyan
    if ($hist.Count -eq 0) { Say '  Nothing applied through this tool yet.' Yellow; return }
    foreach ($h in $hist) {
        $state = if ($h.undone) { 'undone' } else { 'applied' }
        $color = if ($h.undone) { 'DarkGray' } else { 'Gray' }
        Say ('  {0,3}  {1}  {2,-40} {3,3} files  {4}' -f $h.id, $h.appliedAt, $h.name, $h.files, $state) $color
    }
}

# ---------------------------------------------------------------- repository

function Test-Repository {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Say 'ERROR: git was not found. Install Git for Windows first.' Red; return $false }
    $top = Invoke-Git @('-C', $ScriptDir, 'rev-parse', '--show-toplevel')
    if ($top.Code -ne 0 -or [string]::IsNullOrWhiteSpace($top.Out)) {
        Say 'ERROR: this script is not inside a git repository. Keep it in the Source\tools folder.' Red
        return $false
    }
    $script:Repo = [IO.Path]::GetFullPath($top.Out.Trim())
    Set-Location -LiteralPath $script:Repo
    $script:Store = Join-Path $script:Repo '.dev-data\patch-manager'
    $script:PatchStore = Join-Path $script:Store 'patches'
    $script:HistoryFile = Join-Path $script:Store 'history.json'
    return $true
}

function Show-RepositoryLine {
    $branch = Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD')
    $status = Invoke-Git @('status', '--porcelain')
    $changed = @($status.Lines | Where-Object { $_ -ne '' }).Count
    $b = if ($branch.Code -eq 0) { $branch.Out } else { '(no commits yet)' }
    Say "Project:  $script:Repo" DarkGray
    Say "Branch:   $b    changed files in the working tree: $changed" DarkGray
    $ign = Invoke-Git @('check-ignore', '-q', '.dev-data/patch-manager/history.json')
    if ($ign.Code -ne 0) { Say 'Note: .dev-data is not git-ignored here; the patch history would show up in git status.' Yellow }
}

function Invoke-Backup {
    if ($NoBackup) { Say 'Backup skipped (-NoBackup).' Yellow; return $true }
    if ($script:BackedUp) { return $true }
    Say 'Creating backup...' Cyan
    $py = Get-Python
    if (-not $py) { Say 'Python was not found, so the backup cannot run. Nothing was changed. (Use -NoBackup to skip it.)' Red; return $false }
    $backupScript = Join-Path $script:Repo 'tools\backup_source.py'
    if (-not (Test-Path -LiteralPath $backupScript)) { Say 'tools\backup_source.py is missing. Nothing was changed.' Red; return $false }
    & $py $backupScript | Out-Host
    if ($LASTEXITCODE -ne 0) { Say 'Backup failed. Nothing was changed.' Red; return $false }
    $script:BackedUp = $true
    return $true
}

# ---------------------------------------------------------------- reading a patch

function Get-PatchInfo([string]$Path) {
    $r = Invoke-Git @('apply', '--numstat', $Path)
    if ($r.Code -ne 0) { return [pscustomobject]@{ Ok = $false; Message = $r.Out; Files = @(); Added = 0; Removed = 0 } }
    $files = @(); $added = 0; $removed = 0
    foreach ($line in $r.Lines) {
        if ($line -match '^(\d+|-)\t(\d+|-)\t(.+)$') {
            if ($Matches[1] -ne '-') { $added += [int]$Matches[1] }
            if ($Matches[2] -ne '-') { $removed += [int]$Matches[2] }
            $files += $Matches[3]
        }
    }
    return [pscustomobject]@{ Ok = $true; Message = ''; Files = $files; Added = $added; Removed = $removed }
}

# A patch may only touch files inside the repository, and never inside .git
function Get-UnsafePaths($Files) {
    return @($Files | Where-Object { $_ -match '(^|[\\/])\.\.([\\/]|$)' -or $_ -match '^([A-Za-z]:|[\\/])' -or $_ -match '(^|[\\/])\.git([\\/]|$)' })
}

function Get-PatchState([string]$Path) {
    $fwd = Invoke-Git @('apply', '--check', '--whitespace=nowarn', $Path)
    if ($fwd.Code -eq 0) { return [pscustomobject]@{ State = 'Clean'; Message = '' } }
    $rev = Invoke-Git @('apply', '--check', '--reverse', '--whitespace=nowarn', $Path)
    if ($rev.Code -eq 0) { return [pscustomobject]@{ State = 'AlreadyApplied'; Message = '' } }
    return [pscustomobject]@{ State = 'Conflict'; Message = $fwd.Out }
}

function Show-PatchSummary($File, $Info, [string]$Hash) {
    $kb = [math]::Round($File.Length / 1KB, 1)
    Say ('  Path:  ' + $File.FullName) DarkGray
    Say ('  Size:  {0} KB    SHA256: {1}...' -f $kb, $Hash.Substring(0, 12)) DarkGray
    Say ('  Files: {0} changed (+{1} -{2})' -f $Info.Files.Count, $Info.Added, $Info.Removed) DarkGray
    $shown = 0
    foreach ($f in $Info.Files) {
        if ($shown -ge 25) { Say ('         ... and {0} more' -f ($Info.Files.Count - 25)) DarkGray; break }
        Say ('         ' + $f) DarkGray
        $shown++
    }
    $watch = @($Info.Files | Where-Object { $_ -match '^(package(-lock)?\.json|\.github/)' })
    if ($watch.Count -gt 0) { Say ('  Look at this one: it changes ' + ($watch -join ', ')) Yellow }
}

# ---------------------------------------------------------------- apply

# returns 'applied', 'skipped' or 'failed'
function Invoke-ApplyPatch($File) {
    $path = $File.FullName
    Say ''
    Say ('=== ' + $File.Name) Cyan

    $info = Get-PatchInfo $path
    if (-not $info.Ok) {
        Say 'Cannot read this file as a patch. Nothing applied.' Red
        Say $info.Message DarkGray
        return 'failed'
    }
    $unsafe = Get-UnsafePaths $info.Files
    if ($unsafe.Count -gt 0) {
        Say 'This patch touches paths outside the project or inside .git. Refused.' Red
        $unsafe | ForEach-Object { Say ('  ' + $_) Red }
        return 'failed'
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLower()
    Show-PatchSummary $File $info $hash

    $hist = @(Read-PatchHistory)
    $sameName = @($hist | Where-Object { $_.name -eq $File.Name -and $_.sha256 -ne $hash -and -not $_.undone })
    if ($sameName.Count -gt 0) { Say '  Note: a different patch with this name was applied before (this is a newer version of the file).' Yellow }

    $state = Get-PatchState $path
    if ($state.State -eq 'AlreadyApplied') {
        Say 'Already applied: the changes are already in the files. Skipped.' Yellow
        return 'skipped'
    }
    if ($state.State -eq 'Conflict') {
        Say 'CONFLICT. Nothing applied.' Red
        $state.Message -split "`n" | Select-Object -First 8 | ForEach-Object { Say ('  ' + $_) DarkGray }
        Say 'Usual causes: an earlier patch in the stack is not applied yet, or one of these files was edited after the patch was made.' Yellow
        return 'failed'
    }
    Say 'No conflicts.' Green

    if ($DryRun) { Say 'Dry run: not applied.' Yellow; return 'skipped' }
    if (-not (Invoke-Backup)) { return 'failed' }

    Say 'Applying...' Cyan
    $r = Invoke-Git @('apply', '--whitespace=nowarn', $path)
    if ($r.Code -ne 0) {
        Say 'Applying failed. The files were not changed (git applies a patch completely or not at all).' Red
        Say $r.Out DarkGray
        return 'failed'
    }
    # proof that it landed: the reverse of the patch must now apply
    $proof = Invoke-Git @('apply', '--check', '--reverse', '--whitespace=nowarn', $path)
    if ($proof.Code -ne 0) { Say 'Warning: the patch applied, but the check afterwards did not agree. Run git status and look.' Yellow }

    try {
        $id = 1
        $known = @()
        foreach ($h in $hist) { foreach ($v in @($h.id)) { $n = 0; if ([int]::TryParse([string]$v, [ref]$n)) { $known += $n } } }
        if ($known.Count -gt 0) { $id = ([int]($known | Measure-Object -Maximum).Maximum) + 1 }
        if (-not (Test-Path -LiteralPath $script:PatchStore)) { New-Item -ItemType Directory -Path $script:PatchStore -Force | Out-Null }
        $stored = ('{0:D3}-{1}' -f $id, $File.Name)
        Copy-Item -LiteralPath $path -Destination (Join-Path $script:PatchStore $stored) -Force
        $entry = [pscustomobject]@{
            id = $id; name = $File.Name; sha256 = $hash; appliedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm')
            files = $info.Files.Count; added = $info.Added; removed = $info.Removed; stored = $stored; undone = $false; undoneAt = ''
        }
        $hist += $entry
        Save-PatchHistory $hist
        Say ('Applied (history #{0}).' -f $id) Green
    }
    catch {
        Say 'The patch IS applied, but writing it to the history failed, so it cannot be undone from this tool:' Yellow
        Say ('  ' + $_.Exception.Message) Yellow
        Write-ErrorLog 'writing the history' $_
    }
    return 'applied'
}

# ---------------------------------------------------------------- choosing patches (by path)

function Remove-OuterQuotes([string]$Text) {
    $p = $Text.Trim()
    if ($p.Length -ge 2 -and (($p.StartsWith('"') -and $p.EndsWith('"')) -or ($p.StartsWith("'") -and $p.EndsWith("'")))) { $p = $p.Substring(1, $p.Length - 2) }
    return $p
}

# One path: quotes removed, must be an existing file. Returns a list of files (a comma list becomes several), or $null
function Resolve-PatchPath([string]$Text, [bool]$Quiet = $false) {
    $p = Remove-OuterQuotes $Text
    if ($p -eq '') { return $null }
    if (Test-Path -LiteralPath $p -PathType Leaf) { return @(Get-Item -LiteralPath $p) }
    if ($p.Contains(',')) {
        # "a.patch,b.patch" arrives as one string through powershell -File
        $all = @()
        foreach ($part in ($p -split ',')) {
            $f = Resolve-PatchPath $part $Quiet
            if ($null -eq $f) { return $null }
            $all += $f
        }
        return $all
    }
    if (-not $Quiet) {
        Say "Cannot find a file at: $p" Red
        Say 'Drag the patch file into this window, or paste its full path.' Yellow
    }
    return $null
}

# What Read-Host returns after files were dragged in: each file is a quoted path, separated by spaces
function Resolve-DroppedText([string]$Text) {
    $t = $Text.Trim()
    if ($t.StartsWith('& ')) { $t = $t.Substring(2).Trim() }
    if ($t -eq '') { return @() }
    $whole = Resolve-PatchPath $t $true
    if ($null -ne $whole -and @($whole).Count -eq 1) { return @($whole) }
    $files = @()
    foreach ($m in [regex]::Matches($t, '"([^"]*)"|''([^'']*)''|(\S+)')) {
        $piece = if ($m.Groups[1].Success) { $m.Groups[1].Value } elseif ($m.Groups[2].Success) { $m.Groups[2].Value } else { $m.Groups[3].Value }
        $f = Resolve-PatchPath $piece
        if ($null -eq $f) { return @() }
        $files += $f
    }
    return $files
}

function Read-DroppedPatches([string]$PromptLine = 'Drag the patch file (or several) into this window, then press Enter.') {
    Say ''
    Say $PromptLine Cyan
    Say 'Several files are handled in the order they appear in the line. Enter alone goes back.' DarkGray
    return @(Resolve-DroppedText (Read-Host 'Patch'))
}

# ---------------------------------------------------------------- review: is this patch applied?

# For one file of the patch: 'applied' (its changes are in), 'open' (it would apply), 'conflict' (neither)
function Get-FileState([string]$Path, [string]$FileName) {
    $fwd = Invoke-Git @('apply', '--check', '--whitespace=nowarn', "--include=$FileName", $Path)
    if ($fwd.Code -eq 0) { return 'open' }
    $rev = Invoke-Git @('apply', '--check', '--reverse', '--whitespace=nowarn', "--include=$FileName", $Path)
    if ($rev.Code -eq 0) { return 'applied' }
    return 'conflict'
}

function Show-PatchReview($File) {
    $path = $File.FullName
    Say ''
    Say ('=== Review: ' + $File.Name) Cyan
    $info = Get-PatchInfo $path
    if (-not $info.Ok) {
        Say 'Cannot read this file as a patch.' Red
        Say $info.Message DarkGray
        return
    }
    $unsafe = Get-UnsafePaths $info.Files
    if ($unsafe.Count -gt 0) {
        Say 'This patch touches paths outside the project or inside .git. It would be refused.' Red
        $unsafe | ForEach-Object { Say ('  ' + $_) Red }
        return
    }
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLower()
    Show-PatchSummary $File $info $hash

    $state = Get-PatchState $path
    $perFile = @()
    if ($state.State -eq 'Conflict') {
        foreach ($f in $info.Files) { $perFile += [pscustomobject]@{ File = $f; State = (Get-FileState $path $f) } }
    }
    Say ''
    if ($state.State -eq 'AlreadyApplied') {
        Say 'APPLIED: every change of this patch is already in your files.' Green
    }
    elseif ($state.State -eq 'Clean') {
        Say 'NOT APPLIED: none of it is in your files yet, and it would apply cleanly.' Yellow
    }
    else {
        $applied = @($perFile | Where-Object { $_.State -eq 'applied' }).Count
        $open = @($perFile | Where-Object { $_.State -eq 'open' }).Count
        $bad = @($perFile | Where-Object { $_.State -eq 'conflict' }).Count
        if ($applied -gt 0 -and $bad -eq 0) { Say ('PARTLY APPLIED: {0} of {1} files are in, {2} are not yet.' -f $applied, $perFile.Count, $open) Yellow }
        elseif ($applied -gt 0) { Say ('PARTLY APPLIED, AND CHANGED SINCE: {0} files are in, {1} do not match, {2} are not yet.' -f $applied, $bad, $open) Yellow }
        else { Say 'CANNOT APPLY: the files do not match this patch (an earlier patch is missing, or they were edited since it was made).' Red }
        foreach ($p in $perFile) {
            $label = switch ($p.State) { 'applied' { 'in      ' } 'open' { 'not yet ' } default { 'DIFFERS ' } }
            $color = switch ($p.State) { 'applied' { 'Green' } 'open' { 'Yellow' } default { 'Red' } }
            Say ('    ' + $label + $p.File) $color
        }
    }

    # what this tool remembers about it
    $hist = @(Read-PatchHistory)
    $mine = @($hist | Where-Object { $_.sha256 -eq $hash })
    if ($mine.Count -eq 0) {
        $named = @($hist | Where-Object { $_.name -eq $File.Name })
        if ($named.Count -gt 0) { Say '  History: a patch with this name was applied before, but this file is a different version of it.' DarkGray }
        else { Say '  History: this tool has not applied it (it may have been applied some other way, or not at all).' DarkGray }
    }
    else {
        $last = $mine | Sort-Object { [int]$_.id } | Select-Object -Last 1
        if ($last.undone) { Say ('  History: applied as #{0} on {1}, undone on {2}.' -f $last.id, $last.appliedAt, $last.undoneAt) DarkGray }
        else { Say ('  History: applied by this tool as #{0} on {1}.' -f $last.id, $last.appliedAt) DarkGray }
        if (-not $last.undone -and $state.State -eq 'Clean') { Say '  Note: the history says it is applied, but your files no longer have it (reverted by hand, or the files were replaced).' Yellow }
        if ($last.undone -and $state.State -eq 'AlreadyApplied') { Say '  Note: the history says it was undone, but your files have it (applied again some other way).' Yellow }
    }
}

function Invoke-ReviewMany($Files) {
    foreach ($f in $Files) { Show-PatchReview $f }
    Say ''
}

# ---------------------------------------------------------------- checks, many, undo

function Invoke-Checks {
    Say ''
    Say 'Running the unit tests (a few minutes)...' Cyan
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say 'Node.js was not found, so the tests cannot run here.' Red; return }
    $t = Invoke-Native 'node' @('tools/tests/run.js', 'unit')
    $t.Lines | Where-Object { $_ -match '^\S{0,2}\s*(pass|fail) \d+' } | ForEach-Object { Say ('  ' + $_.Trim()) Gray }
    $bad = @($t.Lines | Where-Object { $_ -match '^not ok ' })
    if ($bad.Count -gt 0) {
        Say '  failing:' Yellow
        $bad | ForEach-Object { Say ('    ' + $_) Yellow }
    }
    if ($t.Code -eq 0) { Say 'Unit tests: all passed.' Green } else { Say 'Unit tests: some failed (compare with the failing list you expect).' Yellow }
    Say 'Running ESLint...' Cyan
    $l = Invoke-Native 'npx' @('eslint', '.')
    if ($l.Code -eq 0) { Say 'ESLint: clean.' Green } else { $l.Lines | Select-Object -Last 15 | ForEach-Object { Say ('  ' + $_) Yellow }; Say 'ESLint: problems found.' Yellow }
}

function Invoke-ApplyMany($Files) {
    $applied = 0; $skipped = 0; $stopped = $false
    foreach ($f in $Files) {
        try { $result = Invoke-ApplyPatch $f }
        catch {
            Say ''
            Say ('Unexpected error with ' + $f.Name + ': ' + $_.Exception.Message) Red
            Say 'Git applies a patch completely or not at all, but run git status to see where things stand.' Yellow
            Write-ErrorLog ('applying ' + $f.Name) $_
            $result = 'failed'
        }
        if ($result -eq 'applied') { $applied++ }
        elseif ($result -eq 'skipped') { $skipped++ }
        else { $stopped = $true; break }
    }
    Say ''
    Say '======================================' Cyan
    if ($stopped) {
        Say 'STOPPED at the first problem. Patches before it stay applied (see the history); the ones after it were not touched.' Red
    }
    elseif ($DryRun) { Say 'Dry run finished. Nothing was changed.' Yellow }
    else { Say ('Done: {0} applied, {1} skipped.' -f $applied, $skipped) Green }
    Say '======================================' Cyan
    if (-not $stopped -and $applied -gt 0) {
        if ($Test) { Invoke-Checks }
        elseif ($Interactive -and (Ask-YesNo 'Run the unit tests and ESLint now?' $false)) { Invoke-Checks }
    }
    return (-not $stopped)
}

function Invoke-UndoPatch {
    $hist = @(Read-PatchHistory)
    $open = @($hist | Where-Object { -not $_.undone } | Sort-Object { [int]$_.id } -Descending)
    Say ''
    Say 'Undo an applied patch' Cyan
    if ($open.Count -eq 0) { Say '  Nothing to undo.' Yellow; return $false }
    $shown = @($open | Select-Object -First 10)
    foreach ($h in $shown) { Say ('  {0,3}  {1}  {2}' -f $h.id, $h.appliedAt, $h.name) Gray }
    Say 'Enter = the newest one. A newer patch that changed the same files must be undone first.' DarkGray
    $answer = (Read-Host 'History number').Trim()
    $entry = $shown[0]
    if ($answer -ne '') {
        $entry = $open | Where-Object { [string]$_.id -eq $answer } | Select-Object -First 1
        if ($null -eq $entry) { Say 'No such number.' Red; return $false }
    }
    $stored = Join-Path $script:PatchStore $entry.stored
    if (-not (Test-Path -LiteralPath $stored)) { Say 'The stored copy of that patch is missing, so it cannot be undone from here.' Red; return $false }
    $chk = Invoke-Git @('apply', '--check', '--reverse', '--whitespace=nowarn', $stored)
    if ($chk.Code -ne 0) {
        Say 'Cannot undo it cleanly: the files changed after this patch (a newer patch or your own edits). Nothing changed.' Red
        $chk.Lines | Select-Object -First 6 | ForEach-Object { Say ('  ' + $_) DarkGray }
        return $false
    }
    if ($DryRun) { Say 'Dry run: it can be undone cleanly.' Yellow; return $true }
    if (-not (Ask-YesNo ('Undo #{0} {1}?' -f $entry.id, $entry.name) $false)) { Say 'Cancelled.' Yellow; return $false }
    if (-not (Invoke-Backup)) { return $false }
    $r = Invoke-Git @('apply', '--reverse', '--whitespace=nowarn', $stored)
    if ($r.Code -ne 0) { Say 'Undo failed. The files were not changed.' Red; Say $r.Out DarkGray; return $false }
    $entry.undone = $true
    $entry.undoneAt = (Get-Date).ToString('yyyy-MM-dd HH:mm')
    Save-PatchHistory $hist
    Say ('Undone: {0}' -f $entry.name) Green
    return $true
}

# ---------------------------------------------------------------- main

function Show-Menu {
    Say 'Type ? for help.' DarkGray
    while ($true) {
        Say ''
        Say '  1  Apply a patch (drag the file in)'
        Say '  2  Review a patch: is it applied? (drag the file in)'
        Say '  3  Undo an applied patch'
        Say '  4  Show the history'
        Say '  5  Run the unit tests and ESLint'
        Say '  ?  Help'
        Say '  6  Exit'
        $choice = (Read-Host 'Choose').Trim()
        if ($choice -eq '1') {
            [void](Invoke-Safe 'applying' {
                $files = @(Read-DroppedPatches)
                if ($files.Count -gt 0) { [void](Invoke-ApplyMany $files) }
            })
        }
        elseif ($choice -eq '2') {
            [void](Invoke-Safe 'reviewing' {
                $files = @(Read-DroppedPatches 'Drag the patch file (or several) you want to check into this window, then press Enter.')
                if ($files.Count -gt 0) { Invoke-ReviewMany $files }
            })
        }
        elseif ($choice -eq '3') { [void](Invoke-Safe 'undoing' { [void](Invoke-UndoPatch) }) }
        elseif ($choice -eq '4') { [void](Invoke-Safe 'reading the history' { Show-PatchHistory }) }
        elseif ($choice -eq '5') { [void](Invoke-Safe 'running the checks' { Invoke-Checks }) }
        elseif ($choice -eq '?' -or $choice -eq 'h' -or $choice -eq 'help') { Show-Help }
        elseif ($choice -eq '6' -or $choice -eq 'q' -or $choice -eq 'exit') { break }
    }
}

$ok = $true
try {
    if ($Help) { Show-Help; exit 0 }
    if ($Interactive) { Clear-Host }
    Say '======================================' Cyan
    Say '       XPLAYER PATCH MANAGER' Cyan
    Say '======================================' Cyan

    if (-not (Test-Repository)) { $ok = $false }
    else {
        Show-RepositoryLine

        if ($History) { Show-PatchHistory }
        elseif ($Undo) { $ok = Invoke-UndoPatch }
        elseif ($Patch -or $Review) {
            $files = @()
            foreach ($n in $Patch) {
                $f = Resolve-PatchPath $n
                if ($null -eq $f) { $ok = $false; break }
                $files += $f
            }
            if ($ok -and $files.Count -gt 0) {
                if ($Review) { Invoke-ReviewMany $files }
                else { $ok = Invoke-ApplyMany $files }
            }
            elseif ($ok -and $Review) { $files = @(Read-DroppedPatches 'Drag the patch file (or several) you want to check into this window, then press Enter.'); if ($files.Count -gt 0) { Invoke-ReviewMany $files } }
        }

        # Started with a patch or a switch: do not close the window. Go on to the menu, where the next patch, a review or an undo is one choice away.
        if (-not $Interactive -and -not $Close) {
            $Interactive = $true
            Say ''
            Say 'Finished. The window stays open: you can go on here.' DarkGray
            Show-Menu
        }
        elseif ($Interactive) { Show-Menu }
    }
}
catch {
    $ok = $false
    Say ''
    Say ('The tool stopped because of an error: ' + $_.Exception.Message) Red
    Say $_.ScriptStackTrace DarkGray
    Write-ErrorLog 'the tool' $_
}
if (-not $ok -and -not $Close -and [Environment]::UserInteractive) {
    Say ''
    [void](Read-Host 'Something went wrong (see above). Press Enter to close')
}

if (-not $ok) { exit 1 }