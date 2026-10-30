@echo off
setlocal
set "RUNTIME=E:\.Storage.local\xplayer-test-runtime"
set "OUTPUT=%RUNTIME%\ui-next-test\MusicPlayerOutput"
set "CONFIG=%RUNTIME%\ui-next-test\config"
set "ELECTRON=%RUNTIME%\node_modules\electron\dist\electron.exe"
set "SOURCE=E:\Programming\Music Player\Source"
set "APP=%SOURCE%\electron"

if not exist "%ELECTRON%" (
    echo ERROR: Electron executable not found.
    pause
    exit /b 1
)
if not exist "%SOURCE%\src\ui-next\index.html" (
    echo ERROR: Source UI-next entry is missing.
    pause
    exit /b 1
)
if not exist "%SOURCE%\Prepare-Source-Backed-Runtime.ps1" (
    echo ERROR: Prepare-Source-Backed-Runtime.ps1 is missing from the Source folder.
    pause
    exit /b 1
)
if not exist "%OUTPUT%\player.js" (
    echo ERROR: Runtime player data is missing.
    pause
    exit /b 1
)
if not exist "%CONFIG%" mkdir "%CONFIG%"
if not defined XPLAYER_TEST_CONFIG_DIR set "XPLAYER_TEST_CONFIG_DIR=%CONFIG%"

rem The script is run from Source, so it is always the current one. (It used to be run from a copy in %RUNTIME%, which went stale: the
rem new interface's default covers then 404ed because the assets link had never been made.)
powershell -NoProfile -ExecutionPolicy Bypass -File "%SOURCE%\Prepare-Source-Backed-Runtime.ps1" -SourceRoot "%SOURCE%" -OutputDir "%OUTPUT%"
if errorlevel 1 (
    echo ERROR: Could not prepare source-backed runtime links.
    pause
    exit /b 1
)

set "MUSIC_PLAYER_OUTPUT_DIR=%OUTPUT%"
set "MUSIC_PLAYER_CONFIG_DIR=%XPLAYER_TEST_CONFIG_DIR%"
cd /d "%APP%"
"%ELECTRON%" "%APP%" --ui=next %*
endlocal
