@echo off
setlocal enabledelayedexpansion

set "OUTPUT_DIR=%USERPROFILE%\Desktop\MusicPlayerFonts"

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo Downloading Font Awesome...
echo.

echo [1/5] all.min.css
curl -L --connect-timeout 10 --max-time 30 -o "%OUTPUT_DIR%\all.min.css" "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"

echo [2/5] fa-solid-900.woff2
curl -L --connect-timeout 10 --max-time 30 -o "%OUTPUT_DIR%\fa-solid-900.woff2" "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2"

echo [3/5] fa-regular-400.woff2
curl -L --connect-timeout 10 --max-time 30 -o "%OUTPUT_DIR%\fa-regular-400.woff2" "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2"

echo [4/5] fa-brands-400.woff2
curl -L --connect-timeout 10 --max-time 30 -o "%OUTPUT_DIR%\fa-brands-400.woff2" "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2"

echo [5/5] Material Icons
curl -L --connect-timeout 10 --max-time 30 -o "%OUTPUT_DIR%\material-symbols-outlined.woff2" "https://fonts.gstatic.com/s/materialsymbolsoutlined/v226/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1n-q_4MrImHCIJIZrDCvHOej.woff2"

echo.
echo Fixing Font Awesome CSS paths...
powershell -Command "(Get-Content '%OUTPUT_DIR%\all.min.css') -replace 'url\(\.\./webfonts/', 'url(' | Set-Content '%OUTPUT_DIR%\all.min.css'"

echo Creating Material Icons CSS...
(
echo @font-face {
echo     font-family: 'Material Symbols Outlined';
echo     font-style: normal;
echo     font-weight: 400;
echo     src: url('material-symbols-outlined.woff2') format('woff2');
echo }
echo.
echo .material-symbols-outlined {
echo     font-family: 'Material Symbols Outlined';
echo     font-weight: normal;
echo     font-style: normal;
echo     font-size: 20px;
echo     line-height: 1;
echo     letter-spacing: normal;
echo     text-transform: none;
echo     display: inline-block;
echo     white-space: nowrap;
echo     word-wrap: normal;
echo     direction: ltr;
echo     -webkit-font-feature-settings: 'liga';
echo     -webkit-font-smoothing: antialiased;
echo     font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
echo }
) > "%OUTPUT_DIR%\material-icons.css"

echo.
echo Done! Fonts downloaded to: %OUTPUT_DIR%
echo Copy all files from this folder into: App\MusicPlayerOutput\fonts\
pause