'use strict';

// The release helpers, one file, run by hand and by .github/workflows/release.yml. See docs/RELEASING.md.
//
//   node tools/dev/release-tools.js prepare <version>          CHANGELOG.md: "Unreleased" becomes "<version> - <today>", a new empty "Unreleased" above it;
//                                                              package.json and package-lock.json get the version too
//   node tools/dev/release-tools.js notes <version>            the release notes (the CHANGELOG section and docs/KNOWN-PROBLEMS.md) on stdout
//   node tools/dev/release-tools.js check [--tag vX] [--dist <dist/Xplayer>]   the portable folder and the repository are fit to publish
//   node tools/dev/release-tools.js installer [--dist <dist>]  the installer exists and is not a portable build in disguise
//
// The checks are pure functions below (tools/tests/release-tools.test.js tries each with fake data).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// What a release must carry next to Xplayer.exe, and what it must never carry.
const MUST_HAVE = ['Xplayer-LICENSE.txt', 'THIRD-PARTY-NOTICES.txt', 'LICENSE', 'LICENSES.chromium.html'];
const NEVER = [/(^|\/)Xplayer-Data(\/|$)/, /(^|\/)\.dev-data(\/|$)/, /(^|\/)songs\.json$/i, /(^|\/)\.env(\.|$)/, /\.log$/i, /(^|\/)settings\.json$/i];

const isVersion = (v) => SEMVER.test(String(v || ''));

/** The text of the CHANGELOG section for a version (after its "## <version>" heading, up to the next "## "), or null. */
function changelogSection(text, version) {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const start = lines.findIndex((l) => l.startsWith('## ') && l.slice(3).trim().split(/\s+/)[0] === version);
    if (start < 0) return null;
    let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    if (end < 0) end = lines.length;
    return lines.slice(start + 1, end).join('\n').trim();
}

