const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlaywright, launch, buildApp } = require('./helpers/app-fixture');

const pw = loadPlaywright();

describe('playback settings and transitions', { concurrency: false }, () => {
    let browser, dir, skip;

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = buildApp(3);
    });

    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const guard = (t) => (skip ? (t.skip(skip), false) : true);

    async function openPage() {
        const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
        await page.goto('file://' + path.join(dir, 'index.html').replace(/\\/g, '/'));
        await page.waitForTimeout(900);
        return page;
    }

    test('gapless and crossfade cannot remain enabled together', async (t) => {
        if (!guard(t)) return;
        const page = await openPage();
        const settings = await page.evaluate(() => {
            localStorage.removeItem('audioPlaybackSettings');
            const defaults = getAudioPlaybackSettings();
            const crossfade = setAudioPlaybackSetting('crossfadeEnabled', true);
            const gapless = setAudioPlaybackSetting('gaplessEnabled', true);
            return { defaults, crossfade, gapless };
        });

        assert.equal(settings.defaults.gaplessEnabled, true);
        assert.equal(settings.defaults.crossfadeEnabled, false);
        assert.deepEqual(
            [settings.crossfade.crossfadeEnabled, settings.crossfade.gaplessEnabled],
            [true, false]
        );
        assert.deepEqual([settings.gapless.gaplessEnabled, settings.gapless.crossfadeEnabled], [true, false]);
        await page.close();
    });

    test('an ended track still uses the preloaded gapless audio element', async (t) => {
        if (!guard(t)) return;
        const page = await openPage();
        const usedPreload = await page.evaluate(async () => {
            localStorage.setItem(
                'audioPlaybackSettings',
                JSON.stringify({ gaplessEnabled: true, crossfadeEnabled: false, fadeInEnabled: false })
            );
            playbackQueue = [
                { song: SONGS_DATA[0], listId: 'all-songs' },
                { song: SONGS_DATA[1], listId: 'all-songs' }
            ];
            currentQueueIndex = 0;
            audioElement.src = SONGS_DATA[0].url;

            let used = false;
            const originalUsePreloaded = usePreloadedGaplessTrack;
            const originalPrepare = prepareGaplessNextTrack;
            const originalPlay = audioElement.play;
            usePreloadedGaplessTrack = () => ((used = true), true);
            prepareGaplessNextTrack = () => {};
            audioElement.play = () => Promise.resolve();

            try {
                playSongFromQueue(1);
                await Promise.resolve();
                return used;
            } finally {
                usePreloadedGaplessTrack = originalUsePreloaded;
                prepareGaplessNextTrack = originalPrepare;
                audioElement.play = originalPlay;
            }
        });

        assert.equal(usedPreload, true);
        await page.close();
    });
});
