'use strict';

// The Electron fuses (phase 6.3 of .agent/archive/dev-plan/DEV-PLAN.md): package.json asks for them, tools/dev/check-fuses.js compares them with the exe.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseFuses, checkFuses, KEYS } = require('../dev/check-fuses');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const fuses = JSON.parse(read('package.json')).build.electronFuses;

// What `npx @electron/fuses read` prints (from a real Electron 44 binary).
const SAMPLE = `Analyzing app: Xplayer.exe
Fuse Version: v1
  RunAsNode is Enabled
  EnableCookieEncryption is Enabled
  EnableNodeOptionsEnvironmentVariable is Disabled
  EnableNodeCliInspectArguments is Disabled
  EnableEmbeddedAsarIntegrityValidation is Disabled
  OnlyLoadAppFromAsar is Disabled
  LoadBrowserProcessSpecificV8Snapshot is Disabled
  GrantFileProtocolExtraPrivileges is Enabled
  WasmTrapHandlers is Enabled
`;

describe('Electron fuses', () => {
    test('package.json turns off NODE_OPTIONS and --inspect, keeps file:// pages working, encrypts cookies', () => {
        assert.equal(fuses.enableNodeOptionsEnvironmentVariable, false);
        assert.equal(fuses.enableNodeCliInspectArguments, false);
        assert.equal(fuses.grantFileProtocolExtraPrivileges, true, 'the app loads file:// pages');
        assert.equal(fuses.enableCookieEncryption, true);
    });

    test('runAsNode stays on while the scan runs as fork() with ELECTRON_RUN_AS_NODE', () => {
        const scanner = read('electron', 'scanner.js');
        if (/ELECTRON_RUN_AS_NODE/.test(scanner)) assert.equal(fuses.runAsNode, true, 'turning runAsNode off breaks the library scan');
        else assert.ok(fuses.runAsNode === true || fuses.runAsNode === false);
    });

    test('every fuse the checker knows is set in package.json', () => {
        for (const key of Object.values(KEYS)) assert.equal(typeof fuses[key], 'boolean', key);
    });

    test('parseFuses reads the output of `fuses read`', () => {
        const parsed = parseFuses(SAMPLE);
        assert.equal(parsed.RunAsNode, true);
        assert.equal(parsed.EnableNodeCliInspectArguments, false);
        assert.equal(Object.keys(parsed).length, 9);
    });

    test('checkFuses: an exe that matches passes, one that differs or lacks a fuse is named', () => {
        assert.deepEqual(checkFuses(SAMPLE, fuses), []);
        const flipped = SAMPLE.replace('EnableNodeCliInspectArguments is Disabled', 'EnableNodeCliInspectArguments is Enabled');
        assert.match(checkFuses(flipped, fuses).join('\n'), /EnableNodeCliInspectArguments is Enabled in the exe/);
        assert.match(checkFuses(SAMPLE.replace(/.*GrantFileProtocolExtraPrivileges.*\n/, ''), fuses).join('\n'), /GrantFileProtocolExtraPrivileges is not in the fuse list/);
        assert.match(checkFuses(SAMPLE, {}).join('\n'), /runAsNode is not set/);
    });

    test('the build job runs check-fuses.js after check-dist.js', () => {
        const wf = read('.github', 'workflows', 'build.yml');
        assert.ok(wf.indexOf('node tools/dev/check-fuses.js') > wf.indexOf('node tools/dev/check-dist.js'));
        assert.ok(fs.existsSync(path.join(ROOT, 'tools', 'dev', 'check-fuses.js')));
    });
});
