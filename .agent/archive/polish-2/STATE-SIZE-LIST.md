# State size list (generated, do not edit by hand)

Made by `node tools/dev/state-size-scan.js --write`. B8 rule: a state (hover, focus, pressed, selected, playing, open) may change colour, background, opacity, a transform or an outline, and nothing that moves the layout. Each row below is a state rule that sets a size-related value different from the plain rule of the same element. It is a list of candidates read from the style sheets; the browser measurement is what proves a row really moves something.

**114 findings in 16 files** (and 70 on ::before and ::after, not listed).

## src/ui-next/adapter/legacy-overlays.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 185 | `.submenu-parent:hover > .context-submenu` | display | (not set) | block |

## src/ui-next/adapter/songlist-rows.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 117 | `.view-host[data-songlist] .song-item.playing.paused-song .now-playing-indicator` | display | (not set) | none |
| 120 | `.view-host[data-songlist] .song-item.playing.paused-song .song-number-item` | font-size | (not set) | 0 |
| 132 | `.view-host[data-songlist] .song-item:not(.lazy-skeleton):is(.row-hover-active, .last-selected, :focus-visible) .song-number-item` | font-size | (not set) | 0 |
| 136 | `.view-host[data-songlist] .song-item:not(.lazy-skeleton):is(.row-hover-active, .last-selected, :focus-visible) .song-number-item > *` | display | (not set) | none |

## src/ui-next/shell/appearance.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 455 | `.tp-lyric--on` | width | (not set) | 80% |
| 531 | `.theme-card[aria-checked='true'] .theme-card__check` | display | (not set) | inline-flex |
| 1143 | `.dv-chip--on` | width | (not set) | 3.4cqw |
| 1184 | `.dv-item--on` | width | (not set) | calc(100% + 0.8cqw) |
| 1184 | `.dv-item--on` | margin | (not set) | 0 -0.4cqw |
| 1184 | `.dv-item--on` | padding | (not set) | 0.5cqw 0.4cqw |

## src/ui-next/startup/startup.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 246 | `.startup-host[data-state='done']` | display | (not set) | none |

## src/ui-next/views/library/library-panel.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 365 | `.library-panel .left-panel-main-item.playing:not(.paused) .left-panel-playing-icon` | display | (not set) | inline-block |

## src/ui-next/views/tools/lyrics-editors.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 23 | `.view-host[data-engine='lyrics'] > :is(.lyrics-editor-overlay, .sync-editor-overlay).active` | display | none | flex |

## src/css/context-menu.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 15 | `.context-menu.active` | display | none | block |

## src/css/fullscreen-viewer.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 19 | `.image-viewer.active` | display | none | flex |
| 305 | `.submenu-parent:hover > .context-submenu` | display | (not set) | block |

## src/css/header-topbar.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 255 | `.settings-panel.active` | display | none | block |

