'use strict';

// B7: writes one table of every tooltip in the source, for the owner to mark (keep, remove, new text).
//
//   node tools/dev/tooltip-table.js            write .agent/archive/polish-2/TOOLTIP-TABLE.md
//   node tools/dev/tooltip-table.js --check    exit 1 when the file on disk is not what the source gives now
//   node tools/dev/tooltip-table.js --stdout   print it, write nothing
//
// It reads the source (not the generated pages), so the table cannot go stale: run it again and it is current.
// Every row has an id made from where the tooltip is and what it says, so a row keeps its id while the text and the place stay the same.
// What it finds: iconButton() labels and their `tooltip` option, attachTooltip() content, the player's transport buttons, the rail,
// the engine's `title` / `data-original-title` / `data-tip*` (in the page template and in code), `title` given to el(), and the
// rules in shell/tooltips.js. A text that is built at run time is shown as a pattern, with the code in the Source column.
// It reads text only: it cannot see which controls are on screen at a given moment. See the "Coverage" section it writes.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, '.agent', 'archive', 'polish-2', 'TOOLTIP-TABLE.md');
const SCAN = ['src/ui-next', 'src/js', 'src/old-ui'];
const SKIP = [/[\\/]dev[\\/]components-gallery\.js$/, /[\\/]dev[\\/]components\.html$/, /[\\/]99-player\.js$/];
const ATTRS = ['title', 'data-original-title', 'data-tip', 'data-tip-description', 'data-tip-state', 'data-tip-shortcut'];
const DOM_LHS = /^(btn|el|find|view|node|button|icon|toggle|\w+Btn\w*|\w+Button\w*)$/;

// ---------- reading code ----------

function files(dir) {
    const out = [];
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...files(rel));
        else if (/\.(js|html)$/.test(entry.name) && !SKIP.some((re) => re.test(rel))) out.push(rel);
    }
    return out.sort();
}

// Index of the character after the string or comment that starts at i (text[i] is a quote or a slash pair), or i when it starts none.
function skipLiteral(text, i) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') return text.indexOf('\n', i) < 0 ? text.length : text.indexOf('\n', i);
    if (c === '/' && text[i + 1] === '*') return text.indexOf('*/', i) < 0 ? text.length : text.indexOf('*/', i) + 2;
    if (c !== "'" && c !== '"' && c !== '`') return i;
    for (let j = i + 1; j < text.length; j++) {
        if (text[j] === '\\') j++;
        else if (c === '`' && text[j] === '$' && text[j + 1] === '{') j = matchClose(text, j + 1) ;
        else if (text[j] === c) return j + 1;
    }
    return text.length;
}

// Index of the bracket that closes the one at `open`.
function matchClose(text, open) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        const skipped = skipLiteral(text, i);
        if (skipped !== i) {
            i = skipped - 1;
            continue;
        }
        if ('([{'.includes(text[i])) depth++;
        else if (')]}'.includes(text[i]) && --depth === 0) return i;
    }
    return text.length - 1;
}

// Splits at `sep` outside brackets and strings.
function splitTop(text, sep = ',') {
    const parts = [];
    let depth = 0;
    let from = 0;
    for (let i = 0; i < text.length; i++) {
        const skipped = skipLiteral(text, i);
        if (skipped !== i) {
            i = skipped - 1;
            continue;
        }
        if ('([{'.includes(text[i])) depth++;
        else if (')]}'.includes(text[i])) depth--;
        else if (depth === 0 && text[i] === sep) {
            parts.push(text.slice(from, i));
            from = i + 1;
        }
    }
    parts.push(text.slice(from));
    return parts.map((part) => part.trim()).filter(Boolean);
}

// Index of a top-level character (outside brackets and strings), or -1.
function indexTop(text, ch) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const skipped = skipLiteral(text, i);
        if (skipped !== i) {
            i = skipped - 1;
            continue;
        }
        if ('([{'.includes(text[i])) depth++;
        else if (')]}'.includes(text[i])) depth--;
        else if (depth === 0 && text[i] === ch) return i;
    }
    return -1;
}

const flat = (text) => text.replace(/\s+/g, ' ').trim();
const unescape = (s) => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, ' ');

// ---------- turning an expression into text ----------

