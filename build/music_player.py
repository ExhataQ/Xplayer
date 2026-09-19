import os
import json
import sys
import platform
import time
import logging
import base64
from datetime import datetime


script_dir = os.path.dirname(os.path.abspath(__file__))
source_root = os.path.dirname(script_dir)
base_dir = os.path.dirname(source_root)
app_dir = os.path.join(base_dir, "App")
output_dir = os.path.join(app_dir, "MusicPlayerOutput")
covers_folder = os.path.join(output_dir, "covers")

log_path = os.path.join(output_dir, "music_player_errors.log")
os.makedirs(output_dir, exist_ok=True)

logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logging.info("=== Music Player Build Started ===")
logging.info(f"System: {platform.system()} {platform.release()}")
logging.info(f"Python: {platform.python_version()}")
logging.info(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
logging.info("=" * 50)

print("\n" + "=" * 60)
print("🎵  MUSIC PLAYER — BUILD & DEPLOY")
print("=" * 60)


def create_placeholder_image():
    default_cover_path = os.path.join(script_dir, "default-cover.svg")
    if os.path.exists(default_cover_path):
        with open(default_cover_path, "r", encoding="utf-8") as f:
            svg = f.read()
        return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("utf-8")

    svg = '''<svg width="45" height="45" viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="noteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#a9adb3"/>
                <stop offset="100%" stop-color="#6f7580"/>
            </linearGradient>
        </defs>
        <rect width="45" height="45" rx="6" fill="#2a2a2a"/>
        <g fill="url(#noteGrad)" transform="scale(0.088)">
            <path d="M300 118 h26 v230 a62 62 0 1 1 -26 -50 Z"/>
            <ellipse cx="255" cy="358" rx="58" ry="42" transform="rotate(-16 255 358)"/>
            <path d="M326 118 C 392 138, 410 200, 372 246 C 384 206, 366 168, 322 152 Z"/>
        </g>
    </svg>'''
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("utf-8")


def extract_deployed_data():
    deployed_js = os.path.join(output_dir, "player.js")
    songs = []
    placeholder = None

    if not os.path.exists(deployed_js):
        return songs, placeholder

    try:
        with open(deployed_js, "r", encoding="utf-8") as f:
            content = f.read()

        songs_match = content.find("const SONGS_DATA = ")
        if songs_match != -1:
            start = content.find("[", songs_match)
            if start != -1:
                depth = 0
                in_string = False
                escape = False
                end = -1
                for i in range(start, len(content)):
                    ch = content[i]
                    if escape:
                        escape = False
                        continue
                    if ch == "\\":
                        escape = True
                        continue
                    if ch == '"':
                        in_string = not in_string
                        continue
                    if in_string:
                        continue
                    if ch == "[":
                        depth += 1
                    elif ch == "]":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
                if end != -1:
                    try:
                        songs = json.loads(content[start:end])
                    except Exception:
                        songs = []

        placeholder_match = content.find('const PLACEHOLDER_IMAGE = "')
        if placeholder_match != -1:
            pstart = placeholder_match + len('const PLACEHOLDER_IMAGE = "')
            pend = content.find('"', pstart)
            if pend != -1:
                placeholder = content[pstart:pend]
    except Exception as e:
        logging.warning(f"Failed to extract deployed data: {e}")

    return songs, placeholder


def generate_html_template(songs_data, placeholder_image):
    template_path = os.path.join(script_dir, "music_player.html")
    js_template_path = os.path.join(source_root, "src", "js", "99-player.js")

    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()
    with open(js_template_path, "r", encoding="utf-8") as f:
        js_template = f.read()

    songs_json = json.dumps(songs_data, ensure_ascii=False)
    songs_count = len(songs_data)

    js_content = js_template.replace("{{SONGS_DATA}}", songs_json)
    js_content = js_content.replace("{{PLACEHOLDER_IMAGE}}", placeholder_image)

    with open(os.path.join(output_dir, "player.js"), "w", encoding="utf-8") as f:
        f.write(js_content)

    import shutil

    output_js_dir = os.path.join(output_dir, "js")
    output_css_dir = os.path.join(output_dir, "css")
    os.makedirs(output_js_dir, exist_ok=True)
    os.makedirs(output_css_dir, exist_ok=True)

    simple_js_files = [
        "00-state.js",
        "01-sizes.js",
        "02-ghost-list.js",
        "03-storage.js",
        "04a-ui-render-core.js",
        "04b-ui-render-views.js",
        "05-lazy-load.js",
        "06a-context-menus.js",
        "06b-modals.js",
        "06c-ui-widgets.js",
        "07-views.js",
        "08-panels.js",
        "09-folders-playlists.js",
        "10-playback.js",
        "11-lrc.js",
        "12-color-extract.js",
        "13-song-highlight.js",
        "14-song-navigation.js",
        "15-playback-controls.js",
        "16-context-menu-actions.js",
        "17-song-selection.js",
        "18-lyrics-editor.js",
        "19-online-lyrics.js",
        "20-metadata-editor.js",
        "21-language-detect.js",
    ]
    for name in simple_js_files:
        shutil.copy2(
            os.path.join(source_root, "src", "js", name),
            os.path.join(output_js_dir, name)
        )

    css_files = [
        "base.css",
        "notifications.css",
        "left-panel.css",
        "right-panel.css",
        "header-topbar.css",
        "song-list.css",
        "context-menu.css",
        "player.css",
        "fullscreen-viewer.css",
        "search-history.css",
        "lyrics.css",
        "metadata-editor.css",
        "placeholders.css",
    ]
    for name in css_files:
        shutil.copy2(
            os.path.join(source_root, "src", "css", name),
            os.path.join(output_css_dir, name)
        )

    electron_dir = os.path.join(source_root, "electron")
    if os.path.exists(electron_dir):
        for config_file in ["main.js", "preload.js", "package.json", "scan-folder.js", "window-manager.js", "loading-window.js", "scanner.js", "music-folders.js", "downloads.js", "file-operations.js", "online-lyrics.js", "online-metadata.js", "metadata-editor.js", "metadata-editor.py"]:
            src = os.path.join(electron_dir, config_file)
            dst = os.path.join(app_dir, config_file)
            if os.path.exists(src):
                shutil.copy2(src, dst)

    node_modules_src = os.path.join(base_dir, "more tools", "node_modules")
    node_modules_dst = os.path.join(app_dir, "node_modules")
    if os.path.exists(node_modules_src):
        nm_start = time.time()
        if os.path.exists(node_modules_dst):
            shutil.rmtree(node_modules_dst)
        shutil.copytree(node_modules_src, node_modules_dst)
        print(f"  ✅  node_modules synced from {node_modules_src} ({time.time() - nm_start:.2f}s)")
    else:
        print(f"  ⚠️  node_modules source not found at {node_modules_src} — skipping sync")

    icon_src = os.path.join(script_dir, "icon.png")
    if os.path.exists(icon_src):
        shutil.copy2(icon_src, os.path.join(app_dir, "icon.png"))

    icons_dir_src = os.path.join(source_root, "tools", "icons")
    icons_dir_dst = os.path.join(output_dir, "icons")
    if os.path.exists(icons_dir_src):
        os.makedirs(icons_dir_dst, exist_ok=True)
        for name in ["prev.png", "play.png", "pause.png", "next.png", "play.svg", "pause.svg", "lyrics.svg"]:
            fsrc = os.path.join(icons_dir_src, name)
            fdst = os.path.join(icons_dir_dst, name)
            if os.path.exists(fsrc):
                shutil.copy2(fsrc, fdst)

    fonts_dir = os.path.join(output_dir, "fonts")
    os.makedirs(fonts_dir, exist_ok=True)
    font_source_dir = os.path.join(source_root, "tools", "fonts")
    font_assets = [
        "all.min.css",
        "material-icons.css",
        "fa-solid-900.woff2",
        "fa-regular-400.woff2",
        "fa-brands-400.woff2",
        "material-symbols-outlined.woff2",
    ]
    font_urls = {
        "all.min.css": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
        "fa-solid-900.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2",
        "fa-regular-400.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2",
        "fa-brands-400.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2",
        "material-symbols-outlined.woff2": "https://fonts.gstatic.com/s/materialsymbolsoutlined/v226/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1n-q_4MrImHCIJIZrDCvHOej.woff2",
    }
    import urllib.request
    for font_file in font_assets:
        dst = os.path.join(fonts_dir, font_file)
        src = os.path.join(font_source_dir, font_file)
        if os.path.exists(src):
            shutil.copy2(src, dst)
        elif not os.path.exists(dst) and font_file in font_urls:
            try:
                print(f"  ⬇️  Downloading {font_file}...")
                urllib.request.urlretrieve(font_urls[font_file], dst)
            except Exception as e:
                print(f"  ⚠️  Could not download {font_file}: {e}")
    all_min_css = os.path.join(fonts_dir, "all.min.css")
    if os.path.exists(all_min_css):
        with open(all_min_css, "r", encoding="utf-8") as f:
            css_content = f.read()
        if "url(../webfonts/" in css_content:
            css_content = css_content.replace("url(../webfonts/", "url(")
            with open(all_min_css, "w", encoding="utf-8") as f:
                f.write(css_content)

    html_content = template.replace("{{SONGS_COUNT}}", str(songs_count))
    html_content = html_content.replace("{{PLACEHOLDER_IMAGE}}", placeholder_image)
    return html_content


def save_html_file(filepath, content):
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✅  {filepath}")


def launch_electron():
    import subprocess

    electron_exe = os.path.join(app_dir, "electron.exe")
    if not os.path.exists(electron_exe):
        print("  ⚠️  electron.exe not found — skipping launch")
        return

    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq electron.exe"],
            capture_output=True, text=True
        )
        if "electron.exe" in result.stdout:
            subprocess.run(["taskkill", "/F", "/IM", "electron.exe"], capture_output=True)
    except Exception:
        pass

    subprocess.Popen([electron_exe, app_dir])
    print("  🚀  Electron launched!")


