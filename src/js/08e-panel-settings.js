// ==============================================================================
// SETTINGS PANEL
// ==============================================================================
function openSettingsPanel() {
    if (advancedSettingsOpen) {
        renderAdvancedSettingsPanel();
        return;
    }

    const songList = songListElement;
    const songListContainer = document.getElementById('song-list-container');
    const settingsButton = document.querySelector('.settings-toggle-btn');

    if (!songList || !songListContainer) {
        return;
    }

    if (typeof teardownLazyLoading === 'function') {
        teardownLazyLoading();
    }

    resetLeftPanelActiveState();
    if (settingsButton) {
        settingsButton.classList.add('active');
    }
    if (typeof updateActiveHighlight === 'function') {
        updateActiveHighlight(null);
    }
    pushViewToHistory('settings');
    const smartShuffleSettings = getSmartShuffleSettings();

    showHeroSection(false);
    showTracklistHeader(false);

    setSubheroVisibility('settings');

    const gradientWrapper = document.querySelector('.content-gradient-wrapper');
    if (gradientWrapper) gradientWrapper.classList.add('no-gradient');

    songList.style.display = 'flex';
    songList.style.justifyContent = 'center';
    songList.innerHTML = `
    <div class="settings-panel-content">
            <h3 class="settings-panel-title">Settings</h3>
                <div class="settings-panel-actions">
                    <button class="settings-action-btn" onclick="switchToHistoryFromSettings();">
                        <i class="fas fa-history"></i>
                        <span>View Play History</span>
                    </button>
                    <button class="settings-action-btn" onclick="switchToSearchHistoryFromSettings();">
                        <i class="fas fa-search"></i>
                        <span>Search History</span>
                    </button>
                    <div class="settings-section">
                        <div class="settings-section-title">Theme Color</div>
                        <div class="settings-theme-selector" id="settings-theme-selector">
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Right Panel</div>
                        <label class="settings-toggle-row">
                            <input
                                type="checkbox"
                                id="settings-hide-right-panel-lyrics"
                                onchange="toggleHideRightPanelLyrics(this.checked)"
                            >
                            <span>Remove right panel lyrics</span>
                        </label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Window</div>
                        <label class="settings-toggle-row">
                        <input
                            type="checkbox"
                            ${getWindowSettings().minimizeOnClose ? 'checked' : ''}
                            onchange="setMinimizeOnClose(this.checked)"
                        >
                        <span>Minimize to taskbar when closed</span>
                        </label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Playback & Audio</div>
                        <label class="settings-toggle-row"><input type="checkbox" data-playback-setting="crossfadeEnabled" ${getAudioPlaybackSettings().crossfadeEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('crossfadeEnabled', this.checked)"><span>Crossfade between tracks</span></label>
                        <div class="settings-threshold-row"><span>Crossfade length</span><input type="range" min="0.5" max="10" step="0.5" value="${Number(getAudioPlaybackSettings().crossfadeDuration) || 4}" oninput="setAudioPlaybackSetting('crossfadeDuration', Number(this.value)); this.nextElementSibling.textContent = this.value + 's'" aria-label="Crossfade duration"><span>${Number(getAudioPlaybackSettings().crossfadeDuration) || 4}s</span></div>
                        <label class="settings-toggle-row"><input type="checkbox" data-playback-setting="gaplessEnabled" ${getAudioPlaybackSettings().gaplessEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('gaplessEnabled', this.checked)"><span>Gapless playback</span></label>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().fadeInEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('fadeInEnabled', this.checked)"><span>Fade in</span></label>
                        <div class="settings-threshold-row"><span>Fade in length</span><input type="range" min="0.2" max="5" step="0.1" value="${Number(getAudioPlaybackSettings().fadeInDuration) || 1}" oninput="setAudioPlaybackSetting('fadeInDuration', Number(this.value)); this.nextElementSibling.textContent = this.value + 's'" aria-label="Fade in duration"><span>${Number(getAudioPlaybackSettings().fadeInDuration) || 1}s</span></div>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().fadeOutEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('fadeOutEnabled', this.checked)"><span>Fade out</span></label>
                        <div class="settings-threshold-row"><span>Fade out length</span><input type="range" min="0.2" max="5" step="0.1" value="${Number(getAudioPlaybackSettings().fadeOutDuration) || 1.25}" oninput="setAudioPlaybackSetting('fadeOutDuration', Number(this.value)); this.nextElementSibling.textContent = this.value + 's'" aria-label="Fade out duration"><span>${Number(getAudioPlaybackSettings().fadeOutDuration) || 1.25}s</span></div>
                        <label class="settings-toggle-row"><input type="checkbox" ${getAudioPlaybackSettings().replayGainEnabled ? 'checked' : ''} onchange="setAudioPlaybackSetting('replayGainEnabled', this.checked)"><span>ReplayGain / loudness normalization</span></label>
                        <div class="settings-threshold-row"><span>Gain mode</span><select onchange="setAudioPlaybackSetting('replayGainMode', this.value)">
                            ${['track', 'album'].map((value) => `<option value="${value}" ${getAudioPlaybackSettings().replayGainMode === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Trim</span><input type="range" min="-6" max="6" step="0.5" value="${Number(getAudioPlaybackSettings().replayGainTrimDb) || 0}" oninput="setAudioPlaybackSetting('replayGainTrimDb', Number(this.value)); this.nextElementSibling.textContent = (Number(this.value) > 0 ? '+' : '') + this.value + ' dB'" aria-label="ReplayGain trim"><span>${(Number(getAudioPlaybackSettings().replayGainTrimDb) || 0) > 0 ? '+' : ''}${Number(getAudioPlaybackSettings().replayGainTrimDb) || 0} dB</span></div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Smart Shuffle v1</div>
                        <div class="settings-threshold-hint" style="margin-bottom: 12px;">Uses local metadata, favorites, and playback history. It is available in lists with more than 50 songs.</div>
                        <div class="settings-threshold-row"><span>Journey size</span><select onchange="setSmartShuffleSetting('journeySize', this.value)">
                            ${[25, 50, 100, 250, 500].map((size) => `<option value="${size}" ${Number(smartShuffleSettings.journeySize) === size ? 'selected' : ''}>${size} songs</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Custom journey size</span><input type="number" min="1" value="${Number(smartShuffleSettings.journeySize) || 50}" onchange="setSmartShuffleSetting('journeySize', this.value)" aria-label="Custom journey size"></div>
                        <div class="settings-threshold-row"><span>Similar-song group</span><select onchange="setSmartShuffleSetting('groupSize', this.value)">
                            ${[1, 3, 5, 10].map((size) => `<option value="${size}" ${Number(smartShuffleSettings.groupSize) === size ? 'selected' : ''}>${size} songs</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Genre flow</span><select onchange="setSmartShuffleSetting('genreFlow', this.value)">
                            ${['off', 'gentle', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.genreFlow === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Artist separation</span><select onchange="setSmartShuffleSetting('artistSeparation', this.value)">
                            ${['off', 'normal', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.artistSeparation === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Avoid recently played</span><select onchange="setSmartShuffleSetting('recentLimit', this.value)">
                            ${[0, 25, 50, 100].map((size) => `<option value="${size}" ${Number(smartShuffleSettings.recentLimit) === size ? 'selected' : ''}>${size === 0 ? 'Off' : `${size} songs`}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Favorites</span><select onchange="setSmartShuffleSetting('favoriteWeight', this.value)">
                            ${['neutral', 'prefer', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.favoriteWeight === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <div class="settings-threshold-row"><span>Discovery</span><select onchange="setSmartShuffleSetting('discoveryWeight', this.value)">
                            ${['neutral', 'prefer', 'strong'].map((value) => `<option value="${value}" ${smartShuffleSettings.discoveryWeight === value ? 'selected' : ''}>${value.charAt(0).toUpperCase() + value.slice(1)}</option>`).join('')}
                        </select></div>
                        <label class="settings-toggle-row"><input type="checkbox" ${smartShuffleSettings.durationVariety ? 'checked' : ''} onchange="setSmartShuffleSetting('durationVariety', this.checked)"><span>Balance song durations</span></label>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Music Library</div>
                        <button class="settings-action-btn settings-action-btn-full" onclick="changeMusicFolder()">
                            <i class="fas fa-folder-open"></i>
                            <span>Change Music Folder (Legacy)</span>
                        </button>
                    </div>
<div class="library-locations-section">
<div class="library-locations-header">
<span class="library-locations-title">Music Library Folders</span>
<div class="library-locations-header-buttons">
<button class="library-locations-add-btn" onclick="addLibraryLocation()">
<i class="fas fa-plus"></i>
Add Folder
</button>
<button class="library-locations-add-btn" onclick="removeSelectedLibraryFolder()" style="border-color: #ff4444; color: #ff4444;">
<i class="fas fa-trash-alt"></i>
Remove Folder
</button>
</div>
</div>
<div class="library-locations-list-container">
<div class="library-locations-list" id="library-locations-list">
<div class="empty-queue" style="padding: 20px; text-align: center;">
<i class="fas fa-folder-open"></i>
<p>No folders added</p>
<small>Click "Add Folder" to include music locations</small>
</div>
</div>
</div>
<div class="library-locations-footer">
<button class="library-locations-rebuild-btn" onclick="rebuildLibraryFromFolders()">
<i class="fas fa-save"></i>
Save and Apply Changes
</button>
</div>
</div>
                    <div class="settings-section">
                        <div class="settings-section-title">Play from URL — Save Location</div>
                        <div class="settings-url-save-row">
                            <div class="settings-url-save-path" id="url-save-path-display" title="">—</div>
                            <button class="settings-action-btn settings-action-btn-half" onclick="changeUrlSaveFolder()">
                                <i class="fas fa-folder-open"></i>
                                <span>Change</span>
                            </button>
                            <button class="settings-action-btn settings-action-btn-half" onclick="resetUrlSaveFolder()">
                                <i class="fas fa-undo"></i>
                                <span>Reset</span>
                            </button>
                        </div>
                        <div class="settings-threshold-hint" style="margin-top: 8px;">
                            Songs downloaded via "Play from URL → Download & Stream" will be saved here.
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Backup & Restore</div>
                        <div class="settings-backup-row">
                            <button class="settings-action-btn settings-action-btn-half" onclick="exportAllData()">
                                <i class="fas fa-download"></i>
                                <span>Export Data</span>
                            </button>
                            <button class="settings-action-btn settings-action-btn-half" onclick="importAllData()">
                                <i class="fas fa-upload"></i>
                                <span>Import Data</span>
                            </button>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-section-title">Advanced</div>
                        <button class="settings-action-btn settings-action-btn-full" onclick="openAdvancedSettings()">
                            <i class="fas fa-sliders-h"></i>
                            <span>Advanced Settings</span>
                        </button>
                    </div>
                </div>
            </div>
    `;

    renderLibraryLocations();
    refreshUrlSaveFolderDisplay();
    updateSettingsMargins();

    const currentTheme = document.body.classList.contains('theme-pink')
        ? 'pink'
        : document.body.classList.contains('theme-purple')
        ? 'purple'
        : document.body.classList.contains('theme-yellow')
        ? 'yellow'
        : document.body.classList.contains('theme-white')
        ? 'white'
        : 'green';

    const themes = [
        {
            name: 'green',
            color: '#1db954'
        },
        {
            name: 'pink',
            color: '#ff6b9d'
        },
        {
            name: 'purple',
            color: '#9d4edd'
        },
        {
            name: 'yellow',
            color: '#ffd43b'
        },
        {
            name: 'white',
            color: '#f8f9fa'
        }
    ];

    const themeSelector = document.getElementById('settings-theme-selector');
    if (themeSelector) {
        themeSelector.innerHTML = themes
            .map(
                (t) =>
                    `<button class="settings-theme-btn${t.name === currentTheme ? ' active' : ''}" data-theme="${
                        t.name
                    }" aria-label="${t.name.charAt(0).toUpperCase() + t.name.slice(1)} theme">
                    <i class="fas fa-circle settings-theme-icon" style="color: ${t.color};"></i>
            </button>`
            )
            .join('');
    }

    const hideLyricsCheckbox = document.getElementById('settings-hide-right-panel-lyrics');
    if (hideLyricsCheckbox) {
        hideLyricsCheckbox.checked = getHideRightPanelLyrics();
    }

    initThemeButtons();

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function setSmartShuffleSetting(key, value) {
    const numericSettings = ['journeySize', 'groupSize', 'recentLimit'];
    saveSmartShuffleSetting(key, numericSettings.includes(key) ? Number(value) : value);
    showNotification('Smart Shuffle setting saved', 'success', 1500);
}

function openAdvancedSettings() {
    pushViewToHistory('settings-advanced');
    advancedSettingsOpen = true;
    renderAdvancedSettingsPanel();
}

function closeAdvancedSettings() {
    pushViewToHistory('settings');
    advancedSettingsOpen = false;
    openSettingsPanel();
}

function renderAdvancedSettingsPanel() {
    const songList = songListElement;

    if (typeof teardownLazyLoading === 'function') {
        teardownLazyLoading();
    }

    const settings = getExtendedMetadataSettings();
    const groupOrder = ['People', 'Structure', 'Publishing', 'Identifiers', 'Technical', 'Misc', 'Sort'];
    const groups = {};
    EXTENDED_METADATA_FIELDS.forEach((f) => {
        if (!groups[f.group]) groups[f.group] = [];
        groups[f.group].push(f);
    });

    let checkboxHTML = '';
    groupOrder.forEach((groupName) => {
        if (!groups[groupName]) return;
        const visibleFields = groups[groupName].filter((f) => !f.hidden);
        if (visibleFields.length === 0) return;
        checkboxHTML += `<div class="extended-fields-group-label">${escapeHtml(groupName)}</div>`;
        visibleFields.forEach((f) => {
            const checked = settings[f.key] ? 'checked' : '';
            checkboxHTML += `
                <label class="extended-field-checkbox-row">
                    <input type="checkbox" ${checked}
                           onchange="toggleExtendedMetadataField('${f.key}', this.checked)">
                    <span>${escapeHtml(f.label)}</span>
                </label>`;
        });
    });

    songList.style.display = 'flex';
    songList.style.justifyContent = 'center';
    songList.innerHTML = `
    <div class="settings-panel-content">
            <div class="settings-advanced-header">
                    <button class="settings-advanced-back-btn" onclick="closeAdvancedSettings()" aria-label="Back to settings">
                            <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h3 class="settings-panel-title" style="margin: 0; border-bottom: none; padding-bottom: 0;">Advanced Settings</h3>
            </div>
            <div class="settings-advanced-body">
                    <div class="settings-section">
                            <div class="settings-section-title">Virtual Scroll Threshold</div>
                            <div class="settings-threshold-row">
                                    <input type="range" class="settings-threshold-slider" id="threshold-slider"
                                           min="${MIN_VIRTUAL_SCROLL_THRESHOLD}"
                                           max="${MAX_VIRTUAL_SCROLL_THRESHOLD}"
                                           step="50"
                                           value="${VIRTUAL_SCROLL_THRESHOLD}"
                                           oninput="handleThresholdInput(this.value)"
                                           aria-label="Virtual scroll threshold">
                                    <div class="settings-threshold-value" id="threshold-value-display">${VIRTUAL_SCROLL_THRESHOLD}</div>
                            </div>
                            <div class="settings-threshold-hint">
                                    Lists with more than <span id="threshold-hint-value">${VIRTUAL_SCROLL_THRESHOLD}</span> items will use virtual scrolling.
                            </div>
                    </div>
                    <div class="settings-section">
                            <div class="settings-section-title">Extended Track Info</div>
                            <div class="settings-threshold-hint" style="margin-bottom: 12px;">
                                    Enable fields to extract and display below the standard Track Info section.
                            </div>
                            <div class="extended-fields-list">
                                    ${checkboxHTML}
                            </div>
                    </div>
<div class="library-locations-section">
<div class="library-locations-header">
<span class="library-locations-title">Saved Lyrics</span>
<div class="library-locations-header-buttons">
<button class="library-locations-add-btn" onclick="removeAllSavedLyrics()" style="border-color: #ff4444; color: #ff4444;">
<i class="fas fa-trash-alt"></i>
Remove All
</button>
</div>
</div>
<div class="library-locations-list-container">
<div class="library-locations-list" id="saved-lyrics-list">
</div>
</div>
</div>
            </div>
    </div>
    `;

    renderSavedLyricsList();

    updateSettingsMargins();

    updateThresholdSliderFill(VIRTUAL_SCROLL_THRESHOLD);

    setTimeout(() => {
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
    }, 50);
}

function handleThresholdInput(value) {
    if (typeof snapVirtualScrollThreshold !== 'function') return;

    const v = snapVirtualScrollThreshold(value);

    const display = document.getElementById('threshold-value-display');
    if (display) display.textContent = v;

    const hint = document.getElementById('threshold-hint-value');
    if (hint) hint.textContent = v;

    updateThresholdSliderFill(v);

    if (typeof setVirtualScrollThreshold === 'function') {
        setVirtualScrollThreshold(v);
    }
}

function updateThresholdSliderFill(value) {
    const slider = document.getElementById('threshold-slider');
    if (!slider) return;
    const min = parseInt(slider.min, 10) || 0;
    const max = parseInt(slider.max, 10) || 100;
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg-hover) ${pct}%, var(--bg-hover) 100%)`;
}

function enterSettingsFromHistory() {
    advancedSettingsOpen = false;
    currentView = 'settings';
    resetLeftPanelActiveState();
    resetViewScroll();
    setSubheroVisibility('settings');
    showHeroSection(false);
    showTracklistHeader(false);
    updateHeroCover('settings');

    const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
    if (settingsToggleBtn) settingsToggleBtn.classList.add('active');

    openSettingsPanel();
}

function enterAdvancedSettingsFromHistory() {
    advancedSettingsOpen = true;
    currentView = 'settings';
    resetLeftPanelActiveState();
    resetViewScroll();
    setSubheroVisibility('settings');
    showHeroSection(false);
    showTracklistHeader(false);
    updateHeroCover('settings');

    const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
    if (settingsToggleBtn) settingsToggleBtn.classList.add('active');

    renderAdvancedSettingsPanel();
}

function closeSettingsPanelOnly() {
    advancedSettingsOpen = false;
    if (currentView === 'all-songs') {
        teardownLazyLoading();
    }

    const settingsButton = document.querySelector('.settings-toggle-btn');
    const songList = songListElement;

    if (settingsButton) {
        settingsButton.classList.remove('active');
    }
    if (songList) {
        songList.style.display = '';
        songList.style.justifyContent = '';
    }

    const gradientWrapper = document.querySelector('.content-gradient-wrapper');
    if (gradientWrapper) gradientWrapper.classList.remove('no-gradient');

    const viewToRestore = currentView === 'settings' ? 'all-songs' : currentView;
    switchView(viewToRestore);
    updateSettingsMargins();
}

function closeSettingsPanel() {
    closeSettingsPanelOnly();
}

function toggleSettingsPanel() {
    if (currentView === 'settings' && advancedSettingsOpen) {
        closeAdvancedSettings();
        return;
    }
    if (currentView === 'settings') {
        closeSettingsPanelOnly();
    } else {
        if (currentView === 'lyrics' || currentView === 'online-lyrics') {
            if (typeof teardownLyricsView === 'function') {
                teardownLyricsView();
            }
            document.body.classList.remove('in-lyrics-view');
            const songListContainer = document.getElementById('song-list-container');
            if (songListContainer) songListContainer.style.display = '';
            const lyricsToggleBtn = document.getElementById('lyrics-toggle-btn');
            if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
            lyricsSavedView = null;
        }

        advancedSettingsOpen = false;
        pushViewToHistory('settings');
        currentView = 'settings';
        resetLeftPanelActiveState();
        resetViewScroll();

        if (typeof clearAllSelections === 'function') {
            clearAllSelections();
        }

        resetSearchState();
        resetSubheroSearch();

        const settingsToggleBtn = document.querySelector('.settings-toggle-btn');
        if (settingsToggleBtn) {
            settingsToggleBtn.classList.add('active');
        }

        setSubheroVisibility('settings');
        showHeroSection(false);
        showTracklistHeader(false);
        openSettingsPanel();

        updateHeroCover('settings');

        setTimeout(() => {
            if (typeof updateExternalScrollbar === 'function') {
                updateExternalScrollbar();
            }
        }, 50);
    }
}

async function refreshUrlSaveFolderDisplay() {
    const el = document.getElementById('url-save-path-display');
    if (!el) return;
    if (!window.electronAPI || !window.electronAPI.getDownloadFolder) {
        el.textContent = 'Not available in browser mode';
        el.title = '';
        return;
    }
    try {
        const res = await window.electronAPI.getDownloadFolder();
        if (res && res.folder) {
            el.textContent = res.folder;
            el.title = res.folder;
        } else {
            el.textContent = '—';
            el.title = '';
        }
    } catch (e) {
        el.textContent = '—';
        el.title = '';
    }
}

async function changeUrlSaveFolder() {
    if (!window.electronAPI || !window.electronAPI.pickDownloadFolder) {
        showNotification('Not available in browser mode', 'warning', 2000);
        return;
    }
    const res = await window.electronAPI.pickDownloadFolder();
    if (res && res.success) {
        await refreshUrlSaveFolderDisplay();
        showNotification('Download folder updated', 'success', 2000);
    } else if (res && res.reason !== 'cancelled') {
        showNotification('Failed to change folder', 'error', 2000);
    }
}

async function resetUrlSaveFolder() {
    if (!window.electronAPI || !window.electronAPI.pickDownloadFolder) {
        showNotification('Not available in browser mode', 'warning', 2000);
        return;
    }
    const confirmed = await showConfirmDialog({
        title: 'Reset Download Folder',
        message: 'Reset the Play-from-URL save location back to your system Downloads folder?',
        okText: 'Reset',
        cancelText: 'Cancel'
    });
    if (!confirmed) return;
    const res = await window.electronAPI.resetDownloadFolder?.();
    if (res && res.success) {
        await refreshUrlSaveFolderDisplay();
        showNotification('Reset to default Downloads folder', 'success', 2000);
    } else {
        await refreshUrlSaveFolderDisplay();
        showNotification('Reset to default Downloads folder', 'success', 2000);
    }
}
