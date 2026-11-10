# Tooltip table (generated, do not edit by hand)

Made by `node tools/dev/tooltip-table.js` from the source. Run it again to refresh it; `--check` says whether it is current.

**How to mark it.** Copy this file, and in the **Decision** column of each row write `keep`, `remove`, or `new: <text>`. Leave a row empty to mean `keep`. Nothing is removed or changed until you hand the marked table back. Rows are matched by **ID**, so the text may be re-generated meanwhile.

Columns: **Name** is the main line. **State** is the dim word after it (On/Off and the like). **Description** is the second line. **Shortcut** is shown on the right. Text in `{braces}` is built while the app runs (a song name, a view name); the code is in **Source**. The `/` joins the texts a control shows in different situations.

**112 rows:** 9 rail, 6 player bar, 7 other texts set on new ui controls, 36 icon buttons, 2 other controls with their own tooltip, 51 engine controls, 1 rules that add to engine tooltips.

## Rail (left bar)

| ID | Control | Name | State | Description | Shortcut | Source | Decision |
|---|---|---|---|---|---|---|---|
| T0fe38 | rail home | Home |  |  |  | src/ui-next/shell/shell.js:68 | |
| T9c308 | rail library | Library |  |  |  | src/ui-next/shell/shell.js:69 | |
| Tf059e | rail search | Search |  |  |  | src/ui-next/shell/shell.js:70 | |
| T1dabb | rail recent | Recently played |  |  |  | src/ui-next/shell/shell.js:71 | |
| T337a3 | rail lyrics | Lyrics |  |  |  | src/ui-next/shell/shell.js:72 | |
| Tc337c | rail metadata | Metadata |  |  |  | src/ui-next/shell/shell.js:73 | |
| T3c36e | rail settings | Settings |  |  |  | src/ui-next/shell/shell.js:74 | |
| T21f5b | rail song | Song <br>*Not on the rail itself (opened from elsewhere); the label is its name.* |  |  |  | src/ui-next/shell/shell.js:77 | |
| Tb2658 | rail AI_VIEW_ID | AI chat <br>*Not on the rail itself (opened from elsewhere); the label is its name.* |  |  |  | src/ui-next/shell/shell.js:78 | |

## Player bar

| ID | Control | Name | State | Description | Shortcut | Source | Decision |
|---|---|---|---|---|---|---|---|
| Ta9dc6 | player shuffle | Shuffle |  |  | S | src/ui-next/views/playback/transport.js:59 | |
| T0fda4 | player prev | Previous <br>*No tooltip while no song is loaded.* |  |  |  | src/ui-next/views/playback/transport.js:60 | |
| Tc18d6 | player play | Pause / Play |  |  | Space | src/ui-next/views/playback/transport.js:61 | |
| T28a4a | player next | Next <br>*No tooltip while no song is loaded.* |  |  |  | src/ui-next/views/playback/transport.js:62 | |
| T9464f | player repeat | Repeat |  |  | R | src/ui-next/views/playback/transport.js:63 | |
| T44711 | player volume-icon | {parts['volume-icon'].getAttribute('aria-label') \|\| 'Mute'} |  |  | M | src/ui-next/views/playback/transport.js:64 | |

## Other texts set on new UI controls

| ID | Control | Name | State | Description | Shortcut | Source | Decision |
|---|---|---|---|---|---|---|---|
| Tc270c | view | {shown.label} |  |  |  | src/ui-next/views/ai/lyrics-bar.js:80 | |
| T6a8f3 | find | This song already has synced lyrics (LRC) |  |  |  | src/ui-next/views/playback/right-panel-content.js:176 | |
| Ta5434 | button (tag-sheet__button) | Looks the checked songs up on MusicBrainz and stages the original album, year, genre and label. Nothing is written until you review and apply. |  |  |  | src/ui-next/views/tools/tag-sheet.js:98 | |
| T89293 | select | Original album: the earliest official album. Most popular album: the one most people have listened to (ListenBrainz); if it has no data, the original album is used. |  |  |  | src/ui-next/views/tools/tag-sheet.js:105 | |
| T5f336 | button (tag-sheet__chip) | On {count} song{count === 1 ? '' : 's'} |  |  |  | src/ui-next/views/tools/tag-sheet.js:149 | |
| Taaa68 | td (tag-sheet__cell{staged ? ' is-changed' : ''}) | Changed. Not saved yet. / (nothing) |  |  |  | src/ui-next/views/tools/tag-sheet.js:160 | |
| Te57f4 | span (tag-sheet__loading) | {row.problem \|\| ''} / (nothing) |  |  |  | src/ui-next/views/tools/tag-sheet.js:163 | |

## Icon buttons (new UI)

