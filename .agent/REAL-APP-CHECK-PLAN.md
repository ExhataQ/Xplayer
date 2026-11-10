# Real app check: instructions for the agent on the owner's computer

**For the agent that runs on the owner's Windows 11 PC.** Do the steps below exactly, in order, and write what you measure into `Source\.agent\reports\RC-results.md` using the template in part 12. Measure and report. Do not interpret, tune or fix anything: the owner and Claude decide what to do from your numbers.

Why: the owner sees high RAM use in Xplayer and wonders whether a rewrite (Rust, Tauri) would help. We have no real numbers yet; the app's tests only ever ran in a headless browser. This check says where the memory and the CPU go, on the real machine, with the real library.

What is already known (do not redo): hardware acceleration is **off** by design (`electron/main.js`); the owner's earlier GPU comparison (GTX 1660 Super) showed no difference, so it stays off. A first 3-minute recording on this PC showed about 710 to 810 MB in total, the page process growing by 142 MB while its JS heap stayed at 15 MB, and CPU averaging 4.3%, mostly in Settings. That is not enough to conclude anything.

## Rules (read first)

1. **Never edit a file under `Source\` except `.agent\reports\RC-results.md`.** No code, no tests, no CHANGELOG, no plan files. No git commands.
2. **Work on a copy of the owner's data**, never the original (part 3). The app writes settings and the songs list while it runs; the copy takes that.
3. **Write only inside** `Source\.dev-data\real-check\` (scripts, raw files, the copy) and the results file. Do not delete anything outside that folder. Do not install anything globally. `npm install` inside `Source` is allowed only if `node_modules` is missing, and say so in the results.
4. **Do not use the app for anything but the actions listed.** Allowed: starting and closing the app, clicking rail buttons, the title-bar panel buttons, the queue button, scrolling the song list, double-clicking a song row to play it, pause. Not allowed: scanning or rebuilding the library, adding or removing songs or folders, editing tags, deleting, sending anything in the AI chat, entering a key, changing a setting, downloading.
5. **Privacy.** The results and raw files must contain **no song titles, artist or album names, folder or file paths, and not the Windows user name**. Replace `C:\Users\<name>` with `<home>` and any music path with `<music>`. Before finishing, do the check in part 12.
6. **Nothing is uploaded or sent anywhere.** The owner sends the results by hand.
7. If a step fails or a tool is missing, write what happened in the results (part 12, "Steps that failed or were skipped") and **go on to the next step**. Do not improvise a different measurement. Stop and ask the owner only if the app will not start at all, or if a step would break rule 1, 2 or 4.
8. Write the results file **after every part**, not only at the end, so a half-finished run still helps.
9. Ask the owner, at the start and once: "Please mute Windows sound, close other programs, and do not touch the mouse or keyboard or cover the Xplayer window until I say I am done." Chromium slows down a covered or minimised window, which would spoil the numbers. Total time about 2 hours 15 minutes; part 9 (60 min) is the longest.

## 1. Before anything: check the build

- `Source\electron\perf-recorder.js`, `Source\electron\memory-report.js` and `Source\.agent\MANUAL-CHECKS-C.md` must exist. If not, stop and tell the owner: "Apply the C-10 patch first."
- `node --version` must be 22 or higher. `Source\node_modules\playwright` must exist (`dir Source\node_modules\playwright`). If `node_modules` is missing, run `npm install` in `Source` and note it.
- Record: the app version (`package.json`), `node --version`, today's date and time, and how the owner normally starts the app (`Start-Xplayer.bat` runs `npm start`, the development run; there is no packaged build unless the owner says so).

## 2. Machine facts (PowerShell, read-only)

Run and copy the answers into the results, part 12 section 1:

```powershell
Get-CimInstance Win32_OperatingSystem | Select Caption, Version, BuildNumber, FreePhysicalMemory, TotalVisibleMemorySize
Get-CimInstance Win32_Processor | Select Name, NumberOfCores, NumberOfLogicalProcessors
Get-CimInstance Win32_VideoController | Select Name, DriverVersion, CurrentHorizontalResolution, CurrentVerticalResolution, CurrentRefreshRate
Get-PhysicalDisk | Select FriendlyName, MediaType, BusType, Size
(Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics').AppliedDPI     # 96 = 100%, 120 = 125%, 144 = 150%
powercfg /getactivescheme
Get-MpComputerStatus | Select RealTimeProtectionEnabled, AntivirusEnabled        # Defender; if it fails, write "not readable"
```

Also note which drive letter holds the owner's music and which holds the data folder, and whether each is an SSD or a hard disk (match the drive letter to `Get-PhysicalDisk` with `Get-Partition -DriveLetter X | Get-Disk | Get-PhysicalDisk`). Write drive letters only, not folders.

## 3. The data: find it, size it, copy it

1. **Find the owner's data folder.** The development run keeps it in `Source\.dev-data` (it holds `library\songs.json` and `settings\`). If the owner uses another one (for example a portable `Xplayer-Data`), they will tell you; if two folders both have `library\songs.json`, ask which one. Never guess.
2. **Size it:** total bytes of the data folder, of `library\songs.json`, of `library\covers` (file count and bytes), of `library\` other files, of `settings\`, of `logs\`. Report names and sizes only.
3. **Copy it** to `Source\.dev-data\real-check\data` (everything, keeping the structure). If the copy would be larger than 5 GB, ask the owner before copying. Every later run uses this copy.
4. **Library facts**, with a short script run from `Source` (read-only; do not print titles or paths):
   ```js
   const store = require('./electron/songs-store');
   const songs = store.readSongs('Source/.dev-data/real-check/data/library');   // check the real signature in electron/songs-store.js first
   ```
   Report: the number of songs; how many have a cover; the count per file extension; the total size in GB of the audio files (`fs.statSync` of each file, ignore missing ones and report how many were missing); how many different folders the songs sit in (a number, not names).
5. **Cover sizes** (the first guess for the memory growth is decoded covers): take 60 covers at random from `library\covers` and report the pixel width and height (PowerShell `Add-Type -AssemblyName System.Drawing; [System.Drawing.Image]::FromFile(...)`, dispose each) as minimum, median and maximum, and the file size in KB as median and maximum. Also compute `median width × height × 4 / 1048576` in MB: what one such cover takes decoded.

## 4. The tools you will write (once), in `Source\.dev-data\real-check\`

Write these two scripts here (not in `Source`), and run everything through them so every number is measured the same way.

**A. `sample-os.ps1`**: every 10 seconds, until a stop file `stop.flag` appears, append rows to `raw\os-<scenario>.csv`. The scenario name comes as an argument. Take the list of processes as the root process (the one the harness started) plus all its descendants (follow `ParentProcessId` in `Win32_Process`), keep the ones named `electron.exe` or `Xplayer.exe`, and for each read, from `Win32_PerfFormattedData_PerfProc_Process` (match on `IDProcess`): `WorkingSet`, `WorkingSetPrivate`, `PercentProcessorTime`. Columns:
`time_iso, scenario, pid, kind, working_set_mb, private_ws_mb, cpu_pct_of_total`
- `kind` comes from the command line (`Win32_Process.CommandLine`): the text after `--type=` (`renderer`, `gpu-process`, `utility`, `crashpad-handler`), plus `--utility-sub-type=<name>` for utilities; no `--type=` means `main`.
- `cpu_pct_of_total` = `PercentProcessorTime` divided by the number of logical processors (this matches Task Manager).
- Also write, per time stamp, one row with `pid=ALL` holding the sums, so the totals are easy to read.

**B. `run.js`** (Node, run from `Source`): the harness. It needs only `child_process`, `fs`, `path`, and `playwright` from `Source\node_modules`. It:
- starts the app: `npm start -- --profile=real --data=<the copy> --yes --remote-debugging-port=9341` (these flags are in `tools/dev/start.js`; anything it does not know goes on to Electron) with the environment variable `XPLAYER_PERF=1`, as a child process, and keeps its pid as the root for the sampler;
- connects with `chromium.connectOverCDP('http://127.0.0.1:9341')` (see `tools/dev/smoke-electron.js` for the exact pattern), takes the first page, and listens to `page.on('console')` and `page.on('pageerror')`, counting errors per scenario;
- gives the helper `grab(label)`: calls `await page.evaluate(() => window.desktopApi.app.copyDiagnostics())`, reads the clipboard with `powershell -NoProfile -Command Get-Clipboard -Raw`, redacts it (rule 5) and saves it to `raw\diag-<label>.txt`; also reads `await page.evaluate(() => performance.memory.usedJSHeapSize)`, and the CDP numbers `Memory.getDOMCounters` (documents, nodes, jsEventListeners) and the count of `document.images` and writes one line to `raw\moments.csv`: `label, time_iso, js_heap_mb, dom_nodes, listeners, images`. **This overwrites the owner's clipboard; tell the owner at the end.**
- closes the app at the end of each run by closing the browser connection and stopping the process tree it started (`taskkill /PID <root> /T /F`, only for the pid it started).

## 5. S0: start-up (3 runs)

Run three times, closing the app completely between runs, with the sampler off:
- **Run 1 (cold):** right after nothing else has used the library in this session.
- **Runs 2 and 3 (warm):** start again at once.

For each: the time in milliseconds from spawning the process until the first `.view-host .song-item:not(.lazy-skeleton)` exists in the page (poll every 100 ms), and until the page's `document.readyState` is `complete`. Report all three runs.

## 6. S1: first minute and idle (library view, nothing playing)

Start the app (sampler on, scenario `s1`). When the first song rows show:
1. Wait 60 seconds without touching anything, then `grab('M0')`.
2. Stay 5 minutes in the library view, doing nothing. The sampler runs the whole time.
3. `grab('M0-idle5')`.
Report the average and the highest of `cpu_pct_of_total` for `pid=ALL` and for each `kind` during the 5 minutes.

## 7. S2: scrolling the real library

Same app run, same page, continuing from S1:
1. In the page, install a frame recorder: `requestAnimationFrame` loop pushing the gap between frames into an array (see `summarizeFrames` in `tools/dev/bench-gpu.js` for the exact formulas: frames, fps, p99, percent over 20 ms, percent over 33.5 ms).
2. Move the mouse over the song list and scroll with `page.mouse.wheel(0, 120)` every 16 ms for 20 seconds, down; then 20 seconds back up. Record the frames of the two halves separately.
3. `grab('M1')` right after. Wait 60 seconds untouched. `grab('M1b')`. (This shows whether memory is given back.)
4. Report fps, p99, percent over 20 ms and over 33.5 ms for the down and up scrolls, and the numbers of M1 and M1b next to M0.

## 8. S3: the tour of the views (still the same run)

1. Read the rail: `[...document.querySelectorAll('.rail-btn[data-view]')].map(b => b.dataset.view)`. Do not touch anything that is not a rail button.
2. For each view in that order: click its button, wait 20 seconds, then `grab('V-<viewid>')`. Do **not** type, press, or choose anything inside a view (for the AI view only look, do not click in it).
3. Then go back to the library view and wait 30 seconds; `grab('V-library-again')`.
4. Report one table of memory (`pid=ALL` private working set, and the `renderer` row) per view, and whether each view left more memory behind than before it (compare `V-library-again` with `M1b`).

## 9. S4: playing, and the long run (60 minutes)

Do this in the library view. The owner muted the sound.
1. Double-click the first song row to play it. Leave the repeat and shuffle settings exactly as they are.
2. Sampler on, scenario `s4`. Run for **10 minutes**; `grab('P10')`.
3. **Motion test (temporary, not saved):** run `document.documentElement.dataset.motion = 'reduced'` in the page. Run 5 more minutes; `grab('P15-reduced')`. Then run `delete document.documentElement.dataset.motion` to put it back. Report the average and highest CPU of `pid=ALL` and of each `kind` for the 10 normal minutes and for the 5 reduced minutes.
4. **Long run:** continue playing, doing nothing, until 60 minutes after the start of step 2. Use `grab()` at 20, 30, 40, 50 and 60 minutes (`P20` … `P60`). The app's own recording (`XPLAYER_PERF=1`) is writing `logs\perf.csv` in the copy's data folder at the same time.
5. At the end call `await page.evaluate(() => window.desktopApi.app.copyPerfSummary())`, read the clipboard like `grab` does, and save it as `raw\perf-summary.txt`. Copy `real-check\data\logs\perf.csv` to `raw\perf.csv` (it holds numbers and a view name only; check that).
6. Compute from `os-s4.csv` (`pid=ALL`, `private_ws_mb`) the **slope in MB per hour** between minute 15 and minute 60 (a straight-line fit through the samples), and the first, last and highest value. State plainly if the line is flat (under 20 MB per hour), rising, or falling.

## 10. S5: windows and panels give their memory back

Same app run, after S4 (stop the music first: click `#play-btn`):
1. Count the processes by `kind` (from the sampler's latest rows) → `base`.
2. Click the queue button, the right-panel button and the left-panel button (title bar) and the rail button for the AI view; wait 15 seconds; count by `kind` → `open`.
3. If the AI view has a "pop out" button, click it once, wait 15 seconds, count → `popout`; close that window with its own close button.
4. Close what you opened (click the same buttons again, return to the library view). Wait 30 seconds, `grab('Z')`, count by `kind` → `after`.
5. Report the counts and the private working set total for `base`, `open`, `popout`, `after`. A count or total that stays higher after closing is a finding.

## 11. S6 (optional, only if the owner says "yes"): the scan on the copy

Ask the owner once at the end: "May I time a rescan on the copy? It does not touch your real data." If yes: close the app; start it on the copy with `--profile=real --data=<the copy>` as before; in Settings > Data use the existing rebuild/rescan button; measure the seconds until the library finished and the memory (`grab`) at the start, the middle and the end; report. If no: write "skipped by the owner".

## 12. The results file

Create `Source\.agent\reports\RC-results.md` with exactly these sections (keep the numbers in tables; one short line for anything odd; no advice):

```
# RC results
Date, app version, how the app was started, Node version, was `npm install` needed, the data copy size, deviations from the plan.

## 1 Machine
(the answers of part 2, one table)

## 2 Library
songs, with cover, formats, GB, folders, missing files; data folder parts (bytes); cover sizes (min/median/max pixels, KB median/max, decoded MB per cover)

## 3 Start-up
| run | first rows (ms) | page complete (ms) |

## 4 Memory moments
| moment | total WS MB | total private MB | main | renderer | gpu | utility | JS heap MB | DOM nodes | listeners | images |
rows: M0, M0-idle5, M1, M1b, V-<each view>, V-library-again, P10, P15-reduced, P20..P60, Z

## 5 CPU (percent of total CPU)
| situation | average ALL | highest ALL | renderer | gpu | main |
rows: idle 5 min, playing 10 min, playing reduced 5 min

## 6 Scrolling
| direction | frames | fps | p99 ms | over 20 ms % | over 33.5 ms % |

## 7 Growth while playing
first, last, highest private total; slope MB/hour from minute 15 to 60; flat / rising / falling

## 8 Windows and panels
| state | main | renderer | gpu | utility | total private MB |   rows: base, open, popout, after

## 9 Errors and anomalies
console errors and page errors per scenario (counts, and the first 3 messages redacted); crashes; anything that looked wrong on screen

## 10 Steps that failed or were skipped
one line each, with the reason

## 11 Files to send
```

**Files to send** (list them at the end of the results): `RC-results.md`, and a zip `Source\.dev-data\real-check\real-check-raw.zip` of the folder `raw` (diag texts, os-*.csv, moments.csv, perf.csv, perf-summary.txt). Do not put the data copy in the zip.

**Final privacy check (required before you finish):**
1. Search the results and everything in `raw\` for: the Windows user name, `C:\Users`, every drive letter followed by `:\` that is not the app's own folder, and 20 song titles picked at random from the library (do not write the titles in the results; just report "checked 20 titles: none found"). Fix every hit by replacing it.
2. Write at the end of the results: "Privacy check done: yes/no, what was replaced".
3. Tell the owner: the clipboard was overwritten by the diagnostics texts; the copy of the data is in `Source\.dev-data\real-check\data` and can be deleted when they like; where the two files to send are.

## After the numbers (for the owner and Claude, not for the agent)

The owner sends `RC-results.md` and `real-check-raw.zip` to Claude. How the numbers will be read:
- **M0 is most of the total, and the slope is flat:** the cost is Electron itself. Options then: trimming Chromium, a Rust add-on for heavy work (the look stays), or Tauri (a large job; see the earlier opinion in the conversation).
- **Renderer grows with images and is not given back at M1b or after the views:** decoded covers. Small fix inside the app (smaller thumbnails, release images that are off screen).
- **The slope keeps rising after minute 15:** a leak. Find it with a heap snapshot comparison and fix it. The best result: a small change.
- **High CPU while idle or playing, and lower with Reduce animations:** an animation or a timer costs. Find which one.
- **Processes or memory stay higher after closing windows (part 10):** windows are kept instead of closed.