/** CHANGELOG text with "## Unreleased" turned into the version's section. Throws when there is nothing under Unreleased or the version exists. */
function prepareChangelog(text, version, today) {
    if (!isVersion(version)) throw new Error(`"${version}" is not a version like 1.0.0-beta.1`);
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const body = String(text).replace(/\r\n/g, '\n');
    if (changelogSection(body, version) !== null) throw new Error(`CHANGELOG.md already has a section for ${version}`);
    const at = body.search(/^## Unreleased[ \t]*$/m);
    if (at < 0) throw new Error('CHANGELOG.md has no "## Unreleased" section');
    const inside = changelogSection(body, 'Unreleased');
    if (!inside) throw new Error('"## Unreleased" is empty: nothing to release');
    const out = body.replace(/^## Unreleased[ \t]*$/m, `## Unreleased\n\n## ${version} - ${today}`);
    return eol === '\r\n' ? out.replace(/\n/g, '\r\n') : out;
}

function releaseNotes(changelog, version, known) {
    const section = changelogSection(changelog, version);
    if (!section) throw new Error(`CHANGELOG.md has no section for ${version}`);
    const parts = [`# Xplayer ${version}`, '', 'Pre-release. See the problems listed at the end before relying on it.', '', section];
    if (known && known.trim()) parts.push('', '## Known problems', '', known.trim());
    return parts.join('\n') + '\n';
}

/**
 * Problems that stop a release. `files` are the paths (forward slashes, relative to the portable folder) inside it; `tag` may be empty.
 */
function checkRelease({ version, tag, changelog, files }) {
    const problems = [];
    if (!isVersion(version)) problems.push(`package.json version "${version}" is not a version like 1.0.0-beta.1`);
    if (tag && tag !== `v${version}`) problems.push(`the tag ${tag} does not match package.json (${version}): the tag must be v${version}`);
    if (isVersion(version) && changelogSection(changelog || '', version) === null) problems.push(`CHANGELOG.md has no "## ${version}" section (run: node tools/dev/release-tools.js prepare ${version})`);
    const have = new Set(files);
    for (const f of MUST_HAVE) if (!have.has(f)) problems.push(`missing next to Xplayer.exe: ${f}`);
    for (const f of files) if (NEVER.some((re) => re.test(f))) problems.push(`should not be in a release: ${f}`);
    return problems;
}

/** The installer check: `names` are the file names in dist/, `portableMarker` says whether dist/win-unpacked holds portable.txt. */
function checkInstaller({ version, names, sizes = {}, portableMarker }) {
    const problems = [];
    const exe = names.filter((n) => /^Xplayer-Setup-.*\.exe$/.test(n));
    if (exe.length !== 1) problems.push(`expected one Xplayer-Setup-*.exe in dist, found ${exe.length}`);
    else {
        if (version && !exe[0].includes(version)) problems.push(`${exe[0]} does not carry the version ${version}`);
        if ((sizes[exe[0]] || 0) < 20 * 1024 * 1024) problems.push(`${exe[0]} is smaller than 20 MB: the app is probably not inside`);
    }
    if (portableMarker) problems.push('portable.txt is inside the installed app: the installed copy would keep its data beside the exe, not in the user profile');
    return problems;
}

function walk(dir, base = dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(path.relative(base, full).split(path.sep).join('/') + '/');
            walk(full, base, out);
        } else out.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return out;
}

function setVersionIn(file, version) {
    const text = fs.readFileSync(file, 'utf8');
    const next = text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`); // the first one is the package's own
    fs.writeFileSync(file, next);
}

function main(argv) {
    const [cmd, ...rest] = argv;
    const arg = (name) => {
        const i = rest.indexOf(name);
        return i >= 0 ? rest[i + 1] : '';
    };
    const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
    const pkgVersion = JSON.parse(read('package.json')).version;
    if (cmd === 'prepare') {
        const version = rest[0];
        const today = new Date().toISOString().slice(0, 10);
        const next = prepareChangelog(read('CHANGELOG.md'), version, today);
        fs.writeFileSync(path.join(ROOT, 'CHANGELOG.md'), next);
        setVersionIn(path.join(ROOT, 'package.json'), version);
        const lockFile = path.join(ROOT, 'package-lock.json');
        const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
        lock.version = version;
        if (lock.packages && lock.packages['']) lock.packages[''].version = version;
        const eol = fs.readFileSync(lockFile, 'utf8').includes('\r\n') ? '\r\n' : '\n';
        fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2).replace(/\n/g, eol) + eol);
        console.log(`prepared ${version}: CHANGELOG.md, package.json and package-lock.json updated`);
        return 0;
    }
    if (cmd === 'notes') {
        const known = fs.existsSync(path.join(ROOT, 'docs', 'KNOWN-PROBLEMS.md')) ? read('docs/KNOWN-PROBLEMS.md') : '';
        process.stdout.write(releaseNotes(read('CHANGELOG.md'), rest[0] || pkgVersion, known.replace(/^# .*\r?\n/, '')));
        return 0;
    }
    if (cmd === 'check') {
        const dist = path.resolve(arg('--dist') || path.join(ROOT, 'dist', 'Xplayer'));
        if (!fs.existsSync(dist)) return console.error(`check: ${dist} does not exist (run npm run dist first)`), 1;
        const problems = checkRelease({ version: pkgVersion, tag: arg('--tag') || '', changelog: read('CHANGELOG.md'), files: walk(dist) });
        if (problems.length) return console.error('release check:\n  ' + problems.join('\n  ')), 1;
        console.log(`release check: ${pkgVersion} is fit to publish`);
        return 0;
    }
    if (cmd === 'installer') {
        const dist = path.resolve(arg('--dist') || path.join(ROOT, 'dist'));
        const names = fs.existsSync(dist) ? fs.readdirSync(dist) : [];
        const sizes = Object.fromEntries(names.map((n) => [n, fs.statSync(path.join(dist, n)).size]));
        const problems = checkInstaller({ version: pkgVersion, names, sizes, portableMarker: fs.existsSync(path.join(dist, 'win-unpacked', 'portable.txt')) });
        if (problems.length) return console.error('installer check:\n  ' + problems.join('\n  ')), 1;
        console.log('installer check: ok');
        return 0;
    }
    console.error('usage: release-tools.js prepare <version> | notes [version] | check [--tag vX] [--dist dir] | installer [--dist dir]');
    return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { isVersion, changelogSection, prepareChangelog, releaseNotes, checkRelease, checkInstaller, MUST_HAVE };
