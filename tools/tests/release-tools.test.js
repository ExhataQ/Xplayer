'use strict';

// The release helpers (tools/dev/release-tools.js, make-notices.js) and what package.json and the workflows promise for a release.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const rt = require('../dev/release-tools');
const notices = require('../dev/make-notices');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const pkg = JSON.parse(read('package.json'));

const CHANGELOG = '# Changelog\r\n\r\n## Unreleased\r\n\r\n### Added\r\n- a thing\r\n\r\n## 0.9.0 - 2026-01-01\r\n\r\n- older\r\n';
const GOOD_FILES = ['Xplayer.exe', 'LICENSE', 'LICENSES.chromium.html', 'Xplayer-LICENSE.txt', 'THIRD-PARTY-NOTICES.txt', 'resources/app/package.json'];

describe('release tools', () => {
    test('versions: only semantic versions, with or without a suffix', () => {
        for (const v of ['1.0.0', '1.0.0-beta.1', '2.10.3-rc.2']) assert.equal(rt.isVersion(v), true, v);
        for (const v of ['1.0', 'v1.0.0', '1.0.0-', '', 'beta', undefined]) assert.equal(rt.isVersion(v), false, String(v));
    });

    test('preparing the CHANGELOG moves Unreleased into the version, keeps line endings, and refuses an empty or repeated release', () => {
        const next = rt.prepareChangelog(CHANGELOG, '1.0.0-beta.1', '2026-11-11');
        assert.match(next, /## Unreleased\r\n\r\n## 1\.0\.0-beta\.1 - 2026-11-11\r\n\r\n### Added\r\n- a thing/);
        assert.equal(rt.changelogSection(next, '1.0.0-beta.1').includes('- a thing'), true);
        assert.equal(rt.changelogSection(next, 'Unreleased'), '');
        assert.equal(rt.changelogSection(next, '0.9.0'), '- older');
        assert.throws(() => rt.prepareChangelog(next, '1.0.0-beta.2', '2026-11-12'), /empty/);
        assert.throws(() => rt.prepareChangelog(next, '1.0.0-beta.1', '2026-11-12'), /already has/);
        assert.throws(() => rt.prepareChangelog('# Changelog\n', '1.0.0', 'x'), /no "## Unreleased"/);
        assert.throws(() => rt.prepareChangelog(CHANGELOG, 'beta', 'x'), /not a version/);
    });

    test('the notes hold the version section and the known problems', () => {
        const next = rt.prepareChangelog(CHANGELOG, '1.0.0-beta.1', '2026-11-11');
        const notes = rt.releaseNotes(next, '1.0.0-beta.1', '- Windows only.\n');
        assert.match(notes, /^# Xplayer 1\.0\.0-beta\.1/);
        assert.match(notes, /- a thing/);
        assert.match(notes, /## Known problems\n\n- Windows only\./);
        assert.doesNotMatch(notes, /older/);
        assert.throws(() => rt.releaseNotes(next, '3.0.0', ''), /no section/);
    });

    test('a good release passes; each way it can go wrong is named', () => {
        const next = rt.prepareChangelog(CHANGELOG, '1.0.0-beta.1', '2026-11-11');
        const ok = { version: '1.0.0-beta.1', tag: 'v1.0.0-beta.1', changelog: next, files: GOOD_FILES };
        assert.deepEqual(rt.checkRelease(ok), []);
        assert.match(rt.checkRelease({ ...ok, tag: 'v1.0.0' }).join(), /does not match package\.json/);
        assert.match(rt.checkRelease({ ...ok, changelog: CHANGELOG }).join(), /no "## 1\.0\.0-beta\.1" section/);
        assert.match(rt.checkRelease({ ...ok, files: GOOD_FILES.filter((f) => f !== 'THIRD-PARTY-NOTICES.txt') }).join(), /missing next to Xplayer\.exe: THIRD-PARTY-NOTICES\.txt/);
        assert.match(rt.checkRelease({ ...ok, version: 'x' }).join(), /not a version/);
        for (const bad of ['Xplayer-Data/library/songs.json', 'resources/app/.dev-data/settings.json', 'resources/app/songs.json', 'debug.log', '.env', 'resources/app/.env.local']) {
            assert.match(rt.checkRelease({ ...ok, files: [...GOOD_FILES, bad] }).join(), /should not be in a release/, bad);
        }
        assert.deepEqual(rt.checkRelease({ ...ok, tag: '' }), [], 'no tag (a dry run): the tag check is skipped');
    });

    test('the installer check: one setup exe with the version, big enough, and not a portable build', () => {
        const MB = 1024 * 1024;
        const ok = { version: '1.0.0-beta.1', names: ['Xplayer-Setup-1.0.0-beta.1-x64.exe', 'builder-debug.yml'], sizes: { 'Xplayer-Setup-1.0.0-beta.1-x64.exe': 90 * MB }, portableMarker: false };
        assert.deepEqual(rt.checkInstaller(ok), []);
        assert.match(rt.checkInstaller({ ...ok, names: [] }).join(), /found 0/);
        assert.match(rt.checkInstaller({ ...ok, sizes: { 'Xplayer-Setup-1.0.0-beta.1-x64.exe': 1 * MB } }).join(), /smaller than 20 MB/);
        assert.match(rt.checkInstaller({ ...ok, version: '2.0.0' }).join(), /does not carry the version/);
        assert.match(rt.checkInstaller({ ...ok, portableMarker: true }).join(), /portable\.txt is inside/);
    });
});

describe('notices', () => {
    test('a licence the file does not know is a problem; known ones, with AND, pass', () => {
        assert.equal(notices.licenceOk('MIT'), true);
        assert.equal(notices.licenceOk('Apache-2.0 AND LGPL-3.0-or-later'), true);
        assert.equal(notices.licenceOk('(MIT AND Zlib)'), true);
        assert.equal(notices.licenceOk('GPL-3.0-only'), false);
        assert.equal(notices.licenceOk(undefined), false);
    });

    test('only what ships: no dev tools, nothing for another system', () => {
        const lock = {
            packages: {
                '': { name: 'x' },
                'node_modules/a': { version: '1.0.0', license: 'MIT' },
                'node_modules/dev-tool': { version: '1.0.0', license: 'MIT', dev: true },
                'node_modules/@img/sharp-linux-x64': { version: '1.0.0', license: 'LGPL-3.0-or-later', os: ['linux'], cpu: ['x64'] },
                'node_modules/@img/sharp-win32-x64': { version: '1.0.0', license: 'LGPL-3.0-or-later', os: ['win32'], cpu: ['x64'] },
                'node_modules/@img/sharp-win32-arm64': { version: '1.0.0', license: 'LGPL-3.0-or-later', os: ['win32'], cpu: ['arm64'] },
                'node_modules/mystery': { version: '1.0.0' }
            }
        };
        const { packages, problems } = notices.listPackages(lock);
        assert.deepEqual(packages.map((p) => p.name), ['@img/sharp-win32-x64', 'a', 'mystery']);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /mystery@1\.0\.0: licence "none"/);
    });

    test('THIRD-PARTY-NOTICES.txt is what package-lock.json gives now (run: node tools/dev/make-notices.js)', () => {
        const { text, problems } = notices.render(JSON.parse(read('package-lock.json')));
        assert.deepEqual(problems, []);
        assert.equal(read('THIRD-PARTY-NOTICES.txt'), text);
        assert.match(text, /node-taglib-sharp [\d.]+\s+LGPL-2\.1-or-later/);
    });
});

describe('what package.json and the workflows promise', () => {
    test('the version is a pre-release version and the lock file agrees', () => {
        assert.equal(rt.isVersion(pkg.version), true);
        const lock = JSON.parse(read('package-lock.json'));
        assert.equal(lock.version, pkg.version);
        assert.equal(lock.packages[''].version, pkg.version);
    });

    test('the installer is per user, keeps the data on uninstall, and is named so the check finds it', () => {
        const n = pkg.build.nsis;
        assert.equal(n.perMachine, false);
        assert.equal(n.deleteAppDataOnUninstall, false);
        assert.equal(n.oneClick, false);
        assert.match(n.artifactName, /^Xplayer-Setup-\$\{version\}-\$\{arch\}\.\$\{ext\}$/);
        assert.match(pkg.scripts['dist:installer'], /electron-builder --win nsis --x64 --publish never/);
        const targets = pkg.build.extraFiles.map((f) => `${f.from}>${f.to}`);
        assert.deepEqual(targets, ['LICENSE>Xplayer-LICENSE.txt', 'THIRD-PARTY-NOTICES.txt>THIRD-PARTY-NOTICES.txt']);
        assert.ok(!targets.some((t) => t.endsWith('>LICENSE')), "Electron's own LICENSE must not be overwritten");
    });

    test('the release workflow makes a draft, marks "-" tags as pre-release, never runs on a branch push, and asks for no more than contents: write', () => {
        const y = read('.github', 'workflows', 'release.yml');
        assert.match(y, /tags: \['v\*'\]/);
        assert.doesNotMatch(y, /branches:/);
        assert.match(y, /FLAGS="--draft"/);
        assert.match(y, /\*-\*\) FLAGS="\$FLAGS --prerelease"/);
        assert.match(y, /permissions:\s*\n\s+contents: write/);
        assert.doesNotMatch(y, /secrets\./);
        for (const step of ['make-notices.js --check', 'dist:installer', 'release-tools.js installer', 'check-dist.js', 'check-fuses.js', 'release-tools.js check']) assert.ok(y.includes(step), step);
    });

    test('the build workflow also builds the installer', () => {
        assert.match(read('.github', 'workflows', 'build.yml'), /installer-windows:[\s\S]*npm run dist:installer/);
    });

    test('the licence file and the known-problems file exist and the README points to them', () => {
        assert.match(read('LICENSE'), /^ISC License/);
        assert.match(read('README.md'), /docs\/KNOWN-PROBLEMS\.md/);
        assert.match(read('README.md'), /THIRD-PARTY-NOTICES\.txt/);
        assert.ok(fs.existsSync(path.join(ROOT, 'docs', 'RELEASING.md')));
    });
});
