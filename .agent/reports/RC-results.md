# RC results
Date: 2026-11-10. App version: 1.0.0. How started: `Start-Xplayer.bat` runs `npm start` (development run). Node: v24.13.1. Was `npm install` needed: no. Data copy size: 243,784,817 bytes (232.54 MiB). C-10: applied; required files and IPC/UI wiring are present. `node tools/dev/gen-web.js --check`: generated files already up to date. Part 4 harness files are in the permitted check folder and passed syntax validation. An Xplayer development process was already running and was left untouched. All measurements use the separate data copy. The first S0 attempts failed due to CMD quoting; the corrected run succeeded.

## 1 Machine
| Fact | Result |
|---|---|
| Windows | Windows 11 Pro, 10.0.26300, build 26300 |
| Memory | 16,671,344 KB visible total; 4,151,836 KB free when sampled |
| CPU | Intel Core i5-10400F, 6 cores, 12 logical processors |
| Display/GPU | NVIDIA GeForce GTX 1660 SUPER, driver 32.0.15.7652; 1920 x 1080 at 120 Hz |
| Display scale | 96 DPI (100%) |
| Storage | KLEVV CRAS C700 RGB M.2 NVMe SSD, 240,057,409,536 bytes; TOSHIBA DT01ACA100 SATA HDD, 1,000,204,886,016 bytes |
| Volumes | Data E: (HDD); music E: (HDD). C: is on the SSD; D: and E: are on the HDD. |
| Power plan | Balanced |
| Defender | Real-time protection enabled; antivirus enabled |

## 2 Library
1,599 songs; 1,566 with a cover. Formats: `.mp3` 1,587, `.flac` 12. Audio file size: 13.91 GB; missing files: 0. Distinct music folders: 3.

Data copy parts (bytes):

| Part | Bytes |
|---|---:|
| Entire copy | 243,784,817 |
| `library/songs.json` | 1,861,416 |
| `library/covers` (1,697 files) | 123,302,553 |
| Other `library` files | 5,623,130 |
| `settings` | 3,482,466 |
| `logs` | 222,948 |
| `profiles` | 108,073,870 |
| `patch-manager` | 1,207,068 |
| Root-level files | 11,366 |

Random cover sample: 60 read, 0 failed. Width: minimum 160 px, median 160 px, maximum 1,280 px. Height: minimum 160 px, median 160 px, maximum 1,280 px. File size: median 7.55 KB, maximum 1,110.21 KB. Median decoded size (median width x median height x 4): 0.098 MB per cover.

Data copy: `Source\.dev-data\real-check\data`.

## 3 Start-up
| run | first rows (ms) | page complete (ms) |
|---|---:|---:|
| 1 (not cold; pre-existing app) | 6846 | 12074 |
| 2 | 2788 | 2915 |
| 3 | 2764 | 2895 |

