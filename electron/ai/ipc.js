// The main-process side of the AI feature: settings, key, planning and the undo journal, exposed to
// the page as the named `ai` calls in preload.js (never a generic invoke). Nothing here runs a plan;
// the page runs approved actions where the data lives and records the result in the journal.

const fs = require('fs');
const path = require('path');
const { createKeyStore } = require('./key-store');
const { createJournal } = require('./journal');
const { createOpenRouterProvider, AiError } = require('./provider');
const { planFromPrompt } = require('./planner');
const { translateLyrics } = require('./translate');
const { SONG_FIELDS, describePolicy } = require('./privacy');

const DEFAULT_SETTINGS = { enabled: false, privacyAccepted: false, model: 'openrouter/free', translateLanguage: '', autoTranslate: false };
const LANGUAGE = /^[\p{L}\p{M}][\p{L}\p{M} '().-]{0,39}$/u;
const MODEL_ID = /^[A-Za-z0-9._\-/:]{1,100}$/;
const MAX_SONGS_IN = 20000;

function createAiService({ configDir, safeStorage, provider, lookupTags }) {
    const settingsFile = path.join(configDir, 'ai-settings.json');
    const keys = createKeyStore({ file: path.join(configDir, 'ai-key.json'), safeStorage });
    const journal = createJournal({ file: path.join(configDir, 'ai-journal.json') });
    const ai = provider || createOpenRouterProvider({ getKey: () => keys.get() });
    let running = null;

    function readSettings() {
        try {
            const data = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            return {
                enabled: data.enabled === true,
                privacyAccepted: data.privacyAccepted === true,
                model: typeof data.model === 'string' && MODEL_ID.test(data.model) ? data.model : DEFAULT_SETTINGS.model,
                translateLanguage: typeof data.translateLanguage === 'string' && LANGUAGE.test(data.translateLanguage) ? data.translateLanguage : '',
                autoTranslate: data.autoTranslate === true
            };
        } catch (e) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function writeSettings(settings) {
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(settingsFile, JSON.stringify(settings), 'utf8');
    }

    function getStatus() {
        return {
            ...readSettings(),
            ...keys.status(),
            encryptionAvailable: !!(safeStorage && safeStorage.isEncryptionAvailable()),
            songFields: SONG_FIELDS
        };
    }

    function setSettings(patch) {
        const next = readSettings();
        const p = patch && typeof patch === 'object' ? patch : {};
        if (typeof p.enabled === 'boolean') next.enabled = p.enabled;
        if (typeof p.privacyAccepted === 'boolean') next.privacyAccepted = p.privacyAccepted;
        if (typeof p.model === 'string' && MODEL_ID.test(p.model)) next.model = p.model;
        if (typeof p.translateLanguage === 'string' && (p.translateLanguage === '' || LANGUAGE.test(p.translateLanguage))) next.translateLanguage = p.translateLanguage;
        if (typeof p.autoTranslate === 'boolean') next.autoTranslate = p.autoTranslate;
        writeSettings(next);
        return getStatus();
    }

    function fail(error) {
        if (error instanceof AiError) return { ok: false, error: error.code, message: error.message, ...(error.resetAt ? { resetAt: error.resetAt } : {}) };
        return { ok: false, error: 'unexpected', message: error && error.message ? error.message : String(error) };
    }

    // The checks every AI request passes first: returns the status, or { error } when the request must not go out.
    function gate() {
        const status = getStatus();
        if (!status.enabled) return { error: 'disabled' };
        if (!status.privacyAccepted) return { error: 'privacy-not-accepted' };
        if (!status.hasKey) return { error: 'no-key' };
        return { status };
    }

    async function plan(params) {
        const gated = gate();
        if (gated.error) return { ok: false, error: gated.error };
        const status = gated.status;
        const p = params && typeof params === 'object' ? params : {};
        if (!Array.isArray(p.songs) || p.songs.length > MAX_SONGS_IN) return { ok: false, error: 'bad-songs' };
        if (running) return { ok: false, error: 'busy' };
        running = new AbortController();
        try {
            return await planFromPrompt({ provider: ai, model: status.model, request: p.request, songs: p.songs, signal: running.signal, useWeb: p.useWeb === true, lookupTags, history: p.history, includeLyrics: p.includeLyrics === true });
        } catch (error) {
            return fail(error);
        } finally {
            running = null;
        }
    }

    async function translate(params) {
        const gated = gate();
        if (gated.error) return { ok: false, error: gated.error };
        const p = params && typeof params === 'object' ? params : {};
        if (running) return { ok: false, error: 'busy' };
        running = new AbortController();
        try {
            return await translateLyrics({ provider: ai, model: gated.status.model, lyrics: p.lyrics, targetLanguage: p.targetLanguage, signal: running.signal });
        } catch (error) {
            return fail(error);
        } finally {
            running = null;
        }
    }

    function cancel() {
        if (!running) return { cancelled: false };
        running.abort();
        return { cancelled: true };
    }

    async function listModels(params) {
        try {
            const all = await ai.listModels();
            const freeOnly = !(params && params.freeOnly === false);
            return { ok: true, models: all.filter((m) => !freeOnly || m.free).sort((a, b) => Number(b.structured) - Number(a.structured) || a.id.localeCompare(b.id)) };
        } catch (error) {
            return fail(error);
        }
    }

    async function keyInfo() {
        try {
            return { ok: true, info: await ai.keyInfo() };
        } catch (error) {
            return fail(error);
        }
    }

    return { getStatus, setSettings, setKey: (k) => keys.set(k), clearKey: () => keys.clear(), plan, translate, cancel, listModels, keyInfo, journal };
}

// ipcMain.handle for every call. `service` comes from createAiService.
function registerAiIpc(ipcMain, service) {
    ipcMain.handle('ai:get-status', () => service.getStatus());
    ipcMain.handle('ai:set-settings', (event, patch) => service.setSettings(patch));
    ipcMain.handle('ai:set-key', (event, key) => service.setKey(key));
    ipcMain.handle('ai:clear-key', () => service.clearKey());
    ipcMain.handle('ai:list-models', (event, params) => service.listModels(params));
    ipcMain.handle('ai:describe-privacy', () => describePolicy());
    ipcMain.handle('ai:key-info', () => service.keyInfo());
    ipcMain.handle('ai:plan', (event, params) => service.plan(params));
    ipcMain.handle('ai:translate-lyrics', (event, params) => service.translate(params));
    ipcMain.handle('ai:cancel', () => service.cancel());
    ipcMain.handle('ai:journal-list', () => service.journal.list());
    ipcMain.handle('ai:journal-get', (event, id) => (typeof id === 'string' ? service.journal.get(id) : null));
    ipcMain.handle('ai:journal-record', (event, entry) => {
        try {
            const e = entry && typeof entry === 'object' ? entry : {};
            return { ok: true, entry: service.journal.record({ kind: e.kind, summary: e.summary, changes: e.changes }) };
        } catch (error) {
            return { ok: false, error: 'bad-entry', message: error.message };
        }
    });
    ipcMain.handle('ai:journal-mark-undone', (event, id) => ({ ok: typeof id === 'string' && service.journal.markUndone(id) }));
}

module.exports = { createAiService, registerAiIpc, DEFAULT_SETTINGS };