| ID | Control | Name | State | Description | Shortcut | Source | Decision |
|---|---|---|---|---|---|---|---|
| Td14fe | title bar #back-btn | Back <br>*Name comes from the button’s aria-label (shell.js tooltipTitlebarButtons).* |  |  |  | src/ui-next/adapter/legacy-dom-adapter.js:54 | |
| T768f6 | title bar #forward-btn | Forward <br>*Name comes from the button’s aria-label (shell.js tooltipTitlebarButtons).* |  |  |  | src/ui-next/adapter/legacy-dom-adapter.js:55 | |
| T79216 | icon sparkles (ai-btn) | Turn on AI in Settings | AI is off |  |  | src/ui-next/shell/ai-chrome.js:11 | |
| T89a08 | icon panel-right (right-panel-btn) | Right panel |  |  |  | src/ui-next/shell/right-panel.js:65 | |
| T12adf | icon bell (bell-btn) | Notifications |  |  |  | src/ui-next/shell/shell.js:141 | |
| T5ef04 | icon link (url-btn) | Play from URL |  |  |  | src/ui-next/shell/shell.js:145 | |
| T71c29 | icon panel-left (left-panel-btn) | Left panel |  |  |  | src/ui-next/shell/shell.js:161 | |
| T20dff | icon {spec.icon} | {spec.label} |  |  |  | src/ui-next/shell/shell.js:247 | |
| T961a6 | icon pencil | Rename {name} |  |  |  | src/ui-next/shell/theme-picker.js:88 | |
| T2f7dd | icon trash-2 | Delete {name} |  |  |  | src/ui-next/shell/theme-picker.js:89 | |
| Tc76ce | icon app-window | Open {NAMES[tool]} in a new window |  |  |  | src/ui-next/shell/tool-popout.js:36 | |
| T39d75 | icon maximize-2 | Pop out the chat |  |  |  | src/ui-next/views/ai/ai-chat.js:124 | |
| T3df38 | icon minus | Minimize the chat |  |  |  | src/ui-next/views/ai/ai-chat.js:124 | |
| T7483c | icon minimize-2 | Make smaller (pop-up) |  |  |  | src/ui-next/views/ai/ai-chat.js:125 | |
| Td445e | icon send | Send |  |  |  | src/ui-next/views/ai/ai-chat.js:161 | |
| T83a3e | icon square | Cancel |  |  |  | src/ui-next/views/ai/ai-chat.js:163 | |
| Te7eac | icon languages | Translate lyrics |  |  |  | src/ui-next/views/ai/lyrics-bar.js:67 | |
| T7bf51 | icon {VIEW.both.icon} | {VIEW.both.label} |  |  |  | src/ui-next/views/ai/lyrics-bar.js:68 | |
| Td8324 | panel header button LIBRARY_HEADER_ACTION (icon plus) | New playlist or folder |  |  |  | src/ui-next/views/library/library-panel.js:41 | |
| Tcd194 | icon arrow-up-down (library-sort) | {sortLabel()} |  |  |  | src/ui-next/views/library/library-panel.js:110 | |
| T44c90 | icon chevron-left | Back to library |  |  |  | src/ui-next/views/library/library-panel.js:154 | |
| T81c24 | icon play | Play <br>*The name follows the button’s label, which changes with its state.* |  | (nothing) / Play all songs in this list |  | src/ui-next/views/library/list-toolbar.js:14 | |
| T4f795 | icon shuffle | Shuffle <br>*The name follows the button’s label, which changes with its state.* | On / Off |  | S | src/ui-next/views/library/list-toolbar.js:16 | |
| Tf2cb6 | icon search | Find in this list |  | Filter the songs in this list |  | src/ui-next/views/library/list-toolbar.js:17 | |
| Tf8496 | icon ellipsis | More options for this list |  |  |  | src/ui-next/views/library/list-toolbar.js:18 | |
| T0e03c | icon x | Remove {entry.query} from recent searches |  |  |  | src/ui-next/views/library/search-view.js:50 | |
| T93581 | icon columns-3 | Columns and row height |  |  |  | src/ui-next/views/library/song-list.js:214 | |
| T36656 | icon play | Play {song.title \|\| 'song'} |  |  |  | src/ui-next/views/library/song-page.js:36 | |
| Tff096 | icon list-music (queue-btn) | Queue |  | Songs playing next |  | src/ui-next/views/playback/queue-panel.js:36 | |
| Tf94ab | icon text-search | Find lyrics online |  |  |  | src/ui-next/views/playback/right-panel-content.js:114 | |
| Tc0f02 | icon {ICON_FILL.out} | Fill the app with the lyrics |  |  |  | src/ui-next/views/playback/right-panel-content.js:115 | |
| Tae814 | icon {ICON_ONLY.out} | Lyrics only |  |  |  | src/ui-next/views/playback/right-panel-content.js:116 | |
| T1777c | icon heart | Add to favorites <br>*The name follows the button’s label, which changes with its state.* |  |  |  | src/ui-next/views/playback/song-actions.js:18 | |
| T1d97e | icon info (player-info) | Show metadata |  |  |  | src/ui-next/views/playback/song-actions.js:30 | |
| Tb946c | icon visualizer (player-visualizer-toggle) | Visualizer <br>*The name follows the button’s label, which changes with its state.* | On / Off | Bars that move with the music, behind the player |  | src/ui-next/views/playback/visualizer-toggle.js:11 | |
| T18700 | icon info | Track information for the playing song |  |  |  | src/ui-next/views/tools/metadata.js:33 | |