def main():
    total_start = time.time()

    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(covers_folder, exist_ok=True)

    print(f"\n📁 Output: {output_dir}")
    print(f"📦 Source: {script_dir}")

    print("\n" + "─" * 60)
    print("📖  STEP 1: READING DEPLOYED DATA")
    print("─" * 60)
    songs_data, placeholder_image = extract_deployed_data()
    if placeholder_image is None:
        placeholder_image = create_placeholder_image()
        print("  ℹ️  No deployed placeholder found — regenerating")
    else:
        print("  ℹ️  Preserved existing placeholder image")
    print(f"  ℹ️  Preserved {len(songs_data)} song(s) from deployed player.js")

    print("\n" + "─" * 60)
    print("📄  STEP 2: GENERATING HTML & JS")
    print("─" * 60)
    step2_start = time.time()
    html_output_path = os.path.join(output_dir, "music_player.html")
    html_content = generate_html_template(songs_data, placeholder_image)
    save_html_file(html_output_path, html_content)
    step2_end = time.time()
    print(f"  ⏱️  HTML/JS generation took: {step2_end - step2_start:.2f} seconds")

    total_end = time.time()
    print("\n" + "=" * 60)
    print(f"⏱️  TOTAL TIME: {total_end - total_start:.2f} seconds")
    print("=" * 60)

    print("\n" + "=" * 60)
    print("✨  DONE! MUSIC PLAYER DEPLOYED")
    print("=" * 60)
    print(f"  📁  Output folder : {output_dir}")
    print(f"  📄  HTML file     : {html_output_path}")
    print(f"  📜  JavaScript    : {os.path.join(output_dir, 'player.js')}")
    print(f"  🎨  CSS files     : {os.path.join(output_dir, 'css')}")
    print(f"  🖼️   Covers folder  : {covers_folder}")
    print("=" * 60 + "\n")

    launch_electron()

    logging.info("=== Build Summary ===")
    logging.info(f"Preserved songs: {len(songs_data)}")
    logging.info(f"Output: {output_dir}")
    logging.info(f"CSS: {os.path.join(output_dir, 'css')}")
    logging.info(f"Covers: {covers_folder}")
    logging.info(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logging.info("=" * 50)


if __name__ == "__main__":
    main()