## src/css/left-panel.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 130 | `.left-panel:hover .collapse-panel-btn` | margin-right | (not set) | 0 |
| 135 | `.left-panel-header-title-group .collapse-panel-btn.active` | margin-right | (not set) | 0 |
| 172 | `.right-panel:hover .right-panel-collapse-btn` | margin-right | (not set) | 0 |
| 177 | `.right-panel-header-left .right-panel-collapse-btn.active` | margin-right | (not set) | 0 |
| 202 | `.left-panel.collapsed .collapse-panel-btn .material-symbols-outlined` | font-size | (not set) | 24px |
| 202 | `.right-panel.collapsed .right-panel-collapse-btn .material-symbols-outlined` | font-size | (not set) | 24px |
| 356 | `.left-panel-search-wrapper.expanded` | border | (not set) | 1px solid var(--border) |
| 406 | `.left-panel-search-wrapper.expanded .left-panel-search-clear.has-text` | display | (not set) | flex |
| 422 | `.left-panel-search-input:focus` | width | 0 | 150px |
| 422 | `.left-panel-search-input:focus` | padding | 0 | 0 8px 0 4px |
| 422 | `.left-panel-search-input.active` | width | 0 | 150px |
| 422 | `.left-panel-search-input.active` | padding | 0 | 0 8px 0 4px |
| 565 | `.subfolder-row:hover .left-panel-cover-play-btn` | display | (not set) | flex |
| 732 | `.left-panel-main-item.playing:not(.paused) .left-panel-playing-icon` | display | (not set) | inline-flex |
| 844 | `body.dragging-song .subfolder-row:hover .left-panel-cover-play-btn` | display | (not set) | none |
| 930 | `.left-panel.collapsed` | width | var(--left-panel-width) | 74px |
| 930 | `.left-panel.collapsed` | min-width | (not set) | 74px |
| 930 | `.left-panel.collapsed` | max-width | (not set) | 74px |
| 937 | `.left-panel.collapsed .left-panel-header h3` | display | (not set) | none |
| 941 | `.left-panel.collapsed .left-panel-header` | gap | (not set) | 8px |
| 941 | `.left-panel.collapsed .left-panel-header` | padding | (not set) | 0 |
| 948 | `.left-panel.collapsed .left-panel-header-title-group` | width | (not set) | 100% |
| 948 | `.left-panel.collapsed .left-panel-header-title-group` | display | (not set) | flex |
| 959 | `.left-panel.collapsed .left-panel-tags` | display | (not set) | none |
| 963 | `.left-panel.collapsed .left-panel-search-container` | display | (not set) | none |
| 967 | `.left-panel.collapsed .main-item-info` | display | (not set) | none |
| 971 | `.left-panel.collapsed .subfolder-row` | padding | (not set) | 7px 7px |
| 971 | `.left-panel.collapsed .subfolder-row` | margin | (not set) | 0 |
| 971 | `.left-panel.collapsed .subfolder-row` | padding-left | (not set) | 7px |
| 980 | `.left-panel.collapsed .left-panel-main-item[data-depth]:not([data-depth='0'])` | display | (not set) | none |
| 984 | `.left-panel.collapsed .folder-chevron` | display | (not set) | none |
| 992 | `.left-panel.collapsed .left-panel-main-list` | padding | (not set) | 0 0 15px 0 |
| 997 | `.left-panel.collapsed .left-panel-main-list-content` | margin-right | (not set) | -12px |
| 997 | `.left-panel.collapsed .left-panel-main-list-content` | padding-right | (not set) | 12px |
| 1002 | `.left-panel.collapsed .left-panel .custom-scrollbar` | margin-left | (not set) | -12px |
| 1002 | `.left-panel.collapsed .left-panel .custom-scrollbar` | margin-right | (not set) | 0 |
| 1007 | `.left-panel.collapsed .left-panel-main-list-container .custom-scrollbar` | display | (not set) | block |
| 1011 | `.left-panel.collapsed .left-panel-header-section` | padding | (not set) | 0 |
| 1011 | `.left-panel.collapsed .left-panel-header-section` | margin-bottom | (not set) | 10px |
| 1016 | `.left-panel.collapsed .collapse-panel-btn` | width | (not set) | 40px |
| 1016 | `.left-panel.collapsed .collapse-panel-btn` | height | (not set) | 40px |
| 1016 | `.left-panel.collapsed .collapse-panel-btn` | font-size | (not set) | 24px |
| 1022 | `.left-panel.collapsed .create-playlist-header-btn` | width | (not set) | 36px |
| 1022 | `.left-panel.collapsed .create-playlist-header-btn` | height | (not set) | 36px |
| 1022 | `.left-panel.collapsed .create-playlist-header-btn` | font-size | (not set) | 18px |
| 1027 | `.left-panel.collapsed .left-panel-playing-icon` | display | (not set) | none |
| 1056 | `.left-panel.collapsed .collapsed-folder-back-btn.visible` | display | (not set) | flex |
| 1065 | `.left-panel.collapsed .left-panel-header .folder-nav-bar` | display | (not set) | none |
| 1075 | `.left-panel.collapsed .left-panel-main-item .left-panel-cover-play-btn` | display | (not set) | none |
| 1075 | `.left-panel.collapsed .left-panel-main-item:hover .left-panel-cover-play-btn` | display | (not set) | none |

