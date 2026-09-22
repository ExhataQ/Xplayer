import '../../src/css/base.css';
import '../../src/css/notifications.css';
import '../../src/css/left-panel.css';
import '../../src/css/right-panel.css';
import '../../src/css/header-topbar.css';
import '../../src/css/song-list.css';
import '../../src/css/context-menu.css';
import '../../src/css/player.css';
import '../../src/css/fullscreen-viewer.css';
import '../../src/css/search-history.css';
import '../../src/css/lyrics.css';
import '../../src/css/metadata-editor.css';
import '../../src/css/placeholders.css';
import '../fonts/all.min.css';
import '../fonts/material-icons.css';

const songs = [
    {
        title: 'A Very Long Song Title Used to Test Truncation and Layout Behavior',
        artists: ['The Extended Artist Name', 'Another Featured Artist'],
        album: 'A Carefully Named Album With Long Text',
        duration: '4:32',
        cover: 'linear-gradient(135deg, #5b21b6, #ec4899)',
        state: 'playing',
    },
    {
        title: 'Short Song',
        artists: ['Example Artist'],
        album: 'Demo Collection',
        duration: '3:08',
        cover: 'linear-gradient(135deg, #0f766e, #38bdf8)',
        state: 'selected',
    },
    {
        title: 'Multiple Artists and a Title That Keeps Going for Responsive Testing',
        artists: ['Primary Artist', 'Guest Artist', 'Orchestra'],
        album: 'Live at the Playground',
        duration: '6:17',
        cover: 'linear-gradient(135deg, #b45309, #facc15)',
    },
    {
        title: 'Instrumental Placeholder',
        artists: ['No Artist Metadata'],
        album: 'Unknown Album',
        duration: '2:41',
        cover: 'linear-gradient(135deg, #374151, #9ca3af)',
    },
];

const songRows = songs
    .map(
        (song, index) => `
            <div class="song-item ${song.state || ''}" data-song-id="${index}">
                <div class="song-number-item">
                    <span class="song-number-text">${index + 1}</span>
                    <span class="now-playing-indicator"><span></span><span></span><span></span><span></span></span>
                </div>
                <div class="left-song-item">
                    <div class="song-cover" style="background: ${song.cover}"></div>
                    <div class="song-info">
                        <div class="song-title">${song.title}</div>
                        <div class="song-artist">${song.artists.join(' • ')}</div>
                    </div>
                </div>
                <div class="song-album">${song.album}</div>
                <div class="right-song-item">
                    <div class="song-action-buttons">
                        <button class="add-to-queue-btn" aria-label="Add to queue next" title="Add to queue">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="favorite-btn" aria-label="Add to favorites" title="Add to favorites">
                            <i class="fas fa-heart unliked"></i>
                        </button>
                    </div>
                    <div class="song-duration">${song.duration}</div>
                    <div class="more-info" title="More options">
                        <span class="material-symbols-outlined">more_horiz</span>
                    </div>
                </div>
            </div>
        `,
    )
    .join('');

const queueRows = songs
    .slice(1, 4)
    .map(
        (song, index) => `
            <div class="queue-item">
                <div class="queue-item-cover" style="background: ${song.cover}"></div>
                <div class="queue-item-info">
                    <div class="queue-item-title">${song.title}</div>
                    <div class="queue-item-artist">${song.artists.join(' • ')}</div>
                </div>
                <div class="more-info" title="More options for ${song.title}">
                    <span class="material-symbols-outlined">more_horiz</span>
                </div>
            </div>
        `,
    )
    .join('');

