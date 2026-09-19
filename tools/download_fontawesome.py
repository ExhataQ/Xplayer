import os
import urllib.request

script_dir = os.path.dirname(os.path.abspath(__file__))
extra_tools_dir = script_dir
source_dir = os.path.dirname(extra_tools_dir)
base_dir = os.path.dirname(source_dir)
output_dir = os.path.join(base_dir, "App", "MusicPlayerOutput", "fonts")
os.makedirs(output_dir, exist_ok=True)

files = {
    "all.min.css": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
    "fa-solid-900.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2",
    "fa-regular-400.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2",
    "fa-brands-400.woff2": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2",
}

for filename, url in files.items():
    filepath = os.path.join(output_dir, filename)
    if not os.path.exists(filepath):
        print(f"Downloading {filename}...")
        urllib.request.urlretrieve(url, filepath)
        print(f"  ✅  {filename}")
    else:
        print(f"  ⏭️  {filename} already exists")

css_filepath = os.path.join(output_dir, "all.min.css")
if os.path.exists(css_filepath):
    with open(css_filepath, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("url(../webfonts/", "url(")
    with open(css_filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("  ✅  Fixed font paths in all.min.css")

print("\n✨ Font Awesome downloaded to:", output_dir)