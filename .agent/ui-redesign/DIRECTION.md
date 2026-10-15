# Xplayer UI direction (proposal)

Companion to `USER_PREFERENCES.md`. Shows the visual rules that every agent follows. Approval is tracked as decisions D2, D3, D8 and D9 on the board. Visual reference: the design preview (library, menu and notifications open, lyrics with nothing found, lyrics synced, theme directions).

## Idea

A dark, quiet interface like a piece of hi-fi equipment. Everything is graphite and warm white. One amber "lamp" marks what is playing and what is selected in navigation. The waveform seek bar is the single memorable element; everything else stays calm.

## Tokens (three layers)

**Primitive**

| Token | Value |
|---|---|
| `--gray-950` | `#0E1013` |
| `--gray-900` | `#13161B` |
| `--gray-850` | `#1A1E25` |
| `--gray-800` | `#20252D` |
| `--gray-700` | `#2E343E` |
| `--gray-line` | `#242932` |
| `--ink-100` | `#ECE9E3` |
| `--ink-400` | `#959AA5` |
| `--ink-500` | `#858A94` |
| `--amber-400` | `#EBA43A` |

**Semantic**

| Token | Maps to | Use |
|---|---|---|
| `--surface-ground` | gray-950 | main content, title bar |
| `--surface-panel` | gray-900 | rail, contextual panel, player |
| `--surface-raised` | gray-850 | tooltips, toasts, dialogs |
| `--surface-selected` | gray-800 | active row or item |
| `--border-subtle` | gray-line | separators between siblings |
| `--border-strong` | gray-700 | standalone views, outlined buttons |
| `--text-primary` | ink-100 | main text |
| `--text-secondary` | ink-400 | metadata, labels |
| `--text-tertiary` | ink-500 | shortcuts, row numbers (never for essential text) |
| `--accent` | amber-400 | playing item, active nav marker, played waveform, success tick |
| `--accent-soft` | amber-400 at 10% | playing row background |

**Component** (examples): `--button-primary-bg: var(--text-primary)`, `--button-primary-fg: var(--surface-ground)`, `--row-height: 56px` (compact `36px`), `--tooltip-bg: var(--surface-raised)`.

The old themes (green `#1db954`, pink `#ff6b9d`, purple `#9d4edd`, yellow `#ffd43b`, white `#f8f9fa`) remain as alternative values for `--accent`. Accent must keep at least 4.5:1 against `--surface-panel`; the white theme needs a dark foreground where it is used as a fill.

## Contrast (measured)

| Pair | Ratio |
|---|---|
| text-primary on ground | 15.7 |
| text-secondary on ground / panel / raised | 6.8 / 6.4 / 5.9 |
| text-tertiary on ground / panel / raised | 5.5 / 5.2 / 4.8 |
| accent on ground / panel | 9.0 / 8.6 |

## Themes

Themes swap only the five base values (ground, surface, border, accent, text) plus a secondary text value. Component styles never use raw hex. Starting values, to tune on screen:

| Theme | Ground | Surface | Border | Accent | Text | Status |
|---|---|---|---|---|---|---|
| Warm Graphite | `#0E1013` | `#13161B` | `#242932` | `#EBA43A` | `#ECE9E3` | Default |
| Deep Forest | `#0B100E` | `#101714` | `#1F2B26` | `#8FD3A6` | `#E6EBE5` | Shortlist |
| Espresso and Copper | `#120E0B` | `#1A1410` | `#2E241C` | `#CF8352` | `#F0E6D8` | Shortlist |
| Midnight Blue | `#0B0F17` | `#101623` | `#1E2A3D` | `#7CC4F2` | `#E4EAF2` | Later |
| Aubergine and Rose | `#120D14` | `#181119` | `#2D2030` | `#D98FA6` | `#EEE6EA` | Later |
| Porcelain and Teal | `#F6F3EE` | `#EFEBE4` | `#DDD6CB` | `#176866` | `#1D1F22` | Later (light mode) |

Accent on surface contrast: 8.6, 10.4, 6.1, 9.5, 7.4, 5.5. Porcelain needs its own treatment for album art, borders and text hierarchy; it is not an inverted dark theme. Error color (icon only, never the only signal): `#F08A80` in dark themes.

## Title bar

- Left: the logo as a button with a small chevron. It opens the app menu with File, View, Playback and Help, each opening a submenu. No app name text.
- Next to it: back and forward buttons (forward dimmed when there is nowhere to go).
- Right: notification bell, then minimize, maximize, close. The bell shows an accent dot while something is running or unread.
- The bell opens a notification center: "In progress" (title, count, progress bar, cancel) and "Earlier" (confirmations; errors say what happened and offer a next step).
- Menu shortcut labels must match the real app (Space, S, R, M, Left and Right for 5 seconds, Ctrl plus Up and Down for volume).

## Library panel

- Top: title, new playlist, expand.
- Filter chips: All, Playlists, Folders, Albums, Artists (one active at a time, active chip uses the primary fill).
- Below the chips: find in library and a sort menu (default: recently played).
- Then one list of everything: favorites, playlists, folders, albums, artists. Each row has art (round for artists), name, a type and count line, and a pin mark. The playing item uses the accent color.
- Expanded mode adds columns and tools using the same rows. Songs themselves are shown in the main area.

## Type

- Interface: IBM Plex Sans 400, 500, 600, tabular numbers on for times, counts, columns.
- Lyrics and empty-state headlines: Newsreader 400 and 500.
- Scale: 12, 13, 14, 16, 18, 28, 34, 40 px. Lyrics size stays user-adjustable.
- Sentence case everywhere. No all-caps labels, no tracking tricks.

## Layout and relationships

- Window: title bar 36, nav rail 56, contextual panel 300 (compact) or fills the width (expanded), player bar 88.
- Siblings (rail and panel) share the panel surface and are separated by a 1 px border. Parent and child use one surface step. Standalone views (tooltip, toast, dialog) use the raised surface plus a strong border.
- Radii: 4 for thumbnails, 6 for controls, 10 for standalone views. Nothing else.
- Spacing scale: 4, 8, 12, 16, 24, 32.

## Interaction

- Tooltip: name, current state (dim), shortcut (dimmer, right side). Short hover delay, no animation.
- Toasts for quick confirmations (bottom right, above the player). A status button in the title bar for scans and downloads, with progress.
- Song list: configurable and resizable columns, comfortable and compact density.
- Lyrics: four separate modes (Lyrics, Find online, Write, Sync timing). Empty state gives three clear actions.
- Motion: only for state changes the user caused. One startup animation, cheap and continuous.

## Icons

Lucide, 1.75 px stroke, 16 px in dense controls and 18 to 20 px elsewhere. One set only.

## Known open points

- Waveform data source (decode on demand versus precomputed and cached) needs a short spike before task C-02.
- Whether Search stays in the rail or moves inside Library.