document.querySelector('#app').innerHTML = `
    <div class="headerR">
        <div class="header-left" style="flex: 1; display: flex; align-items: center; padding-left: 0">
            <button class="nav-btn" disabled><i class="fas fa-chevron-left"></i></button>
            <button class="nav-btn" disabled><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="header-center">
            <div class="search-container">
                <div class="search-box">
                    <input type="text" placeholder="Search songs..." aria-label="Search songs" />
                    <button class="search-btn" aria-label="Search"><i class="fas fa-search"></i></button>
                </div>
            </div>
        </div>
        <div class="header-right" style="height: 100%; display: flex; align-items: center; justify-content: flex-end; padding-right: 0">
            <button class="add-link-btn" title="Play from URL"><i class="fas fa-link"></i></button>
            <button class="add-link-btn" title="Lyrics / LRC Search"><i class="fas fa-music"></i></button>
            <button class="notification-panel-btn" title="Notifications"><i class="fas fa-bell"></i><span class="notification-badge">2</span></button>
            <button class="settings-toggle-btn" title="Settings"><i class="fas fa-cog"></i></button>
            <button class="window-control-btn" style="margin-left: 12px"><i class="fas fa-minus"></i></button>
            <button class="window-control-btn"><i class="far fa-square"></i></button>
            <button class="close-app-btn"><i class="fas fa-times"></i></button>
        </div>
    </div>

    <div class="container">
        <div class="left-panel" id="left-panel">
            <div class="left-panel-header-section">
                <div class="left-panel-header">
                    <div class="left-panel-header-title-group">
                        <button class="collapse-panel-btn" aria-label="Collapse panel"><span class="material-symbols-outlined">left_panel_close</span></button>
                        <h3>Your Library</h3>
                    </div>
                    <button class="add-folder-btn" aria-label="Add folder"><span class="material-symbols-outlined">add</span></button>
                </div>
            </div>
            <div class="left-panel-main-list-container custom-scrollbar-container">
                <div class="left-panel-main-list-content custom-scrollbar-content">
                    <div class="left-panel-search-container">
                        <div class="left-panel-search-wrapper"><i class="fas fa-search"></i><input placeholder="Search your library" /></div>
                    </div>
                    <ul class="left-panel-main-list">
                        <li class="left-panel-main-item active" tabindex="0">
                            <div class="subfolder-row">
                                <div class="main-item-cover-wrapper"><svg class="main-item-cover-svg" viewBox="0 0 400 400"><rect width="400" height="400" rx="8" fill="var(--accent)" /><circle cx="200" cy="200" r="70" fill="none" stroke="#000" stroke-width="12" /><polygon points="180,160 180,240 240,200" fill="#000" /></svg></div>
                                <div class="main-item-info"><span class="main-item-title">All Songs</span><span class="main-item-subtitle"><span>Playlist</span><span class="main-item-dot">•</span><span>4 songs</span></span></div>
                            </div>
                        </li>
                        <li class="left-panel-main-item" tabindex="0">
                            <div class="subfolder-row">
                                <div class="main-item-cover-wrapper"><svg class="main-item-cover-svg" viewBox="0 0 400 400"><rect width="400" height="400" rx="8" fill="#9d4edd" /><path d="M200 290 L170 260 C140 230 110 200 110 170 C110 140 135 115 165 115 C180 115 195 125 200 135 C205 125 220 115 235 115 C265 115 290 140 290 170 C290 200 260 230 230 260 L200 290Z" fill="#fff" /></svg></div>
                                <div class="main-item-info"><span class="main-item-title">Liked Songs</span><span class="main-item-subtitle"><span>Playlist</span><span class="main-item-dot">•</span><span>2 songs</span></span></div>
                            </div>
                        </li>
                    </ul>
                    <div class="left-panel-section-title">Playlists</div>
                    <ul class="left-panel-main-list">
                        <li class="left-panel-main-item"><div class="subfolder-row"><div class="main-item-cover-wrapper"><div class="main-item-cover-placeholder"></div></div><div class="main-item-info"><span class="main-item-title">Late Night Focus</span><span class="main-item-subtitle"><span>Playlist</span><span class="main-item-dot">•</span><span>18 songs</span></span></div></div></li>
                    </ul>
                </div>
            </div>
        </div>

        <div class="custom-scrollbar-container content-wrapper">
            <div class="custom-scrollbar-content content" id="main-content">
                <div class="main-content-inner">
                    <div class="song-list-container" id="song-list-container">
                        <div class="playlist-hero-section">
                            <div class="playlist-hero-cover"><svg viewBox="0 0 400 400"><circle cx="200" cy="200" r="180" fill="#4B5563" /><polygon points="155,125 155,275 280,200" fill="var(--accent)" /></svg></div>
                            <div class="playlist-hero-info"><div class="playlist-hero-label">Playlist</div><h1 class="playlist-hero-title sized">All Songs</h1><div class="playlist-hero-meta"><span>4 songs</span></div></div>
                        </div>
                        <div class="content-gradient-wrapper">
                            <div class="subhero-section">
                                <div class="subhero-left-actions"><button class="subhero-play-btn" id="subhero-play-btn"><i class="fas fa-play"></i></button><button class="subhero-shuffle-btn" id="subhero-shuffle-btn"><span class="material-symbols-outlined">shuffle</span></button><button class="subhero-more-btn" id="mock-menu-button"><span class="material-symbols-outlined">more_horiz</span></button></div>
                                <div class="subhero-search-container"><div class="subhero-search-wrapper"><i class="fas fa-search"></i><input placeholder="Search in playlist" /></div></div>
                            </div>
                            <div class="tracklist-header"><div class="tracklist-container"><div class="left-tracklist"><div class="tracklist-number"><span class="tracklist-label">#</span></div><div class="tracklist-title"><span class="tracklist-label">Title</span></div></div><div class="tracklist-album"><span class="tracklist-label">Album</span></div><div class="tracklist-duration"><span class="tracklist-label">⏱</span></div></div></div>
                            <div class="song-list" id="song-list">${songRows}</div>
                            <div class="empty-state-container" id="empty-state" hidden><i class="fas fa-music"></i><span>No songs found</span></div>
                        </div>
                    </div>
                    <div class="lyrics-view-root" id="lyrics-view-root">
                        <div class="lyrics-view-container"><div class="lyrics-view-text"><div class="lyrics-line">This is a representative lyrics line</div><div class="lyrics-line active">The currently highlighted line appears here</div><div class="lyrics-line">Long lyrics content can be inspected in this view</div><div class="lyrics-line">Another line for scrolling and spacing checks</div></div></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="right-panel active" id="right-panel">
            <div class="right-panel-header-content queue-mode"><div class="right-panel-header-left"><button class="right-panel-collapse-btn" id="right-panel-collapse-btn"><span class="material-symbols-outlined">right_panel_close</span></button><span id="right-panel-header-title">Queue</span><span class="recently-played-text">recently played</span></div><div class="right-panel-header-right"><button class="right-panel-more-info"><span class="material-symbols-outlined">more_horiz</span></button></div></div>
            <div class="right-panel-content-wrapper custom-scrollbar-container"><div class="right-panel-scroll-content custom-scrollbar-content" id="right-panel-content">
                <div class="panel-content active" id="queue-content"><div class="queue-list" id="queue-list">${queueRows}</div></div>
                <div class="panel-content" id="tags-content"><div class="album-art-section"><div class="album-art-container"><div class="album-art-image mock-cover"></div></div><div class="tag-details"><div class="track-info-header"><div class="track-info-title">A Very Long Song Title Used to Test Truncation</div><div class="track-info-artist">The Extended Artist Name • Another Featured Artist</div></div><div class="track-info-box"><div class="track-info-box-title"><span>Info</span><button class="track-info-edit-btn"><span class="material-symbols-outlined">edit</span></button></div><div class="track-info-columns"><div class="track-info-row"><span class="track-info-value">A Carefully Named Album</span><span class="track-info-label">Album</span></div><div class="track-info-row"><span class="track-info-value">2026</span><span class="track-info-label">Year</span></div><div class="track-info-row"><span class="track-info-value">Electronic</span><span class="track-info-label">Genre</span></div><div class="track-info-row"><span class="track-info-value">4:32</span><span class="track-info-label">Duration</span></div></div></div></div></div></div>
                <div class="panel-content" id="metadata-content"><div id="metadata-editor-content" class="metadata-editor-content"><div class="metadata-editor-toolbar"><button class="metadata-editor-back"><span class="material-symbols-outlined">arrow_back</span></button><div class="metadata-editor-toolbar-title">Edit metadata</div><div class="metadata-editor-toolbar-actions"><button><span class="material-symbols-outlined">search</span> Search</button><button>Import</button><button>Export</button></div></div><div class="metadata-editor-top"><button class="metadata-cover-box"><span class="material-symbols-outlined">album</span></button><div class="metadata-cover-info"><span>No cover selected</span><button>Change cover</button></div></div><div class="metadata-editor-fields"><div class="metadata-editor-section"><div class="metadata-editor-section-title">Basic information</div><label class="metadata-editor-field"><span>Title</span><input value="A Very Long Song Title" /></label><label class="metadata-editor-field"><span>Artist</span><input value="The Extended Artist Name" /></label><label class="metadata-editor-field"><span>Album</span><input value="A Carefully Named Album" /></label><label class="metadata-editor-field"><span>Comment</span><textarea rows="3">Representative metadata editor content.</textarea></label></div></div><div class="metadata-editor-actions"><button class="metadata-editor-cancel">Cancel</button><button class="metadata-editor-save">Save changes</button></div></div></div>
            </div></div>
        </div>
    </div>

    <div class="music-player"><div class="player-container"><div class="player-left-section"><div class="player-song-info has-song"><div id="player-cover" class="mock-cover"></div><div class="player-text-info"><div id="player-title">A Very Long Song Title Used to Test Truncation</div><div id="player-artist">The Extended Artist Name • Another Featured Artist</div></div></div></div><div class="player-center-section"><div class="player-controls"><button class="player-btn" id="shuffle-btn"><span class="material-symbols-outlined">shuffle</span></button><button class="player-btn" id="prev-btn"><i class="fas fa-step-backward"></i></button><button class="player-btn" id="play-btn"><i class="fas fa-pause"></i></button><button class="player-btn" id="next-btn"><i class="fas fa-step-forward"></i></button><button class="player-btn" id="repeat-btn"><i class="fas fa-redo"></i></button></div><div class="progress-section"><div class="time-display" id="current-time">1:42</div><div class="progress-container" id="mock-progress"><div id="progress-bar" style="width: 38%"></div><div id="progress-knob" style="left: 38%"></div></div><div class="time-display" id="total-time">4:32</div></div></div><div class="player-right-section"><div class="player-right-controls"><button class="lyrics-toggle-btn" id="lyrics-toggle-btn"><span class="lyrics-svg-icon"></span></button><button class="queue-toggle-btn" id="queue-toggle-btn"><span class="material-symbols-outlined">queue_music</span></button><div class="volume-container"><div class="volume-icon" id="mock-volume-icon"><i class="fas fa-volume-up"></i></div><div id="volume-slider"><div id="volume-fill" style="width: 70%"></div><div id="volume-knob" style="left: 70%"></div></div></div></div></div></div></div>

    <div class="context-menu" id="mock-context-menu"><div class="context-menu-item"><i class="fas fa-play"></i> Play next</div><div class="context-menu-item"><i class="fas fa-list"></i> Add to queue</div><div class="context-menu-separator"></div><div class="context-menu-item"><i class="fas fa-info-circle"></i> View details</div></div>
    <div class="notification-panel" id="mock-notification-panel"><div class="notification-panel-header"><span>Notifications</span><button><i class="fas fa-trash-alt"></i></button></div><div class="notification-panel-list"><div class="notification-empty"><i class="fas fa-bell-slash"></i><span>Nothing else to show</span></div></div></div>
`;