## 4 Memory moments
| moment | total WS MB | total private MB | main | renderer | gpu | utility | JS heap MB | DOM nodes | listeners | images |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M0 | 536.2 | 173.1 | 44.2 | 98.8 | 17.2 | 12.8 | 15.3 | 3556 | 619 | 52 |
| M0-idle5 | 517.8 | 156.6 | 42.1 | 85.3 | 16.7 | 12.6 | 15.3 | 3578 | 619 | 52 |
| M1 | 706.5 | 241.7 | 35.9 | 181.3 | 15.7 | 8.8 | 15.3 | 7070 | 619 | 67 |
| M1b | 665.2 | 182.4 | 38.1 | 118.9 | 16.6 | 8.9 | 15.3 | 4828 | 619 | 67 |
| V-1 | 646.5 | 179.8 | 36.1 | 118.3 | 16.5 | 8.8 | 15.3 | 6178 | 724 | 68 |
| V-library | 651.0 | 182.9 | 38.0 | 119.6 | 16.5 | 8.8 | 15.3 | 6444 | 724 | 58 |
| V-search | 642.5 | 180.3 | 38.3 | 116.6 | 16.6 | 8.8 | 15.3 | 6525 | 733 | 58 |
| V-recent | 638.1 | 178.8 | 38.7 | 114.8 | 16.5 | 8.8 | 15.3 | 3392 | 681 | 79 |
| V-lyrics | 633.0 | 178.1 | 38.3 | 114.8 | 16.1 | 8.8 | 15.3 | 3546 | 706 | 45 |
| V-metadata | 643.9 | 181.7 | 38.3 | 116.5 | 18.1 | 8.8 | 15.3 | 3592 | 731 | 45 |
| V-settings | 645.0 | 182.8 | 38.3 | 117.5 | 18.1 | 8.9 | 15.3 | 5356 | 829 | 29 |
| V-library-again | 624.7 | 182.8 | 38.3 | 117.5 | 18.1 | 8.9 | 15.3 | 6044 | 829 | 39 |
| Z | 591.3 | 186.8 | 40.3 | 119.5 | 18.2 | 8.8 | 15.3 | 5367 | 829 | 29 |
| S6-start | 803.6 | 291.7 | 68.3 | 190.8 | 19.7 | 12.8 | 14.5 | 4749 | 748 | 18 |
| S6-mid | 769.4 | 368.1 | 110.4 | 225.1 | 19.8 | 12.8 | 14.5 | 64091 | 754 | 18 |
| S6-end | 769.4 | 368.1 | 110.4 | 225.1 | 19.8 | 12.8 | 14.5 | 64794 | 754 | 18 |
## 5 CPU (percent of total CPU)
| situation | average ALL | highest ALL | renderer | gpu | main |
|---|---:|---:|---:|---:|---:|
| idle 5 min | 0.04 | 0.42 | 0.04 / 0.42 | 0.00 / 0.00 | 0.00 / 0.00 |

Utility average / highest: idle 5 min: 0.00 / 0.00.
## 6 Scrolling
| direction | frames | fps | p99 ms | over 20 ms % | over 33.5 ms % |
|---|---:|---:|---:|---:|---:|
| down | 1363 | 68.1 | 33.4 | 32.3 | 0.7 |
| up | 1274 | 63.6 | 41.8 | 32.8 | 5.1 |
## 7 Growth while playing
Not measured; the Library rail button opened its panel but the main view remained on Settings. No song-list rows appeared, so the plan's permitted playback action could not be performed.
## 8 Windows and panels
| state | main | renderer | gpu | utility | total private MB |
|---|---:|---:|---:|---:|---:|
| base | 1 | 1 | 1 | 2 | 185.1 |
| open | 1 | 1 | 1 | 2 | 183.7 |
| popout | n/a | n/a | n/a | n/a | n/a |
| after | 1 | 1 | 1 | 2 | 186.6 |
## 9 Errors and anomalies
- S0-1: console errors 0
- S0-1: page errors 0
- S0-2: console errors 0
- S0-2: page errors 0
- S0-3: console errors 0
- S0-3: page errors 0
- S1-S3: console errors 0
- S1-S3: page errors 0
- S6: console errors 0
- S6: page errors 0
## 10 Steps that failed or were skipped
- S3: the AI view is not present as a rail button, so it could not be included in the view tour.
- S4 playback could not be started: the main view remained on Settings with no song-list rows, and the required page.waitForFunction timed out after 120000 ms.
- S5: AI rail button was not found.
- S6 rescan on the isolated copy: completed in 11.9 seconds; memory start 291.7 MB private / 803.6 MB WS, middle 368.1 MB private / 769.4 MB WS, end 368.1 MB private / 769.4 MB WS.
## 11 Files to send
- `RC-results.md`
- `real-check-raw.zip` — `Source\.dev-data\real-check\real-check-raw.zip`.

Privacy check: yes; redacted user paths, music/data paths, and private title/artist/album matches (no metadata matches); checked 20 titles: none found.
