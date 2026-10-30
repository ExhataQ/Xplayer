@echo off
setlocal
rem Starts the DEPLOYED app (the sibling App folder, built by Source\build\music_player.py or tools\rebuild.bat)
rem on the new interface. Put this file in the Source folder. Extra arguments are passed on to Electron.
rem After the first launch you can also switch in Settings > Interface; the choice is saved, so the flag is then optional.
rem NOTE: this uses the app's real settings folder and real library, not the isolated test runtime.
rem       Snapshot the project and your library data first (PO-02).
set "SOURCE=%~dp0"
set "APPDIR=%SOURCE%..\App"
set "ELECTRON=%APPDIR%\electron.exe"

if not exist "%ELECTRON%" (
    echo ERROR: %ELECTRON% not found. Is the App folder next to Source?
    pause
    exit /b 1
)
if not exist "%APPDIR%\MusicPlayerOutput\ui-next\index.html" (
    echo ERROR: the new interface is not deployed. Run build\music_player.py or tools\rebuild.bat first.
    pause
    exit /b 1
)
if not exist "%APPDIR%\tag-service.js" (
    echo ERROR: the App folder is missing main-process files. Apply deploy-all-electron-files.patch and rebuild.
    pause
    exit /b 1
)

taskkill /F /IM electron.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%ELECTRON%" "%APPDIR%" --ui=next %*
endlocal
