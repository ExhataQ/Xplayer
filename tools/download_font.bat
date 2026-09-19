@echo off
setlocal enabledelayedexpansion

set "OUTPUT_DIR=%USERPROFILE%\Desktop\MaterialIcons"

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo Downloading Google Material Icons...
echo.

echo [1/2] Downloading font file...
curl -L --connect-timeout 10 --max-time 30 -o "%OUTPUT_DIR%\material-symbols-outlined.woff2" "https://fonts.gstatic.com/s/materialsymbolsoutlined/v226/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1n-q_4MrImHCIJIZrDCvHOej.woff2"

echo [2/2] Creating CSS file...
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
echo Done! Files saved to: %OUTPUT_DIR%
pause