/** A readable form of an expression: literals as text, ternaries as "A / B", concatenations with {names} for the parts built at run time. */
function describe(expr, consts) {
    const e = expr.trim().replace(/^\(([\s\S]*)\)$/, (m, inner) => (matchClose(m, 0) === m.length - 1 ? inner : m)).trim();
    if (!e) return '';
    const q = indexTop(e, '?');
    if (q > 0 && !/^[^'"`]*\?\./.test(e.slice(0, q + 2))) {
        const rest = e.slice(q + 1);
        const c = indexTop(rest, ':');
        if (c > 0) return `${describe(rest.slice(0, c), consts) || '(nothing)'} / ${describe(rest.slice(c + 1), consts) || '(nothing)'}`;
    }
    const plus = splitTop(e, '+');
    if (plus.length > 1) return plus.map((p) => describe(p, consts)).join('');
    const literal = /^(['"`])([\s\S]*)\1$/.exec(e);
    if (literal && skipLiteral(e, 0) === e.length) {
        return unescape(literal[2]).replace(/\$\{([^}]*)\}/g, (m, inner) => (inner.includes('/Q/g') ? '{song title}' : `{${flat(inner)}}`));
    }
    if (/^[A-Za-z_$][\w$]*$/.test(e) && consts[e] !== undefined) return consts[e];
    if (e === 'null' || e === 'undefined') return '';
    return `{${flat(e).slice(0, 70)}}`;
}

const isDynamic = (text) => /\{[^}]+\}/.test(text);

function constsOf(text) {
    const out = {};
    for (const m of text.matchAll(/^(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*;/gm)) out[m[1]] = unescape(m[2].slice(1, -1));
    return out;
}

/** Object fields of `{ a: x, b: y }` (also the first object found in a function body or ternary). Later objects fill missing keys. */
function fieldsOf(expr) {
    const out = {};
    const objects = [];
    for (let i = 0; i < expr.length; i++) {
        const skipped = skipLiteral(expr, i);
        if (skipped !== i) {
            i = skipped - 1;
        } else if (expr[i] === '{') {
            const close = matchClose(expr, i);
            objects.push(expr.slice(i + 1, close));
            i = close;
        }
    }
    for (const body of objects) {
        for (const part of splitTop(body)) {
            const m = /^['"]?([\w-]+)['"]?\s*:\s*([\s\S]+)$/.exec(part);
            if (m && out[m[1]] === undefined) out[m[1]] = m[2];
        }
    }
    return out;
}

// ---------- scanning ----------

// `/"/g` (a quote inside a regex literal) would be read as the start of a string; the text is only read, never run, so it is swapped for a plain one.
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n').replace(/\/[\"']\/g/g, '/Q/g');
const PLUMBING = [/shell[\\/]tooltips\.js$/, /js[\\/]ui[\\/]06d-tooltip-system\.js$/, /js[\\/]ui[\\/]06e-tooltip-titles\.js$/]; // they move text around; 06e's fixed names are real texts and are still read

const rows = [];
const notes = { noTooltip: 0, files: new Set() };

function add(row, file, text, offset) {
    const line = text.slice(0, offset).split('\n').length;
    rows.push({ name: '', state: '', description: '', shortcut: '', note: '', ...row, file, line });
}

function tooltipParts(expr, consts) {
    const f = fieldsOf(expr);
    return {
        name: f.name ? describe(f.name, consts) : '',
        state: f.state ? describe(f.state, consts) : '',
        description: f.description ? describe(f.description, consts) : '',
        shortcut: f.shortcut ? describe(f.shortcut, consts) : ''
    };
}

function scanIconButtons(file, text, consts) {
    for (const m of text.matchAll(/\biconButton\(/g)) {
        const open = m.index + m[0].length - 1;
        const args = text.slice(open + 1, matchClose(text, open));
        if (!args.trim().startsWith('{')) continue; // the definition itself
        const f = fieldsOf(args.trim().slice(0, matchClose(args.trim(), 0) + 1));
        if (!f.label) continue;
        if (flat(f.tooltip || '') === 'false') {
            notes.noTooltip++;
            continue;
        }
        const label = describe(f.label, consts);
        const extra = f.tooltip ? tooltipParts(f.tooltip, consts) : {};
        const follows = /^\s*\(?\s*\)?\s*=>/.test(f.tooltip || '') && !extra.name;
        add(
            { area: 'icon button', control: `icon ${describe(f.icon || '', consts)}${f.className ? ` (${describe(f.className, consts)})` : ''}`, ...extra, name: extra.name || label, note: follows ? 'The name follows the button\u2019s label, which changes with its state.' : '' },
            file,
            text,
            m.index
        );
    }
}

function scanAttachTooltip(file, text, consts) {
    for (const m of text.matchAll(/\battachTooltip\(/g)) {
        const open = m.index + m[0].length - 1;
        const args = splitTop(text.slice(open + 1, matchClose(text, open)));
        if (args.length < 2 || /^(target|node)\b/.test(args[0]) && /function|export/.test(text.slice(Math.max(0, m.index - 30), m.index))) continue;
        const content = args[1];
        if (/^[A-Za-z_$][\w$]*$/.test(content)) continue; // a variable: the file has its own rule below
        add({ area: 'own tooltip', control: describe(args[0], consts).replace(/^\{|\}$/g, ''), ...tooltipParts(content, consts) }, file, text, m.index);
    }
}

// The player's buttons are a table of [name, () => ({...}), toggle] rows.
function scanTransport(file, text, consts) {
    if (!/transport\.js$/.test(file)) return;
    for (const m of text.matchAll(/^\s*\['([\w-]+)',\s*(\(\) => [\s\S]*?),\s*(?:true|false)\]/gm)) {
        const idle = /idle\(\)\s*\?\s*null/.test(m[2]);
        add({ area: 'player', control: `player ${m[1]}`, ...tooltipParts(m[2], consts), note: idle ? 'No tooltip while no song is loaded.' : '' }, file, text, m.index);
    }
}

function scanRail(file, text, consts) {
    if (!/shell[\\/]shell\.js$/.test(file)) return;
    for (const m of text.matchAll(/^\s*\{ id: ('[\w-]+'|AI_VIEW_ID), label: '([^']+)'/gm)) {
        add({ area: 'rail', control: `rail ${m[1].replace(/'/g, '')}`, name: m[2], note: /rail: false/.test(text.slice(m.index, text.indexOf('\n', m.index))) ? 'Not on the rail itself (opened from elsewhere); the label is its name.' : '' }, file, text, m.index);
    }
}

function scanShellRules(file, text) {
    if (!/shell[\\/]tooltips\.js$/.test(file)) return;
    for (const m of text.matchAll(/\{ selector: '([^']+)'([^\n]*)\}/g)) {
        const d = /description: '([^']*)'/.exec(m[2]);
        const n = /name: '([^']*)'/.exec(m[2]);
        if (d || n) add({ area: 'engine control (rule)', control: m[1], name: n ? n[1] : '', description: d ? d[1] : '', note: 'Given by a rule in shell/tooltips.js on top of the engine\u2019s own text.' }, file, text, m.index);
    }
    add({ area: 'engine control (rule)', control: '.settings-theme-btn', name: '{Theme name} theme', state: 'Current', note: 'Built from the button\u2019s data-theme.' }, file, text, text.indexOf('.settings-theme-btn'));
}