const setVisible = (selector, visible) => {
    const element = document.querySelector(selector);
    if (element) element.style.display = visible ? '' : 'none';
};

const applyPlaygroundLayout = () => {
    const screenWidth = window.innerWidth;
    const root = document.documentElement;
    const leftPanelWidth = screenWidth * (400 / 1920);
    const rightPanelWidth = screenWidth * (400 / 1920);
    root.style.setProperty('--left-panel-width', `${leftPanelWidth}px`);
    root.style.setProperty('--right-panel-width', `${rightPanelWidth}px`);

    const mainContent = document.querySelector('#main-content');
    if (mainContent) mainContent.style.minWidth = `${screenWidth * (400 / 1920)}px`;

    const leftSection = document.querySelector('.player-left-section');
    const centerSection = document.querySelector('.player-center-section');
    const rightSection = document.querySelector('.player-right-section');
    if (leftSection && centerSection && rightSection) {
        const leftWidth = screenWidth * (256 / 1920);
        const rightWidth = screenWidth * (256 / 1920);
        leftSection.style.width = `${leftWidth}px`;
        leftSection.style.maxWidth = `${leftWidth}px`;
        rightSection.style.width = `${rightWidth}px`;
        rightSection.style.maxWidth = `${rightWidth}px`;
        centerSection.style.minWidth = `${screenWidth * (280 / 1920)}px`;
        centerSection.style.maxWidth = `${screenWidth * (600 / 1920)}px`;
        centerSection.style.paddingRight = `${screenWidth * (20 / 1920)}px`;
    }
};

