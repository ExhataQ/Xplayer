import os
import urllib.request

script_dir = os.path.dirname(os.path.abspath(__file__))
extra_tools_dir = script_dir
source_dir = os.path.dirname(extra_tools_dir)
base_dir = os.path.dirname(source_dir)
output_dir = os.path.join(base_dir, "App", "MusicPlayerOutput", "fonts")
os.makedirs(output_dir, exist_ok=True)

files = {
    "material-symbols-outlined.woff2": "https://fonts.gstatic.com/s/materialsymbolsoutlined/v226/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1n-q_4MrImHCIJIZrDCvHOej.woff2",
}

for filename, url in files.items():
    filepath = os.path.join(output_dir, filename)
    if not os.path.exists(filepath):
        print(f"Downloading {filename}...")
        urllib.request.urlretrieve(url, filepath)
        print(f"  ✅  {filename}")
    else:
        print(f"  ⏭️  {filename} already exists")

css_content = """@font-face {
    font-family: 'Material Symbols Outlined';
    font-style: normal;
    font-weight: 400;
    src: url('material-symbols-outlined.woff2') format('woff2');
}

.material-symbols-outlined {
    font-family: 'Material Symbols Outlined';
    font-weight: normal;
    font-style: normal;
    font-size: 20px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
}
"""

css_filepath = os.path.join(output_dir, "material-icons.css")
if not os.path.exists(css_filepath):
    with open(css_filepath, "w", encoding="utf-8") as f:
        f.write(css_content)
    print("  ✅  material-icons.css created")
else:
    print("  ⏭️  material-icons.css already exists")

print("\n✨ Google Material Icons downloaded to:", output_dir)