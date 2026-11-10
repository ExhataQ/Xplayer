'use strict';

// B8 (stable sizes): lists every CSS rule of the new UI that gives a state (hover, focus, pressed, selected, playing, open ...) a value that can
// change the size of the box or the place of its text: font size and weight, line height, letter spacing, padding, margin, border width,
// width and height, gap, and display. The rule of B8: a state may change colour, background, opacity, a transform or an outline, nothing else.
//
//   node tools/dev/state-size-scan.js            print the list
//   node tools/dev/state-size-scan.js --write    write .agent/archive/polish-2/STATE-SIZE-LIST.md
//   node tools/dev/state-size-scan.js --count    print only the number of findings (0 is the goal)
//
// It reads the style sheets as text: it finds the rules that CAN move something, not what really moves (that needs a browser measuring each
// item before and after the state). A finding is compared with the plain rule of the same element: a state that repeats the base value is not listed.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, '.agent', 'archive', 'polish-2', 'STATE-SIZE-LIST.md');
const DIRS = ['src/ui-next', 'src/css']; // the engine's sheets are included: the new UI still shows its lyrics, lists and menus

const STATE = [
    /:hover\b/g, /:focus-visible\b/g, /:focus-within\b/g, /:focus\b/g, /:active\b/g,
    /\.(?:is-)?(?:active|selected|playing|current|open|on|pressed|checked|focused|hover|dragging|drag-over|expanded|disabled|loading|synced-active|synced-past|row-hover-active|last-selected|paused-song|paused|highlighted|has-text|collapsed)(?![\w-])/g,
    /\.[\w-]+--(?:active|past|on|playing|current|selected|open|pressed|checked|expanded|lit|focused|hover|disabled|loading|paused)(?![\w-])/g,
    /\[aria-(?:selected|current|pressed|expanded|checked)(?:=['"]?[^\]'"]*['"]?)?\]/g,
    /\[data-(?:state|active|selected|playing|open|current)(?:=['"]?[^\]'"]*['"]?)?\]/g
];
const SIZE = /^(?:font-size|font-weight|font|letter-spacing|line-height|padding(?:-[a-z]+)?|margin(?:-[a-z]+)?|border(?:-(?:top|right|bottom|left))?(?:-width)?|width|height|min-width|min-height|max-width|max-height|gap|row-gap|column-gap|display|flex-basis|white-space|text-transform)$/;

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...walk(rel));
        else if (entry.name.endsWith('.css')) out.push(rel);
    }
    return out.sort();
}

/** Rules as { selector, decls: {prop: value}, line } with at-rule blocks (media, supports, layer) flattened and keyframes and font-face left out. */
function parse(file) {
    const raw = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const rules = [];
    const lineAt = (i) => css.slice(0, i).split('\n').length;
    (function block(from, to) {
        let i = from;
        while (i < to) {
            const open = css.indexOf('{', i);
            if (open < 0 || open >= to) return;
            let depth = 1;
            let j = open + 1;
            while (j < to && depth) {
                if (css[j] === '{') depth++;
                else if (css[j] === '}') depth--;
                j++;
            }
            const head = css.slice(i, open).trim();
            const body = css.slice(open + 1, j - 1);
            if (head.startsWith('@')) {
                if (!/^@(?:keyframes|font-face|-webkit-keyframes)/.test(head)) block(open + 1, j - 1);
            } else if (head) {
                const decls = {};
                for (const part of body.split(';')) {
                    const k = part.indexOf(':');
                    if (k > 0) decls[part.slice(0, k).trim().toLowerCase()] = part.slice(k + 1).replace(/!important/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
                }
                rules.push({ selector: head.replace(/\s+/g, ' '), decls, line: lineAt(css.indexOf(head.split(/\s/)[0], i)) });
            }
            i = j;
        }
    })(0, css.length);
    return rules;
}

// Splits a selector list at the commas outside brackets (`:is(a, b)` stays whole).
function selectors(list) {
    const out = [];
    let depth = 0;
    let from = 0;
    for (let i = 0; i < list.length; i++) {
        if ('([' .includes(list[i])) depth++;
        else if (')]'.includes(list[i])) depth--;
        else if (list[i] === ',' && depth === 0) {
            out.push(list.slice(from, i));
            from = i + 1;
        }
    }
    out.push(list.slice(from));
    return out.map((x) => x.trim()).filter(Boolean);
}

const stripState = (sel) => STATE.reduce((s, re) => s.replace(re, ''), sel).replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, ' $1 ').trim();
const isStateful = (sel) => STATE.some((re) => ((re.lastIndex = 0), re.test(sel)));
const borderWidth = (v) => (/(?:^|\s)(0|none)(?:\s|$)/.test(v) && !/\d+px/.test(v) ? '0' : (/(-?[\d.]+(?:px|rem|em)|thin|medium|thick)/.exec(v) || [])[1] || '');