applyPlaygroundLayout();
window.addEventListener('resize', applyPlaygroundLayout);

const setActive = (selector, active) => {
    document.querySelector(selector)?.classList.toggle('active', active);
};

const updatePlayerSong = (song, index) => {
    document.querySelector('#player-title').textContent = song.title;
    document.querySelector('#player-artist').textContent = song.artists.join(' • ');
    document.querySelector('#player-cover').style.background = song.cover;
    document.querySelectorAll('.song-item').forEach((item) => {
        item.classList.toggle('playing', Number(item.dataset.songId) === index);
        item.classList.toggle('selected', Number(item.dataset.songId) === index);
    });
};

document.querySelectorAll('.song-item').forEach((row) => {
    row.addEventListener('click', (event) => {
        if (event.target.closest('button, .more-info')) return;
        document.querySelectorAll('.song-item').forEach((item) => item.classList.remove('selected'));
        row.classList.add('selected');
    });
    row.addEventListener('dblclick', () => {
        const index = Number(row.dataset.songId);
        updatePlayerSong(songs[index], index);
    });
});

document.querySelectorAll('.left-panel-main-item').forEach((item) => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.left-panel-main-item').forEach((entry) => entry.classList.remove('active'));
        item.classList.add('active');
    });
});

document.querySelectorAll('.favorite-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        const icon = button.querySelector('i');
        const liked = icon.classList.toggle('liked');
        icon.classList.toggle('unliked', !liked);
    });
});

