'use strict';

// Read-only scan for things that should not be in a public repository: personal paths, your user name, e-mail addresses, key-like
// strings, library or settings files. It changes nothing.
//
//   node tools/dev/scan-history.js            the working tree
//   node tools/dev/scan-history.js --history  also every commit of every branch (needs git and a .git folder)
//   node tools/dev/scan-history.js --max 40   show at most 40 lines per kind (default 15)
//
// Test fixtures hold fake keys and fake paths on purpose; the report lists them too, so read it, do not just count it.
// Exit code: 0 nothing found, 1 something found (so it can gate a release), 2 it could not run.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.dev-data', 'Xplayer-Data']);
const TEXT_EXT = new Set(['.js', '.json', '.md', '.txt', '.html', '.css', '.yml', '.yaml', '.bat', '.ps1', '.py', '.cjs', '.mjs', '.patch', '.svg']);
const MAX_FILE = 2 * 1024 * 1024;
// A user name like "root" or "runner" is on every machine and says nothing about you.
const GENERIC_NAMES = new Set(['root', 'user', 'admin', 'administrator', 'runner', 'node', 'ubuntu', 'vagrant', 'guest', 'docker', 'claude']);
// Files that are someone's library or settings or secrets, whatever their content.
const PRIVATE_FILE = /(^|\/)(songs\.json|settings\.json|ui-choice\.json|\.env(\..*)?|[^/]*\.log)$/i;

function patterns(userName = os.userInfo().username) {
    const list = [
        { id: 'user-path', label: 'a Windows user folder', re: /[A-Za-z]:\\{1,2}Users\\{1,2}[^\\\s'"`]+/g },
        { id: 'drive-path', label: 'an absolute drive path (E:\\...)', re: /\b[D-Z]:\\{1,2}(?:Programming|Backup|Music|Source|Projects?|Dev|\.Storage)[^\s'"`]*/g },
        { id: 'key', label: 'a key-like string', re: /\b(?:sk-(?:or-v1-)?[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|Bearer\s+[A-Za-z0-9._-]{20,})/g },
        { id: 'email', label: 'an e-mail address', re: /\b[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com)(?!example\.(?:com|org))[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g }
    ];
    if (userName && userName.length >= 4 && !GENERIC_NAMES.has(userName.toLowerCase())) list.push({ id: 'user-name', label: 'your OS user name', re: new RegExp(`\\b${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi') });
    return list;
}

/** Findings in one text: [{ id, label, line, text }]. Pure, so tools/tests/logic/scan-history.test.js can try it. */
function scanText(text, pats) {
    const found = [];
    String(text).split(/\r?\n/).forEach((lineText, i) => {
        for (const p of pats) {
            p.re.lastIndex = 0;
            const m = p.re.exec(lineText);
            if (m) found.push({ id: p.id, label: p.label, line: i + 1, text: m[0].slice(0, 80) });
        }
    });
    return found;
}

function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
        } else if (TEXT_EXT.has(path.extname(entry.name).toLowerCase())) {
            yield path.join(dir, entry.name);
        }
    }
}

function scanTree(root, pats) {
    const out = [];
    for (const file of walk(root)) {
        let stat;
        try { stat = fs.statSync(file); } catch { continue; }
        if (stat.size > MAX_FILE) continue;
        const rel = path.relative(root, file).split(path.sep).join('/');
        for (const f of scanText(fs.readFileSync(file, 'utf8'), pats)) out.push({ where: `${rel}:${f.line}`, ...f });
    }
    return out;
}

/** Files in the working tree whose name says library, settings or secret. */
function privateFiles(root) {
    const out = [];
    const visit = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) visit(path.join(dir, entry.name));
            } else {
                const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/');
                if (PRIVATE_FILE.test(rel)) out.push({ id: 'private-file', label: 'a library, settings, secret or log file', where: rel, text: '' });
            }
        }
    };
    visit(root);
    return out;
}

/** The same names in any commit of any branch. */
function privateFilesInHistory(root) {
    const r = spawnSync('git', ['log', '--all', '--name-only', '--format='], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) return [];
    return [...new Set(r.stdout.split('\n').filter((n) => PRIVATE_FILE.test(n)))].map((name) => ({ id: 'private-file', label: 'a library, settings, secret or log file', where: name, text: '(in some commit)' }));
}

function scanHistory(root, pats) {
    return new Promise((resolve, reject) => {
        const child = spawn('git', ['log', '--all', '-p', '--no-color', '--format=commit %h'], { cwd: root });
        const out = [];
        let commit = '';
        let file = '';
        let rest = '';
        const handle = (line) => {
            if (line.startsWith('commit ')) commit = line.slice(7);
            else if (line.startsWith('+++ ')) file = line.slice(4).replace(/^b\//, '');
            else if (line.startsWith('+') && !line.startsWith('+++')) {
                for (const f of scanText(line.slice(1), pats)) out.push({ where: `${commit} ${file}`, ...f });
            }
        };
        child.stdout.on('data', (chunk) => {
            rest += chunk.toString('utf8');
            const lines = rest.split('\n');
            rest = lines.pop();
            lines.forEach(handle);
        });
        child.on('error', reject);
        child.on('close', () => {
            if (rest) handle(rest);
            resolve(out);
        });
    });
}

function gitAuthors(root) {
    const r = spawnSync('git', ['log', '--all', '--format=%an <%ae>%n%cn <%ce>'], { cwd: root, encoding: 'utf8' });
    return r.status === 0 ? [...new Set(r.stdout.split('\n').filter(Boolean))] : null;
}

function report(title, findings, max) {
    console.log(`\n== ${title}: ${findings.length} finding(s)`);
    const byId = new Map();
    for (const f of findings) byId.set(f.id, [...(byId.get(f.id) || []), f]);
    for (const [, items] of byId) {
        console.log(`\n-- ${items[0].label}: ${items.length}`);
        for (const f of items.slice(0, max)) console.log(`   ${f.where}  ${f.text}`);
        if (items.length > max) console.log(`   ... ${items.length - max} more (use --max)`);
    }
}

async function main(argv) {
    const history = argv.includes('--history');
    const maxIndex = argv.indexOf('--max');
    const max = maxIndex >= 0 ? Number(argv[maxIndex + 1]) || 15 : 15;
    const pats = patterns();
    const tree = [...scanTree(ROOT, pats), ...privateFiles(ROOT)];
    report('working tree', tree, max);
    let total = tree.length;
    if (history) {
        if (!fs.existsSync(path.join(ROOT, '.git'))) {
            console.error('\nNo .git folder here: run this from a clone to scan the history.');
            return 2;
        }
        const past = [...(await scanHistory(ROOT, pats)), ...privateFilesInHistory(ROOT)];
        report('git history (added lines of every commit)', past, max);
        total += past.length;
        const authors = gitAuthors(ROOT);
        console.log('\n== commit authors and committers (a personal e-mail here is public; GitHub keeps it in every commit):');
        for (const a of authors || []) console.log(`   ${a}`);
    }
    console.log(total ? '\nSomething was found. Decide for each: a fixture (fine), or private (remove it, and from history if it is there).' : '\nNothing found.');
    return total ? 1 : 0;
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { console.error(err.message); process.exit(2); });
}

module.exports = { patterns, scanText, PRIVATE_FILE };