function scan() {
    const all = [];
    for (const dir of DIRS) for (const file of walk(dir)) for (const rule of parse(file)) all.push({ ...rule, file });
    const base = new Map(); // plain selector -> { prop: value } (last wins)
    for (const rule of all) {
        for (const part of selectors(rule.selector)) {
            const sel = part.trim().replace(/\s*([>+~])\s*/g, ' $1 ');
            if (isStateful(sel)) continue;
            base.set(sel, { ...(base.get(sel) || {}), ...rule.decls });
        }
    }
    const found = [];
    for (const rule of all) {
        for (const part of selectors(rule.selector)) {
            const sel = part.trim();
            if (!isStateful(sel)) continue;
            const plain = base.get(stripState(sel)) || {};
            for (const [prop, value] of Object.entries(rule.decls)) {
                if (!SIZE.test(prop)) continue;
                const was = plain[prop];
                if (was === value) continue;
                if (/^border/.test(prop) && borderWidth(value) === (borderWidth(was || '') || '0') && borderWidth(value) !== '') continue;
                if (/^border/.test(prop) && !/\d|thin|medium|thick|none|0/.test(value)) continue; // colour only (a var()): no width given
                if (/^(?:font|line-height)$/.test(prop) && /inherit/.test(value) && !was) continue;
                found.push({ file: rule.file, line: rule.line, selector: sel, prop, was: was === undefined ? '(not set)' : was, now: value, pseudo: /::?(?:before|after)\s*$/.test(sel) });
            }
        }
    }
    const seen = new Set();
    return found.filter((f) => {
        const key = `${f.file}|${f.selector}|${f.prop}|${f.now}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

const cell = (s) => String(s).replace(/\|/g, '\\|');
function render(all) {
    const list = all.filter((f) => !f.pseudo); // ::before and ::after are decorations drawn over the box, they take no room in the layout unless they are in the flow: counted, not listed
    const out = ['# State size list (generated, do not edit by hand)', ''];
    out.push('Made by `node tools/dev/state-size-scan.js --write`. B8 rule: a state (hover, focus, pressed, selected, playing, open) may change colour, background, opacity, a transform or an outline, and nothing that moves the layout. Each row below is a state rule that sets a size-related value different from the plain rule of the same element. It is a list of candidates read from the style sheets; the browser measurement is what proves a row really moves something.', '');
    out.push(`**${list.length} findings in ${new Set(list.map((f) => f.file)).size} files** (and ${all.length - list.length} on ::before and ::after, not listed).`, '');
    for (const file of [...new Set(list.map((f) => f.file))]) {
        out.push(`## ${file}`, '', '| Line | State selector | Property | Plain rule | State rule |', '|---|---|---|---|---|');
        for (const f of list.filter((x) => x.file === file)) out.push(`| ${f.line} | \`${cell(f.selector)}\` | ${f.prop} | ${cell(f.was)} | ${cell(f.now)} |`);
        out.push('');
    }
    return out.join('\n');
}

if (require.main === module) {
    const list = scan();
    const mode = process.argv[2];
    if (mode === '--count') console.log(list.filter((f) => !f.pseudo).length);
    else if (mode === '--write') {
        fs.writeFileSync(OUT, render(list));
        console.log(`Wrote ${path.relative(ROOT, OUT)}: ${list.filter((f) => !f.pseudo).length} findings.`);
    } else process.stdout.write(render(list));
}

module.exports = { scan, parse };