## src/css/lyrics.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 329 | `.lyrics-editor-overlay.active` | display | none | flex |
| 498 | `.sync-editor-overlay.active` | display | none | flex |

## src/css/metadata-editor.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 99 | `.extended-info-overlay.active` | display | none | flex |

## src/css/notifications.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 117 | `.notification-panel.active` | display | none | flex |

## src/css/right-panel.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 47 | `.right-panel.active` | display | none | flex |
| 76 | `body:has(.right-panel.collapsed) .container` | margin-right | (not set) | 0 |
| 76 | `body:has(.right-panel.collapsed) .container` | gap | (not set) | var(--gap-size) |
| 122 | `.panel-content.active` | display | none | flex |
| 847 | `.track-next-item:hover .track-next-play-btn` | display | (not set) | flex |
| 1160 | `.right-panel.collapsed` | min-width | (not set) | 40px |
| 1160 | `.right-panel.collapsed` | max-width | (not set) | 40px |
| 1160 | `.right-panel.collapsed` | width | var(--right-panel-width) | 40px |
| 1160 | `.right-panel.collapsed` | margin-left | (not set) | 0 |
| 1160 | `.right-panel.collapsed` | margin-right | (not set) | 0 |
| 1173 | `.right-panel.collapsed:hover` | min-width | (not set) | 50px |
| 1173 | `.right-panel.collapsed:hover` | max-width | (not set) | 50px |
| 1173 | `.right-panel.collapsed:hover` | width | var(--right-panel-width) | 50px |
| 1183 | `.right-panel.collapsed .right-panel-content` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .right-panel-content-wrapper` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .panel-content` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .right-panel-header-content` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .right-panel-header-left` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .right-panel-header-right` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .right-panel-more-info` | display | (not set) | none |
| 1183 | `.right-panel.collapsed #queue-content` | display | (not set) | none |
| 1183 | `.right-panel.collapsed #tags-content` | display | (not set) | none |
| 1183 | `.right-panel.collapsed #recently-played-content` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .album-art-section` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .tag-details` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .queue-list` | display | (not set) | none |
| 1183 | `.right-panel.collapsed .empty-queue` | display | (not set) | none |
| 1202 | `.right-panel.collapsed .custom-scrollbar` | display | (not set) | none |

## src/css/search-history.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 253 | `body.dragging-scrollbar .song-item.playing:hover .song-number-item` | font-weight | (not set) | bold |
| 263 | `body.dragging-scrollbar .song-item.playing .song-number-item` | font-weight | (not set) | bold |

## src/css/song-list.css

| Line | State selector | Property | Plain rule | State rule |
|---|---|---|---|---|
| 215 | `.song-item.playing .now-playing-indicator` | display | (not set) | flex |
| 219 | `.song-item.playing .song-number-text` | display | (not set) | none |
| 276 | `body.in-lyrics-view .song-item.playing .song-number-item` | font-weight | (not set) | normal |
| 351 | `.song-item.playing:hover .song-number-item .now-playing-indicator` | display | (not set) | none |
| 351 | `.song-item.playing.last-selected .song-number-item .now-playing-indicator` | display | (not set) | none |
| 368 | `.song-item.playing.paused-song .now-playing-indicator` | display | (not set) | none |
| 1027 | `.subhero-search-wrapper.expanded` | border | (not set) | 1px solid var(--border) |
| 1083 | `.subhero-search-wrapper.expanded .subhero-search-clear.has-text` | display | (not set) | flex |
| 1099 | `.subhero-search-input:focus` | width | 0 | 150px |
| 1099 | `.subhero-search-input:focus` | padding | 0 | 0 10px 0 4px |
| 1099 | `.subhero-search-input.active` | width | 0 | 150px |
| 1099 | `.subhero-search-input.active` | padding | 0 | 0 10px 0 4px |