document.querySelectorAll('.add-to-queue-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        button.classList.toggle('added');
        button.querySelector('i').className = button.classList.contains('added') ? 'fas fa-check' : 'fas fa-plus';
    });
});

document.querySelector('#mock-menu-button')?.addEventListener('click', () => {
    const menu = document.querySelector('#mock-context-menu');
    menu.classList.toggle('active');
});

document.querySelector('.notification-panel-btn')?.addEventListener('click', () => {
    const panel = document.querySelector('#mock-notification-panel');
    panel?.classList.toggle('active');
    setActive('.notification-panel-btn', panel?.classList.contains('active') ?? false);
});

document.querySelector('#queue-toggle-btn')?.addEventListener('click', () => {
    const panel = document.querySelector('#right-panel');
    panel?.classList.toggle('active');
    setActive('#queue-toggle-btn', panel?.classList.contains('active') ?? false);
});

document.querySelector('#lyrics-toggle-btn')?.addEventListener('click', () => {
    const list = document.querySelector('#song-list-container');
    const lyrics = document.querySelector('#lyrics-view-root');
    const showingLyrics = lyrics.style.display !== 'none';
    list.style.display = showingLyrics ? '' : 'none';
    lyrics.style.display = showingLyrics ? 'none' : 'block';
    setActive('#lyrics-toggle-btn', !showingLyrics);
    document.body.classList.toggle('in-lyrics-view', !showingLyrics);
});

document.querySelector('.right-panel-collapse-btn')?.addEventListener('click', () => {
    const panel = document.querySelector('#right-panel');
    panel?.classList.toggle('active');
    setActive('#right-panel-collapse-btn', !panel?.classList.contains('active'));
});