## Other controls with their own tooltip (new UI)

| ID | Control | Name | State | Description | Shortcut | Source | Decision |
|---|---|---|---|---|---|---|---|
| Tdc022 | node | {node.getAttribute('aria-label') \|\| ''} |  |  |  | src/ui-next/shell/shell.js:192 | |
| T333a0 | button | {view.label} |  |  |  | src/ui-next/shell/shell.js:227 | |

## Engine controls (src/js and the page template; shown in the new UI wherever the control is kept)

| ID | Control | Name | State | Description | Shortcut | Source | Decision |
|---|---|---|---|---|---|---|---|
| Taba3b | .left-panel-header-title-group | Open your library |  |  |  | src/js/core/startup.js:40, src/js/ui/layout.js:22 | |
| T63e45 | #right-panel-expand-toggle | Show now playing view |  |  |  | src/js/core/startup.js:57, src/js/ui/08a-panel-layout.js:150 | |
| T2f4e0 | #subhero-more-btn | More options for All Songs |  |  |  | src/js/core/startup.js:204 | |
| T7441c | #play-btn | Play |  |  |  | src/js/library/03j-library-locations.js:251, src/js/playback/10c-playback-queue.js:230 (+2 more) | |
| T9e513 | #play-btn | Pause |  |  |  | src/js/lyrics/11f-sync-editor-volume-save.js:199, src/js/playback/10d-playback-song.js:69 | |
| Te4cbb | #lyrics-toggle-btn | Lyrics / No lyrics for this song |  |  |  | src/js/playback/10d-playback-song.js:78 | |
| Tae538 | #play-btn | Play / Pause |  |  |  | src/js/playback/15e-controls-audio-events.js:57 | |
| Tb9520 | #lyrics-toggle-btn | Lyrics |  |  |  | src/js/playback/15e-controls-audio-events.js:237, src/old-ui/music_player.template.html:726 | |
| Ta7e75 | #volume-icon | {label} |  |  |  | src/js/playback/15g-controls-volume-fade.js:316 | |
| T112eb | #subhero-search-icon | Search in {playlist.name} |  |  |  | src/js/playlists/09-folders-playlists.js:126 | |
| Tb2222 | #back-btn | Go back |  |  |  | src/js/ui/06e-tooltip-titles.js:14, src/js/ui/07-views.js:731 | |
| Ta39ee | #forward-btn | Go forward |  |  |  | src/js/ui/06e-tooltip-titles.js:17, src/js/ui/07-views.js:740 | |
| T3bae3 | .queue-toggle-btn | Queue |  |  |  | src/js/ui/06e-tooltip-titles.js:20 | |
| T55bb9 | #subhero-play-btn | Play all songs |  |  |  | src/js/ui/06e-tooltip-titles.js:23 | |
| T499b4 | #subhero-shuffle-btn | Shuffle |  |  |  | src/js/ui/06e-tooltip-titles.js:26, src/js/ui/07-views.js:241 (+1 more) | |
| Ta4f66 | #shuffle-btn | Shuffle |  |  |  | src/js/ui/06e-tooltip-titles.js:29 | |
| Tf2826 | #repeat-btn | Repeat |  |  |  | src/js/ui/06e-tooltip-titles.js:32 | |
| Td6bf1 | #prev-btn | Previous |  |  |  | src/js/ui/06e-tooltip-titles.js:35 | |
| T3a292 | #next-btn | Next |  |  |  | src/js/ui/06e-tooltip-titles.js:38 | |
| T9c866 | .create-playlist-header-btn | Create Playlist |  |  |  | src/js/ui/06e-tooltip-titles.js:44 | |
| Td66b5 | #subhero-search-icon | Search in All Songs |  |  |  | src/js/ui/06e-tooltip-titles.js:47 | |
| T49551 | #collapse-panel-btn | Collapse your library |  |  |  | src/js/ui/06e-tooltip-titles.js:52 | |
| Tafe05 | btn | {btn.getAttribute('data-notif-title')} |  |  |  | src/js/ui/06j-notification-system.js:226 | |
| T2917c | #subhero-shuffle-btn | Pause {viewName.toLowerCase()} |  |  |  | src/js/ui/07-views.js:214 | |
| T67ac9 | #subhero-shuffle-btn | Play {viewName.toLowerCase()} |  |  |  | src/js/ui/07-views.js:217 | |
| T8f6b9 | #subhero-search-icon | Search in {viewName} |  |  |  | src/js/ui/07-views.js:221 | |
| T3e21a | #subhero-more-btn | More options for {viewName} |  |  |  | src/js/ui/07-views.js:229 | |
| Tdfffa | #subhero-shuffle-btn | Smart Shuffle is on / Shuffle is on |  |  |  | src/js/ui/07-views.js:238 | |
| T4eba5 | #subhero-search-icon | Search in {item.name} |  |  |  | src/js/ui/07-views.js:797 | |
| T2f30e | #right-panel-more-info | More options for {song title} |  |  |  | src/js/ui/08b-panel-album-art.js:78, src/js/ui/08d-panel-right-tabs.js:138 | |
| Td712a | #url-save-path-display | {res.folder} |  |  |  | src/js/ui/08e-panel-settings.js:604 | |
| T6dbcd | btn | Remove from favorites |  |  |  | src/js/ui/17-song-selection.js:139, src/js/ui/17-song-selection.js:191 | |
| T69d13 | btn | Add to favorites |  |  |  | src/js/ui/17-song-selection.js:145, src/js/ui/17-song-selection.js:185 | |
| Tff277 | .left-panel-header-title-group | Collapse your library |  |  |  | src/js/ui/layout.js:42 | |
| Ta0f2e | button [data-action=showAddLinkDialog] | Play from URL |  |  |  | src/old-ui/music_player.template.html:51 | |
| Te9775 | #online-lyrics-search-btn | Lyrics / LRC Search |  |  |  | src/old-ui/music_player.template.html:59 | |
| Tb92a4 | #notification-panel-btn | Notifications |  |  |  | src/old-ui/music_player.template.html:68 | |
| T113f1 | button [data-action=clearAllNotifications] | Clear all |  |  |  | src/old-ui/music_player.template.html:127 | |
| Tf987a | div [data-action=toggleLeftPanelCollapse] | Collapse your library |  |  |  | src/old-ui/music_player.template.html:145 | |
| T8c373 | #folder-back-btn | Go back |  |  |  | src/old-ui/music_player.template.html:163 | |
| T60c98 | #collapsed-folder-back-btn | Go back |  |  |  | src/old-ui/music_player.template.html:175 | |
| T3bed1 | #left-panel-search-icon | Search in Library |  |  |  | src/old-ui/music_player.template.html:214 | |
| Taa43d | #left-panel-search-clear | Clear |  |  |  | src/old-ui/music_player.template.html:229 | |
| T8f89f | #subhero-play-btn | Play |  |  |  | src/old-ui/music_player.template.html:426 | |
| T56ce8 | #subhero-more-btn | More options |  |  |  | src/old-ui/music_player.template.html:442 | |
| Tb15c9 | #subhero-search-icon | Search |  |  |  | src/old-ui/music_player.template.html:453 | |
| T234a2 | #subhero-search-clear | Clear |  |  |  | src/old-ui/music_player.template.html:468 | |
| Tacb08 | #right-panel-collapse-btn | Hide now playing view |  |  |  | src/old-ui/music_player.template.html:505 | |
| T855b1 | #right-panel-close-btn | Close panel |  |  |  | src/old-ui/music_player.template.html:528 | |
| T3abb8 | #right-panel-more-info | More options |  |  |  | src/old-ui/music_player.template.html:546 | |
| Td2a8d | #track-info-btn | Edit metadata |  |  |  | src/old-ui/music_player.template.html:591 | |

## Rules that add to engine tooltips

| ID | Control | Name | State | Description | Shortcut | Source | Decision |
|---|---|---|---|---|---|---|---|
| Ta7ac9 | .settings-theme-btn | {Theme name} theme <br>*Built from the button’s data-theme.* | Current |  |  | src/ui-next/shell/tooltips.js:24 | |

## Coverage

- Buttons made with `tooltip: false` have no tooltip on purpose and are not listed (11 of them: close, dismiss, clear and scroll arrows, whose icons say it).
- The window buttons (minimize, maximize, close) have no tooltip on purpose.
- Back and forward in the title bar are listed under icon buttons; their names come from the adapter’s `aria-label`.
- Only text in the source is found. A tooltip whose text comes from data (a theme name, a folder path, a song title) is shown as a pattern.
