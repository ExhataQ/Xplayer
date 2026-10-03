'use strict';

// Static-analysis tools (dep-map, setters and bridge tests) parse every renderer file as a
// classic script. Files listed under "modules" in src/manifest.json use `export`, which a
// script parse rejects, so this removes the keyword and leaves the declaration in place:
// to those tools a module's exported function is still a top-level function, which is how
// the rest of the app sees it (through registerLegacyGlobals).

function stripExports(source) {
    return source
        .replace(/^export\s+default\s+/gm, '')
        .replace(/^export\s+(?=(async\s+function|function|const|let|var|class)\b)/gm, '')
        .replace(/^export\s*\{[^}]*\}\s*(from\s+['"][^'"]+['"])?\s*;?[ \t]*$/gm, '')
        .replace(/^import\s[^\n]*$/gm, '');
}

module.exports = { stripExports };