document.querySelector('#subhero-play-btn')?.addEventListener('click', () => {
    const icon = document.querySelector('#play-btn i');
    const isPlaying = icon.classList.toggle('fa-pause');
    icon.classList.toggle('fa-play', !isPlaying);
    setActive('#subhero-play-btn', isPlaying);
});

document.querySelector('#play-btn')?.addEventListener('click', () => {
    const icon = document.querySelector('#play-btn i');
    const isPlaying = icon.classList.toggle('fa-pause');
    icon.classList.toggle('fa-play', !isPlaying);
    setActive('#play-btn', isPlaying);
});

document.querySelector('#shuffle-btn')?.addEventListener('click', () => {
    setActive('#shuffle-btn', !document.querySelector('#shuffle-btn').classList.contains('active'));
});

document.querySelector('#repeat-btn')?.addEventListener('click', () => {
    setActive('#repeat-btn', !document.querySelector('#repeat-btn').classList.contains('active'));
});

document.querySelector('#mock-progress')?.addEventListener('click', (event) => {
    const progress = event.offsetX / event.currentTarget.clientWidth;
    document.querySelector('#progress-bar').style.width = `${progress * 100}%`;
    document.querySelector('#progress-knob').style.left = `${progress * 100}%`;
});

document.querySelector('#volume-slider')?.addEventListener('click', (event) => {
    const volume = event.offsetX / event.currentTarget.clientWidth;
    document.querySelector('#volume-fill').style.width = `${volume * 100}%`;
    document.querySelector('#volume-knob').style.left = `${volume * 100}%`;
});

document.querySelector('#mock-volume-icon')?.addEventListener('click', () => {
    const icon = document.querySelector('#mock-volume-icon i');
    const muted = icon.classList.toggle('fa-volume-mute');
    icon.classList.toggle('fa-volume-up', !muted);
});

document.querySelector('input[placeholder="Search songs..."]')?.addEventListener('input', (event) => {
    const search = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.song-item').forEach((row, index) => {
        const text = `${songs[index].title} ${songs[index].artists.join(' ')} ${songs[index].album}`.toLowerCase();
        row.style.display = !search || text.includes(search) ? '' : 'none';
    });
});

document.querySelector('input[placeholder="Search in playlist"]')?.addEventListener('input', (event) => {
    const search = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.song-item').forEach((row, index) => {
        row.style.display = !search || songs[index].title.toLowerCase().includes(search) ? '' : 'none';
    });
});

const panelModes = ['queue', 'tags', 'metadata'];
let panelModeIndex = 0;
const setPanelMode = (mode) => {
    const index = panelModes.indexOf(mode);
    if (index >= 0) panelModeIndex = index;
    document.querySelectorAll('#right-panel-content > .panel-content').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `${panelModes[panelModeIndex]}-content`);
    });
    const title = document.querySelector('#right-panel-header-title');
    if (title) title.textContent = panelModes[panelModeIndex] === 'metadata' ? 'Edit metadata' : panelModes[panelModeIndex] === 'tags' ? 'Now playing' : 'Queue';
};

document.querySelector('#right-panel-header-title')?.addEventListener('click', () => {
    setPanelMode(panelModes[(panelModeIndex + 1) % panelModes.length]);
});

const query = new URLSearchParams(window.location.search);
if (query.has('empty')) {
    setVisible('#song-list', false);
    setVisible('#empty-state', true);
}
if (query.has('emptyQueue')) {
    document.querySelector('#queue-list').innerHTML = '<div class="empty-queue"><i class="fas fa-music"></i><p>Queue is empty</p><small>Play songs to build your queue</small></div>';
}
if (query.has('panel')) setPanelMode(query.get('panel'));
if (query.has('lyrics')) {
    setVisible('#song-list-container', false);
    setVisible('#lyrics-view-root', true);
}

window.addEventListener('click', (event) => {
    if (!event.target.closest('#mock-menu-button')) {
        document.querySelector('#mock-context-menu')?.classList.remove('active');
    }
});