// A panel's header button: `const X_HEADER_ACTION = { icon, label, onClick }` becomes an icon button in shell.js.
function scanHeaderActions(file, text, consts) {
    for (const m of text.matchAll(/const\s+(\w*HEADER_ACTION)\s*=\s*\{/g)) {
        const open = m.index + m[0].length - 1;
        const f = fieldsOf(text.slice(open, matchClose(text, open) + 1));
        if (f.label) add({ area: 'icon button', control: `panel header button ${m[1]} (icon ${describe(f.icon || '', consts)})`, name: describe(f.label, consts) }, file, text, m.index);
    }
}

// Back and forward in the title bar are built by the adapter and get their tooltip from their aria-label.
function scanTitlebar(file, text) {
    if (!/legacy-dom-adapter\.js$/.test(file)) return;
    for (const m of text.matchAll(/h\('button#([\w-]+)\.nav-btn'[^\n]*'aria-label': '([^']+)'/g)) {
        add({ area: 'icon button', control: `title bar #${m[1]}`, name: m[2], note: 'Name comes from the button\u2019s aria-label (shell.js tooltipTitlebarButtons).' }, file, text, m.index);
    }
}

// receiver identifier -> what it was looked up with, per file
function lookups(text) {
    const out = {};
    for (const m of text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:document\.)?(getElementById|querySelector)\(\s*(['"`])([^'"`]+)\3\s*\)/g)) out[m[1]] = m[2] === 'getElementById' ? `#${m[4]}` : m[4];
    return out;
}

// identifier -> selector over the whole source, kept only when every file that defines it agrees
const GLOBAL = {};
function collectGlobal(texts) {
    const seen = {};
    for (const text of texts) for (const [id, sel] of Object.entries(lookups(text))) (seen[id] ||= new Set()).add(sel);
    for (const [id, set] of Object.entries(seen)) if (set.size === 1) GLOBAL[id] = [...set][0];
}

function scanAttributeCalls(file, text, consts) {
    if (PLUMBING.some((re) => re.test(file)) && !/06e-/.test(file)) return;
    const known = { ...GLOBAL, ...lookups(text) };
    const ui = file.startsWith('src/ui-next') ? 'new UI' : 'engine';
    for (const m of text.matchAll(/([\w.$\]\[]+)\.setAttribute\(\s*'(title|data-original-title|data-tip|data-tip-description|data-tip-state|data-tip-shortcut)'\s*,/g)) {
        const open = text.indexOf('(', m.index + m[1].length);
        const args = splitTop(text.slice(open + 1, matchClose(text, open)));
        if (args.length < 2) continue;
        const value = describe(args[1], consts);
        if (!value || value === '{titleText}') continue;
        const control = known[m[1]] || m[1];
        addAttr(ui, control, m[2], value, file, text, m.index);
    }
    for (const m of text.matchAll(/\b(\w+)\.title\s*=\s*([^;\n]+);/g)) {
        if (!DOM_LHS.test(m[1])) continue;
        const value = describe(m[2], consts);
        if (!value) continue;
        addAttr(ui, known[m[1]] || m[1], 'title', value, file, text, m.index);
    }
    for (const m of text.matchAll(/\bel\(\s*'[a-z0-9]+'\s*,\s*\{/g)) {
        const open = m.index + m[0].length - 1;
        const f = fieldsOf(text.slice(open, matchClose(text, open) + 1));
        if (!f.title) continue;
        const value = describe(f.title, consts);
        if (value) addAttr(ui, `${(/el\(\s*'([a-z0-9]+)'/.exec(m[0]) || [])[1]}${f.class ? ` (${describe(f.class, consts)})` : ''}`, 'title', value, file, text, m.index);
    }
}

function addAttr(ui, control, attr, value, file, text, offset) {
    const key = { title: 'name', 'data-original-title': 'name', 'data-tip': 'name', 'data-tip-description': 'description', 'data-tip-state': 'state', 'data-tip-shortcut': 'shortcut' }[attr];
    add({ area: ui === 'new UI' ? 'new UI control' : 'engine control', control, [key]: value }, file, text, offset);
}

function scanHtml(file, text) {
    if (!file.endsWith('.html')) return;
    for (const m of text.matchAll(/<(\w+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
        const attrs = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
        const control = attrs.id ? `#${attrs.id}` : attrs['data-action'] ? `${m[1]} [data-action=${attrs['data-action']}]` : attrs.class ? `${m[1]}.${attrs.class.split(/\s+/)[0]}` : m[1];
        for (const attr of ATTRS) {
            if (attrs[attr] !== undefined && attrs[attr] !== '') {
                const key = { title: 'name', 'data-original-title': 'name', 'data-tip': 'name', 'data-tip-description': 'description', 'data-tip-state': 'state', 'data-tip-shortcut': 'shortcut' }[attr];
                add({ area: 'engine control', control, [key]: attrs[attr] }, file, text, m.index);
            }
        }
    }
}

// ---------- building the table ----------

const AREAS = ['rail', 'player', 'new UI control', 'icon button', 'own tooltip', 'engine control', 'engine control (rule)'];
const AREA_TITLE = {
    rail: 'Rail (left bar)',
    player: 'Player bar',
    'icon button': 'Icon buttons (new UI)',
    'own tooltip': 'Other controls with their own tooltip (new UI)',
    'new UI control': 'Other texts set on new UI controls',
    'engine control': 'Engine controls (src/js and the page template; shown in the new UI wherever the control is kept)',
    'engine control (rule)': 'Rules that add to engine tooltips'
};

function build() {
    const list = SCAN.flatMap((dir) => files(dir));
    collectGlobal(list.map(read));
    for (const dir of SCAN) {
        for (const file of files(dir)) {
            const text = read(file);
            const consts = constsOf(text);
            const before = rows.length;
            scanIconButtons(file, text, consts);
            scanAttachTooltip(file, text, consts);
            scanTransport(file, text, consts);
            scanRail(file, text, consts);
            scanShellRules(file, text);
            scanAttributeCalls(file, text, consts);
            scanHtml(file, text);
            scanHeaderActions(file, text, consts);
            scanTitlebar(file, text);
            const calls = /\battachTooltip\(|\biconButton\(\{/.test(text) && !/components[\\/](tooltip|button)\.js$/.test(file);
            if (calls && rows.length === before && !/tooltip: false/.test(text)) notes.files.add(file);
        }
    }
    // The same control showing the same text from several places is one row; every place is listed in Source.
    const groups = new Map();
    for (const r of rows) {
        const key = [r.area, r.control, r.name, r.state, r.description, r.shortcut, r.note].join('|');
        if (!groups.has(key)) groups.set(key, { ...r, sources: [] });
        const g = groups.get(key);
        if (!g.sources.some((x) => x.file === r.file && x.line === r.line)) g.sources.push({ file: r.file, line: r.line });
    }
    const unique = [...groups.values()];
    for (const r of unique) r.id = 'T' + crypto.createHash('sha1').update([r.area, r.control, r.name, r.state, r.description, r.shortcut].join('|')).digest('hex').slice(0, 5);
    return unique.sort((a, b) => AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || a.sources[0].file.localeCompare(b.sources[0].file) || a.sources[0].line - b.sources[0].line);
}

const sourceCell = (r) => `${r.sources.slice(0, 2).map((x) => `${x.file}:${x.line}`).join(', ')}${r.sources.length > 2 ? ` (+${r.sources.length - 2} more)` : ''}`;
const cell = (s) => (s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(all) {
    const out = [];
    out.push('# Tooltip table (generated, do not edit by hand)');
    out.push('');
    out.push('Made by `node tools/dev/tooltip-table.js` from the source. Run it again to refresh it; `--check` says whether it is current.');
    out.push('');
    out.push('**How to mark it.** Copy this file, and in the **Decision** column of each row write `keep`, `remove`, or `new: <text>`. Leave a row empty to mean `keep`. Nothing is removed or changed until you hand the marked table back. Rows are matched by **ID**, so the text may be re-generated meanwhile.');
    out.push('');
    out.push('Columns: **Name** is the main line. **State** is the dim word after it (On/Off and the like). **Description** is the second line. **Shortcut** is shown on the right. Text in `{braces}` is built while the app runs (a song name, a view name); the code is in **Source**. The `/` joins the texts a control shows in different situations.');
    out.push('');
    const counts = AREAS.map((a) => `${all.filter((r) => r.area === a).length} ${AREA_TITLE[a].split(' (')[0].toLowerCase()}`).join(', ');
    out.push(`**${all.length} rows:** ${counts}.`);
    out.push('');
    for (const area of AREAS) {
        const list = all.filter((r) => r.area === area);
        if (!list.length) continue;
        out.push(`## ${AREA_TITLE[area]}`);
        out.push('');
        out.push('| ID | Control | Name | State | Description | Shortcut | Source | Decision |');
        out.push('|---|---|---|---|---|---|---|---|');
        for (const r of list) {
            out.push(`| ${r.id} | ${cell(r.control)} | ${cell(r.name)}${r.note ? ` <br>*${cell(r.note)}*` : ''} | ${cell(r.state)} | ${cell(r.description)} | ${cell(r.shortcut)} | ${sourceCell(r)} | |`);
        }
        out.push('');
    }
    out.push('## Coverage');
    out.push('');
    out.push(`- Buttons made with \`tooltip: false\` have no tooltip on purpose and are not listed (${notes.noTooltip} of them: close, dismiss, clear and scroll arrows, whose icons say it).`);
    out.push('- The window buttons (minimize, maximize, close) have no tooltip on purpose.');
    out.push('- Back and forward in the title bar are listed under icon buttons; their names come from the adapter\u2019s `aria-label`.');
    out.push('- Only text in the source is found. A tooltip whose text comes from data (a theme name, a folder path, a song title) is shown as a pattern.');
    if (notes.files.size) out.push(`- Files that build tooltips but gave no row (check by hand): ${[...notes.files].sort().join(', ')}.`);
    out.push('');
    return out.join('\n');
}

const all = build();
const text = render(all);
const mode = process.argv[2];
if (mode === '--stdout') {
    process.stdout.write(text);
} else if (mode === '--check') {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== text) {
        console.error('.agent/archive/polish-2/TOOLTIP-TABLE.md is not current. Run: node tools/dev/tooltip-table.js');
        process.exit(1);
    }
    console.log(`.agent/archive/polish-2/TOOLTIP-TABLE.md is current (${all.length} rows).`);
} else {
    fs.writeFileSync(OUT, text);
    console.log(`Wrote ${path.relative(ROOT, OUT)}: ${all.length} rows.`);
}
