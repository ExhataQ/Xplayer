const { BrowserWindow } = require('electron');
const path = require('path');

let loadingWindow = null;

function showLoadingWindow(mainWindow) {
    if (loadingWindow) return;
    const loadingHtml = `
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background: #121212;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    -webkit-app-region: drag;
                    user-select: none;
                }
                .progress-circle {
                    width: 80px;
                    height: 80px;
                    position: relative;
                    margin-bottom: 16px;
                }
                .progress-circle svg {
                    transform: rotate(-90deg);
                }
                .progress-circle .bg {
                    fill: none;
                    stroke: #333;
                    stroke-width: 4;
                }
                .progress-circle .fill {
                    fill: none;
                    stroke: #1db954;
                    stroke-width: 4;
                    stroke-linecap: round;
                    transition: stroke-dashoffset 0.3s ease;
                }
                .progress-circle .text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 20px;
                    font-weight: 700;
                }
                .title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
                .step { font-size: 11px; color: #b3b3b3; }
            </style>
        </head>
        <body>
            <div class="progress-circle">
                <svg width="80" height="80" viewBox="0 0 80 80">
                    <circle class="bg" cx="40" cy="40" r="34"/>
                    <circle class="fill" id="progress-fill" cx="40" cy="40" r="34"
                        stroke-dasharray="213.6" stroke-dashoffset="213.6"/>
                </svg>
                <div class="text" id="progress-text">0%</div>
            </div>
            <div class="title" id="step-title">Preparing...</div>
            <div class="step" id="step-count"></div>
        </body>
        </html>
    `;
    loadingWindow = new BrowserWindow({
        width: 360,
        height: 240,
        frame: false,
        transparent: false,
        backgroundColor: '#121212',
        resizable: false,
        parent: mainWindow,
        modal: true,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    loadingWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loadingHtml));
    loadingWindow.center();
}

function updateLoadingProgress(percent, stepTitle, stepCount) {
    if (!loadingWindow) return;
    const circumference = 213.6;
    const offset = circumference - (percent / 100) * circumference;
    const js = `
        var fill = document.getElementById('progress-fill');
        var text = document.getElementById('progress-text');
        var title = document.getElementById('step-title');
        var count = document.getElementById('step-count');
        var currentStep = title ? title.textContent : '';
        var newStep = '${stepTitle.replace(/'/g, "\\'")}';
        if (fill) {
            if (currentStep && newStep !== currentStep) {
                fill.style.transition = 'none';
                fill.style.strokeDashoffset = '${circumference}';
                fill.offsetHeight;
                fill.style.transition = 'stroke-dashoffset 0.3s ease';
                setTimeout(function() {
                    fill.style.strokeDashoffset = '${offset}';
                }, 50);
            } else {
                fill.style.strokeDashoffset = '${offset}';
            }
        }
        if (text) text.textContent = '${percent}%';
        if (title) title.textContent = newStep;
        if (count) count.textContent = '${(stepCount || '').replace(/'/g, "\\'")}';
    `;
    loadingWindow.webContents.executeJavaScript(js).catch(() => {});
}

function hideLoadingWindow() {
    if (loadingWindow) {
        loadingWindow.close();
        loadingWindow = null;
    }
}

module.exports = {
    showLoadingWindow,
    updateLoadingProgress,
    hideLoadingWindow
};
