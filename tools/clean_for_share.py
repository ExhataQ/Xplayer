import os
import shutil

script_dir = os.path.dirname(os.path.abspath(__file__))
source_dir = os.path.dirname(script_dir)
base_dir = os.path.dirname(source_dir)
output_dir = os.path.join(base_dir, "App", "MusicPlayerOutput")
app_dir = os.path.join(base_dir, "App")

player_js_path = os.path.join(output_dir, "player.js")
html_path = os.path.join(output_dir, "music_player.html")
covers_dir = os.path.join(output_dir, "covers")
window_state_path = os.path.join(app_dir, "window-state.json")
music_config_path = os.path.join(app_dir, "music-folder-config.json")

js_template_path = os.path.join(source_dir, "src", "js", "99-player.js")
html_template_path = os.path.join(source_dir, "build", "music_player.html")

print("\n" + "="*60)
print("🧹  CLEANING APP FOR SHARING")
print("="*60)

placeholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDUiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA0NSA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDUiIGhlaWdodD0iNDUiIHJ4PSI2IiBmaWxsPSIjMmEyYTJhIi8+PHRleHQgeD0iMjIuNSIgeT0iMjIuNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjkiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Db3ZlcjwvdGV4dD48L3N2Zz4="

with open(js_template_path, "r", encoding="utf-8") as f:
    js_content = f.read()

js_content = js_content.replace("{{SONGS_DATA}}", "[]")
js_content = js_content.replace("{{PLACEHOLDER_IMAGE}}", placeholder)

with open(player_js_path, "w", encoding="utf-8") as f:
    f.write(js_content)
print("  ✅  player.js rebuilt with 0 songs")

with open(html_template_path, "r", encoding="utf-8") as f:
    html_content = f.read()

html_content = html_content.replace("{{SONGS_COUNT}}", "0")

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)
print("  ✅  music_player.html rebuilt with 0 songs")

if os.path.exists(covers_dir):
    for file in os.listdir(covers_dir):
        file_path = os.path.join(covers_dir, file)
        if os.path.isfile(file_path):
            os.remove(file_path)
    print("  ✅  Covers folder cleared")

if os.path.exists(window_state_path):
    os.remove(window_state_path)
    print("  ✅  Window state removed")

if os.path.exists(music_config_path):
    os.remove(music_config_path)
    print("  ✅  Music folder config removed")

electron_data = os.path.join(os.path.expanduser("~"), "AppData", "Roaming", "music-player")
if os.path.exists(electron_data):
    try:
        shutil.rmtree(electron_data)
        print("  ✅  Electron user data cleared (localStorage wiped)")
    except PermissionError:
        print("  ⚠️  Could not clear Electron data - close the app first")

print("="*60)
print("✨  APP IS CLEAN AND READY TO SHARE")
print("="*60)
print(f"  📁  Share this folder: {app_dir}")
print("="*60 + "\n")