const { BrowserWindow } = require('electron');
const path = require('path');
const { resolveUiEntry, NEXT_ENTRY } = require('./ui-entry');
const { loadingPageHtml, loadingBackground } = require('./loading-page');

let loadingWindow = null;

function showLoadingWindow(mainWindow) {
    if (loadingWindow) return;
    const next = resolveUiEntry({ argv: process.argv, env: process.env }) === NEXT_ENTRY;
    const loadingHtml = loadingPageHtml(next);
    loadingWindow = new BrowserWindow({
        width: 360,
        height: 240,
        frame: false,
        transparent: false,
        backgroundColor: loadingBackground(next),
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
