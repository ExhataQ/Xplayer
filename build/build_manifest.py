"""Renderer load order: the single source of truth is Source/src/manifest.json.

The manifest lists every renderer stylesheet (relative to src/css/) and script
(relative to src/js/) in the exact order they must load. Everything that needs that
order reads it from here instead of keeping its own copy:

  * build/music_player.py            copies the files and renders the HTML template
  * tools/clean_for_share.py         renders the HTML template
  * tools/tests/helpers/render-template.js   the same rendering for the browser tests

build/music_player.html is a template: {{CSS_LINKS}} and {{JS_SCRIPTS}} are replaced
with the tags below. To add, remove or reorder a renderer file, edit
src/manifest.json (tools/tests/manifest.test.js fails if the manifest and the files
on disk disagree). src/js/99-player.js is NOT listed: it is the player.js template.
"""

import json
import os

MANIFEST_RELATIVE_PATH = os.path.join("src", "manifest.json")
CSS_PLACEHOLDER = "{{CSS_LINKS}}"
JS_PLACEHOLDER = "{{JS_SCRIPTS}}"


def load_manifest(source_root):
    path = os.path.join(source_root, MANIFEST_RELATIVE_PATH)
    with open(path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    for key in ("css", "js"):
        entries = manifest.get(key)
        if not isinstance(entries, list) or not entries:
            raise ValueError(f"{path}: '{key}' must be a non-empty list")
        duplicates = sorted({name for name in entries if entries.count(name) > 1})
        if duplicates:
            raise ValueError(f"{path}: duplicate entries in '{key}': {', '.join(duplicates)}")
    return manifest


def manifest_file_path(source_root, kind, name):
    """Absolute path of a manifest entry; entries use forward slashes (e.g. 'core/state.js')."""
    return os.path.join(source_root, "src", kind, *name.split("/"))


def render_css_links(manifest):
    return "\n".join(f'        <link rel="stylesheet" href="css/{name}">' for name in manifest["css"])


def render_js_scripts(manifest):
    return "\n".join(f'        <script src="js/{name}"></script>' for name in manifest["js"])


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
