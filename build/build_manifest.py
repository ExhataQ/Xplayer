"""Renderer load order: Source/src/manifest.json and the module entry it names.

The manifest lists every renderer stylesheet (relative to src/css/) in load order and names the one
script entry (src/js/main.js). The entry is an ES module whose static imports are the renderer's
files in the exact order they must load, so that order is kept in one place: main.js. load_manifest()
returns it as "modules". Everything that needs the order reads it from here instead of keeping its own copy:

  * build/music_player.py            copies the files and renders the HTML template
  * tools/clean_for_share.py         renders the HTML template
  * tools/tests/helpers/render-template.js   the same rendering for the browser tests

build/music_player.html is a template: {{CSS_LINKS}} and {{JS_SCRIPTS}} are replaced
with the tags below. To add, remove or reorder a renderer script, edit the imports in
src/js/main.js (tools/tests/manifest.test.js fails if main.js and the files on disk
disagree). src/js/99-player.js is NOT imported: it is the player.js build-data template,
the only classic script.
"""

import json
import os
import re

MANIFEST_RELATIVE_PATH = os.path.join("src", "manifest.json")
CSS_PLACEHOLDER = "{{CSS_LINKS}}"
JS_PLACEHOLDER = "{{JS_SCRIPTS}}"


ENTRY_IMPORT = re.compile(r"""^import\s+(['"])\./([^'"]+)\1\s*;?[ \t]*$""", re.MULTILINE)


def parse_entry_imports(source):
    """The files a module entry imports, relative to src/js/, in import order."""
    return [m.group(2) for m in ENTRY_IMPORT.finditer(source)]


def load_manifest(source_root):
    path = os.path.join(source_root, MANIFEST_RELATIVE_PATH)
    with open(path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    css = manifest.get("css")
    if not isinstance(css, list) or not css:
        raise ValueError(f"{path}: 'css' must be a non-empty list")
    entry = manifest.get("entry")
    if not isinstance(entry, str) or not entry:
        raise ValueError(f"{path}: 'entry' must name the module entry file")

    entry_path = os.path.join(source_root, "src", "js", *entry.split("/"))
    with open(entry_path, "r", encoding="utf-8") as f:
        modules = parse_entry_imports(f.read())
    if not modules:
        raise ValueError(f"{entry_path}: found no imports")

    for key, entries in (("css", css), (entry, modules)):
        duplicates = sorted({name for name in entries if entries.count(name) > 1})
        if duplicates:
            raise ValueError(f"{path}: duplicate entries in '{key}': {', '.join(duplicates)}")

    manifest["modules"] = modules
    manifest["js"] = []
    return manifest


def manifest_file_path(source_root, kind, name):
    """Absolute path of a manifest entry; entries use forward slashes (e.g. 'core/state.js')."""
    return os.path.join(source_root, "src", kind, *name.split("/"))


def render_css_links(manifest):
    return "\n".join(f'        <link rel="stylesheet" href="css/{name}">' for name in manifest["css"])


def render_js_scripts(manifest):
    # One module entry. (A type="module" script is deferred: it runs after the page is parsed, after
    # the classic player.js tag that follows this placeholder, and before DOMContentLoaded.)
    return f'        <script type="module" src="js/{manifest["entry"]}"></script>'


def render_template(template, manifest):
    for placeholder in (CSS_PLACEHOLDER, JS_PLACEHOLDER):
        if template.count(placeholder) != 1:
            raise ValueError(
                f"HTML template must contain {placeholder} exactly once "
                f"(found {template.count(placeholder)})"
            )
    return template.replace(CSS_PLACEHOLDER, render_css_links(manifest)).replace(
        JS_PLACEHOLDER, render_js_scripts(manifest)
    )
