'use strict';

// Behavior of the ui-next components (src/ui-next/components, task A-05) in a real page: keyboard, focus, timing,
// roles, and rendered text contrast in every theme and accent.
// Needs playwright and a browser; skips itself when missing (see README.md, "Prerequisites").
//
// Run: node --test tools/tests/ui-next-components-behavior.test.js

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('node:url');
const { loadPlaywright, launch, ROOT } = require('./helpers/app-fixture');

const UI = path.join(ROOT, 'src', 'ui-next');
const url = (...p) => pathToFileURL(path.join(UI, ...p)).href;

// A blank page that loads the real stylesheets and exposes the component API as window.ui.
const HARNESS = `<!doctype html><html lang="en" data-theme="warm-graphite"><head><meta charset="utf-8">
<link rel="stylesheet" href="${url('tokens.css')}"><link rel="stylesheet" href="${url('base.css')}"><link rel="stylesheet" href="${url('components', 'components.css')}">
</head><body><div id="stage" style="padding:24px"></div><button id="opener" type="button">opener</button>
<script type="module">import * as ui from '${url('components', 'index.js')}'; window.ui = ui; window.ready = true;</script></body></html>`;

describe('ui-next components in a real page', { concurrency: false }, () => {
    const pw = loadPlaywright();
    let browser, page, dir, skip;
    const errors = [];

    before(async () => {
        if (!pw) return void (skip = 'playwright is not installed');
        browser = await launch(pw);
        if (!browser) return void (skip = 'no browser found');
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xplayer-components-'));
        fs.writeFileSync(path.join(dir, 'harness.html'), HARNESS);
        page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(pathToFileURL(path.join(dir, 'harness.html')).href);
        await page.waitForFunction(() => window.ready === true);
    });
    after(async () => {
        if (browser) await browser.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    // Runs `fn` in the page after clearing the stage and anything a previous test left open.
    async function inPage(fn, arg) {
        await page.evaluate(() => {
            document.getElementById('stage').replaceChildren();
            document.querySelectorAll('dialog, .menu, .toaster, .tooltip').forEach((n) => n.remove());
            document.getElementById('opener').focus();
        });
        return page.evaluate(fn, arg);
    }
    const t = (name, fn) => test(name, async (ctx) => (skip ? ctx.skip(skip) : fn(ctx)));

    t('the harness loaded the component API without page errors', async () => {
        assert.deepEqual(errors, []);
        assert.ok(await page.evaluate(() => typeof window.ui.openMenu === 'function'));
    });

    describe('button', () => {
        t('loading keeps focus, shows a spinner, ignores clicks, and restores', async () => {
            const r = await inPage(() => {
                let clicks = 0;
                const b = ui.button({ label: 'Save', icon: 'check', variant: 'primary', onClick: () => (clicks += 1) });
                document.getElementById('stage').append(b);
                b.focus();
                ui.setLoading(b, true);
                b.click();
                const during = { busy: b.getAttribute('aria-busy'), spinner: !!b.querySelector('.spinner'), iconHidden: b.querySelector('.icon').hidden, focused: document.activeElement === b, clicks };
                ui.setLoading(b, false);
                b.click();
                return { during, after: { busy: b.hasAttribute('aria-busy'), spinner: !!b.querySelector('.spinner'), iconHidden: b.querySelector('.icon').hidden, clicks } };
            });
            assert.deepEqual(r.during, { busy: 'true', spinner: true, iconHidden: true, focused: true, clicks: 0 });
            assert.deepEqual(r.after, { busy: false, spinner: false, iconHidden: false, clicks: 1 });
        });

        t('setLoading twice adds one spinner; an icon button needs a label', async () => {
            const r = await inPage(() => {
                const b = ui.button({ label: 'Go' });
                ui.setLoading(b, true);
                ui.setLoading(b, true);
                let threw = false;
                try {
                    ui.iconButton({ icon: 'play' });
                } catch (_) {
                    threw = true;
                }
                return { spinners: b.querySelectorAll('.spinner').length, threw };
            });
            assert.deepEqual(r, { spinners: 1, threw: true });
        });

        t('a disabled button does not click and a toggle reports aria-pressed', async () => {
            const r = await inPage(() => {
                let clicks = 0;
                const off = ui.button({ label: 'Off', disabled: true, onClick: () => (clicks += 1) });
                const toggle = ui.button({ label: 'Compact', pressed: true });
                document.getElementById('stage').append(off, toggle);
                off.click();
                return { clicks, disabled: off.disabled, pressed: toggle.getAttribute('aria-pressed') };
            });
            assert.deepEqual(r, { clicks: 0, disabled: true, pressed: 'true' });
        });
    });

    describe('chip group', () => {
        t('one chip is pressed at a time and onChange fires only for a change', async () => {
            const r = await inPage(() => {
                const seen = [];
                const g = ui.chipGroup({ label: 'Filter', value: 'all', items: [{ value: 'all', label: 'All' }, { value: 'albums', label: 'Albums' }], onChange: (v) => seen.push(v) });
                document.getElementById('stage').append(g.el);
                const [all, albums] = g.el.querySelectorAll('button');
                albums.click();
                albums.click();
                all.click();
                g.setValue('albums');
                return { seen, pressed: [...g.el.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed')) };
            });
            assert.deepEqual(r.seen, ['albums', 'all']);
            assert.deepEqual(r.pressed, ['false', 'true']);
        });
    });

    describe('text field', () => {
        t('label is associated, error marks the field invalid with an icon and clears on typing', async () => {
            await inPage(() => {
                const f = ui.textField({ label: 'Title', hint: 'Shown in the library' });
                window.field = f;
                document.getElementById('stage').append(f.el);
            });
            assert.equal(await page.getByLabel('Title').count(), 1);
            const read = () => page.evaluate(() => ({ state: field.el.dataset.state, invalid: field.input.getAttribute('aria-invalid'), message: field.el.querySelector('.field__message').textContent, icon: !!field.el.querySelector('.field__message svg') }));
            assert.deepEqual(await read(), { state: 'idle', invalid: null, message: 'Shown in the library', icon: false });
            await page.evaluate(() => field.setError('Needs 2 characters'));
            assert.deepEqual(await read(), { state: 'error', invalid: 'true', message: 'Needs 2 characters', icon: true });
            await page.getByLabel('Title').fill('ab');
            assert.deepEqual(await read(), { state: 'idle', invalid: null, message: 'Shown in the library', icon: false });
            await page.evaluate(() => field.setSuccess('Saved'));
            assert.equal((await read()).state, 'success');
        });

        t('search: clear button shows with text, clears and refocuses; Escape clears; Enter submits', async () => {
            await inPage(() => {
                window.seen = [];
                const f = ui.textField({ label: 'Find', search: true, onInput: (v) => seen.push(v), onSubmit: (v) => seen.push(`go:${v}`) });
                window.field = f;
                document.getElementById('stage').append(f.el);
            });
            const clear = page.getByRole('button', { name: 'Clear' });
            assert.equal(await clear.isHidden(), true);
            await page.getByLabel('Find').fill('tide');
            assert.equal(await clear.isVisible(), true);
            await page.keyboard.press('Enter');
            await clear.click();
            assert.equal(await page.evaluate(() => document.activeElement === field.input && field.input.value === ''), true);
            await page.getByLabel('Find').fill('x');
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => field.input.value), '');
            assert.deepEqual(await page.evaluate(() => seen), ['tide', 'go:tide', '', 'x', '']);
        });

        t('user text uses dir=auto so right-to-left lines align themselves', async () => {
            assert.equal(await inPage(() => ui.textField({ label: 'Lyrics' }).input.getAttribute('dir')), 'auto');
        });
    });

    describe('tabs and segmented control', () => {
        const mount = () =>
            inPage(() => {
                window.seen = [];
                const x = ui.tabs({ label: 'Mode', value: 'view', onChange: (id) => seen.push(id), items: [{ id: 'view', label: 'Lyrics' }, { id: 'find', label: 'Find' }, { id: 'write', label: 'Write' }, { id: 'sync', label: 'Sync', disabled: true }] });
                window.x = x;
                document.getElementById('stage').append(x.el);
            });
        const selected = () => page.evaluate(() => [...x.el.querySelectorAll('[role=tab]')].map((n) => `${n.getAttribute('aria-selected') === 'true' ? '+' : '-'}${n.tabIndex}`).join(' '));

        t('roving tabindex: only the selected tab is in the tab order', async () => {
            await mount();
            assert.equal(await selected(), '+0 --1 --1 --1');
        });

        t('arrow keys select and focus, skip the disabled tab, wrap, and Home and End work', async () => {
            await mount();
            await page.getByRole('tab', { name: 'Lyrics' }).focus();
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('ArrowRight');
            assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Write');
            await page.keyboard.press('ArrowRight');
            assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Lyrics', 'wraps past the disabled tab');
            await page.keyboard.press('End');
            assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Write', 'End goes to the last enabled tab');
            await page.keyboard.press('Home');
            assert.deepEqual(await page.evaluate(() => seen), ['find', 'write', 'view', 'write', 'view']);
            assert.equal(await selected(), '+0 --1 --1 --1');
        });

        t('setValue and setDisabled change state without calling onChange', async () => {
            await mount();
            await page.evaluate(() => {
                x.setValue('find');
                x.setDisabled('find', true);
            });
            assert.deepEqual(await page.evaluate(() => seen), []);
            assert.equal(await page.evaluate(() => x.el.querySelector('[role=tab][aria-selected=true]').disabled), true);
            // a disabled selected tab must not strand the keyboard: the first enabled tab stays reachable
            assert.equal(await page.evaluate(() => [...x.el.querySelectorAll('[role=tab]')].filter((n) => n.tabIndex === 0 && !n.disabled).length), 1);
        });

        t('in right-to-left text the arrows are mirrored', async () => {
            await mount();
            await page.evaluate(() => (document.documentElement.dir = 'rtl'));
            await page.getByRole('tab', { name: 'Lyrics' }).focus();
            await page.keyboard.press('ArrowLeft');
            const next = await page.evaluate(() => document.activeElement.textContent);
            await page.evaluate(() => (document.documentElement.dir = 'ltr'));
            assert.equal(next, 'Find');
        });

        t('segmented control is a radio group with one checked value', async () => {
            await inPage(() => {
                window.seen = [];
                const s = ui.segmented({ label: 'Density', value: 'comfortable', onChange: (v) => seen.push(v), items: [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] });
                window.s = s;
                document.getElementById('stage').append(s.el);
            });
            await page.getByRole('radio', { name: 'Comfortable' }).focus();
            await page.keyboard.press('ArrowRight');
            assert.deepEqual(await page.evaluate(() => [seen, [...s.el.querySelectorAll('[role=radio]')].map((n) => n.getAttribute('aria-checked'))]), [['compact'], ['false', 'true']]);
            await page.evaluate(() => s.setValue('comfortable'));
            assert.deepEqual(await page.evaluate(() => seen), ['compact']);
        });
    });

    describe('tooltip', () => {
        // An earlier test can leave the pointer where the next button appears; the browser then sends a late pointerenter
        // that would open (or reopen) a tooltip behind the test's back. Park the pointer first, and let that event pass.
        const mount = async (pressed) => {
            await page.mouse.move(2, 2);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            return mountButton(pressed);
        };
        const mountButton = (pressed) =>
            inPage((isToggle) => {
                const b = ui.iconButton({ icon: 'shuffle', label: 'Shuffle', pressed: isToggle ? false : undefined, tooltip: { state: 'Off', shortcut: 'S', description: 'Play in random order' }, onClick: () => b.tooltip.update({ state: 'On' }) });
                b.style.margin = '60px';
                document.getElementById('stage').append(b);
                window.b = b;
            }, pressed);
        const tip = () => page.evaluate(() => { const n = document.querySelector('.tooltip'); return n && !n.hidden ? n.textContent.replace(/\s+/g, ' ').trim() : null; });

        t('appears after the delay, not before, and hides when the pointer leaves', async () => {
            await mount();
            const box = await page.locator('.icon-btn').boundingBox();
            await page.mouse.move(box.x + 5, box.y + 5);
            await page.waitForTimeout(150);
            assert.equal(await tip(), null, 'not yet');
            await page.waitForTimeout(500);
            assert.equal(await tip(), 'ShuffleOffSPlay in random order');
            await page.mouse.move(5, 5);
            assert.equal(await tip(), null);
            assert.equal(await page.evaluate(() => b.hasAttribute('aria-describedby')), false);
        });

        t('is placed inside the viewport next to its target', async () => {
            await mount();
            await page.locator('.icon-btn').hover();
            await page.waitForTimeout(650);
            const r = await page.evaluate(() => { const n = document.querySelector('.tooltip').getBoundingClientRect(); const a = b.getBoundingClientRect(); return { inside: n.left >= 0 && n.top >= 0 && n.right <= innerWidth && n.bottom <= innerHeight, below: n.top >= a.bottom, describedby: b.getAttribute('aria-describedby') === document.querySelector('.tooltip').id }; });
            assert.deepEqual(r, { inside: true, below: true, describedby: true });
        });

        t('keyboard focus shows it at once and Escape hides it', async () => {
            await mount();
            await page.keyboard.press('Shift+Tab'); // the opener button after the stage has focus; the target is just before it
            assert.equal(await page.evaluate(() => document.activeElement === b), true);
            assert.ok(await tip());
            await page.keyboard.press('Escape');
            assert.equal(await tip(), null);
        });

        t('pressing a normal button hides the tooltip; the next hover shows it again', async () => {
            await mount();
            const target = page.locator('.icon-btn');
            await target.hover();
            await page.waitForTimeout(650);
            assert.ok(await tip());
            await page.mouse.down();
            await page.mouse.up();
            assert.equal(await tip(), null);
            await page.mouse.move(5, 5);
            await target.hover();
            await page.waitForTimeout(100); // the next tooltip opens without the delay right after one closed
            assert.ok(await tip());
        });

        t('a toggle keeps its tooltip open when pressed and shows the new state', async () => {
            await mount(true);
            const target = page.locator('.icon-btn');
            await target.hover();
            await page.waitForTimeout(650);
            assert.match(await tip(), /Off/);
            await target.click();
            assert.match(await tip(), /On/);
        });
    });

    describe('toast', () => {
        const mount = (opts = {}) =>
            inPage((o) => {
                window.dismissed = [];
                window.toaster = ui.createToaster({ host: document.getElementById('stage'), ...o, onDismiss: (d, why) => dismissed.push(`${d.title}:${why}`) });
            }, opts);
        const count = () => page.locator('.toast').count();

        t('roles: errors are alerts, the rest are polite status messages', async () => {
            await mount();
            await page.evaluate(() => { toaster.show({ kind: 'info', title: 'A' }); toaster.show({ kind: 'error', title: 'B' }); });
            assert.deepEqual(await page.locator('.toast').evaluateAll((n) => n.map((x) => x.getAttribute('role'))), ['status', 'alert']);
            assert.equal(await page.locator('.toaster').getAttribute('role'), 'region');
        });

        t('showing the same id updates in place; more than max drops the oldest', async () => {
            await mount({ max: 2 });
            await page.evaluate(() => { toaster.show({ id: 'x', title: 'One' }); toaster.show({ id: 'x', title: 'One again' }); });
            assert.equal(await count(), 1);
            assert.match(await page.locator('.toast').innerText(), /One again/);
            await page.evaluate(() => { toaster.show({ title: 'Two' }); toaster.show({ title: 'Three' }); });
            assert.deepEqual(await page.locator('.toast__title').allInnerTexts(), ['Two', 'Three']);
        });

        t('closes by itself after its duration and reports why', async () => {
            await mount();
            await page.evaluate(() => toaster.show({ title: 'Quick', duration: 150 }));
            await page.waitForTimeout(400);
            assert.equal(await count(), 0);
            assert.ok((await page.evaluate(() => dismissed)).includes('Quick:timeout'));
        });

        t('hover pauses the timer; leaving restarts it', async () => {
            await mount();
            await page.evaluate(() => toaster.show({ title: 'Held', duration: 300 }));
            await page.locator('.toast').hover();
            await page.waitForTimeout(700);
            assert.equal(await count(), 1, 'still open while hovered');
            await page.mouse.move(2, 2);
            await page.waitForTimeout(1500);
            assert.equal(await count(), 0);
        });

        t('the close button and the action button dismiss with their reasons', async () => {
            await mount();
            await page.evaluate(() => { window.acted = 0; toaster.show({ title: 'Save failed', kind: 'error', duration: 0, action: { label: 'Try again', onClick: () => (acted += 1) } }); toaster.show({ title: 'Other', duration: 0 }); });
            await page.getByRole('button', { name: 'Try again' }).click();
            await page.getByRole('button', { name: 'Dismiss' }).click();
            assert.equal(await page.evaluate(() => acted), 1);
            assert.deepEqual(await page.evaluate(() => dismissed), ['Save failed:action', 'Other:user']);
        });

        t('titles and messages are plain text (no markup from song names) and dir=auto', async () => {
            await mount();
            await page.evaluate(() => toaster.show({ title: '<img src=x onerror=alert(1)>', message: '<b>x</b>', duration: 0 }));
            assert.equal(await page.locator('.toast img, .toast b').count(), 0);
            assert.equal(await page.locator('.toast__title').getAttribute('dir'), 'auto');
        });
    });

    describe('dialog', () => {
        t('opens modal inside the page, moves focus in, Escape closes with null and returns focus', async () => {
            const r = await inPage(async () => {
                const opener = document.getElementById('opener');
                opener.focus();
                const pending = ui.openDialog({ title: 'About', body: 'Hello', actions: [{ label: 'Close it', value: 'ok', variant: 'primary' }] });
                const d = document.querySelector('dialog');
                const info = { open: d.open, modal: d.matches(':modal'), focusInside: d.contains(document.activeElement), focusedLabel: document.activeElement.textContent, named: d.getAttribute('aria-labelledby') === d.querySelector('h2').id };
                d.dispatchEvent(new Event('cancel', { cancelable: true })); // what Escape does first
                d.close();
                const value = await pending;
                return { info, value, gone: !document.querySelector('dialog'), focusBack: document.activeElement === opener };
            });
            assert.deepEqual(r.info, { open: true, modal: true, focusInside: true, focusedLabel: 'Close it', named: true });
            assert.deepEqual([r.value, r.gone, r.focusBack], [null, true, true]);
        });

        t('real Escape closes it; a chosen action resolves its value', async () => {
            await inPage(() => { window.result = undefined; ui.openDialog({ title: 'T', body: 'b', actions: [{ label: 'Yes', value: 'yes' }] }).then((v) => (window.result = v)); });
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => window.result !== undefined);
            assert.equal(await page.evaluate(() => result), null);
            await inPage(() => { window.result = undefined; ui.openDialog({ title: 'T', body: 'b', actions: [{ label: 'Yes', value: 'yes' }] }).then((v) => (window.result = v)); });
            await page.getByRole('button', { name: 'Yes' }).click();
            await page.waitForFunction(() => window.result !== undefined);
            assert.equal(await page.evaluate(() => result), 'yes');
        });

        t('Tab stays inside the dialog', async () => {
            await inPage(() => { ui.openDialog({ title: 'T', body: 'b', actions: [{ label: 'One' }, { label: 'Two' }] }); });
            for (let i = 0; i < 6; i++) {
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true);
            }
        });

        t('a destructive dialog focuses the safe action first', async () => {
            await inPage(() => { ui.confirmDialog({ title: 'Delete?', message: 'Gone for good', confirmLabel: 'Delete', destructive: true }); });
            assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Cancel');
            await page.getByRole('button', { name: 'Delete' }).click();
        });

        t('an async action shows loading, a failure keeps the dialog open with the message, then it can succeed', async () => {
            await inPage(() => {
                window.attempts = 0;
                window.result = undefined;
                ui.openDialog({ title: 'Save', body: 'b', actions: [{ label: 'Cancel' }, { label: 'Save', variant: 'primary', onClick: () => new Promise((ok, no) => setTimeout(() => (++attempts === 1 ? no(new Error('File is locked')) : ok()), 150)) }] }).then((v) => (window.result = v));
            });
            const save = page.getByRole('button', { name: 'Save', exact: true });
            await save.click();
            assert.equal(await page.evaluate(() => [document.querySelector('[aria-busy=true]') !== null, [...document.querySelectorAll('.dialog__footer button')].filter((b) => b.disabled).length]).then((x) => x.join()), 'true,1');
            await page.waitForFunction(() => !document.querySelector('.dialog__error').hidden);
            assert.match(await page.locator('.dialog__error').innerText(), /File is locked/);
            assert.equal(await page.evaluate(() => result), undefined, 'still open');
            assert.equal(await save.isEnabled(), true);
            await save.click();
            await page.waitForFunction(() => window.result !== undefined);
            assert.equal(await page.evaluate(() => result), 'Save');
        });

        t('a dialog that is not dismissible ignores Escape and has no close button', async () => {
            await inPage(() => { ui.openDialog({ title: 'Updating', body: 'Wait', dismissible: false, actions: [{ label: 'Continue', variant: 'primary' }] }); });
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => !!document.querySelector('dialog[open]')), true);
            assert.equal(await page.getByRole('button', { name: 'Close' }).count(), 0);
        });

        t('a menu opened from inside a dialog is mounted in the dialog, so it is not hidden behind it', async () => {
            const r = await inPage(() => {
                ui.openDialog({ title: 'T', body: ui.button({ label: 'More' }), actions: [{ label: 'Done' }] });
                const anchor = document.querySelector('dialog .btn');
                const m = ui.openMenu({ anchor, items: [{ label: 'A' }] });
                return m.el.closest('dialog') !== null;
            });
            assert.equal(r, true);
        });
    });

    describe('menu', () => {
        const open = (items) =>
            inPage((spec) => {
                window.log = [];
                const build = (list) => list.map((i) => (i.sep ? { type: 'separator' } : { ...i, onSelect: () => log.push(i.label), items: i.items && build(i.items) }));
                const a = document.getElementById('opener');
                window.menu = ui.openMenu({ anchor: a, items: build(spec), onClose: () => log.push('closed') });
            }, items);
        const focused = () => page.evaluate(() => document.activeElement.textContent.trim());
        const ITEMS = [{ label: 'Alpha' }, { label: 'Beta', disabled: true }, { label: 'Gamma', items: [{ label: 'Inner one' }, { label: 'Inner two' }] }, { sep: true }, { label: 'Delta' }];

        t('opens with the first item focused, roles are menu and menuitem', async () => {
            await open(ITEMS);
            assert.equal(await focused(), 'Alpha');
            assert.equal(await page.locator('[role=menu]').count(), 1);
            assert.deepEqual(await page.locator('[role=menuitem]').evaluateAll((n) => n.map((x) => x.getAttribute('aria-disabled'))), [null, 'true', null, null]);
            assert.equal(await page.evaluate(() => document.getElementById('opener').getAttribute('aria-expanded')), 'true');
        });

        t('Up, Down, Home and End move focus, wrap, and skip disabled items', async () => {
            await open(ITEMS);
            await page.keyboard.press('ArrowDown');
            assert.equal(await focused(), 'Gamma', 'Beta is disabled');
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowDown');
            assert.equal(await focused(), 'Alpha', 'wraps');
            await page.keyboard.press('ArrowUp');
            assert.equal(await focused(), 'Delta');
            await page.keyboard.press('Home');
            assert.equal(await focused(), 'Alpha');
            await page.keyboard.press('End');
            assert.equal(await focused(), 'Delta');
        });

        t('typing jumps to a matching item', async () => {
            await open(ITEMS);
            await page.keyboard.type('d');
            assert.equal(await focused(), 'Delta');
            await page.waitForTimeout(800);
            await page.keyboard.type('g');
            assert.equal(await focused(), 'Gamma');
        });

        t('Right opens a submenu and focuses its first item, Left goes back, Escape closes one level then the menu', async () => {
            await open(ITEMS);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowRight');
            assert.equal(await focused(), 'Inner one');
            assert.equal(await page.locator('[role=menu]').count(), 2);
            await page.keyboard.press('ArrowLeft');
            assert.equal(await focused(), 'Gamma');
            assert.equal(await page.locator('[role=menu]').count(), 1);
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('[role=menu]').count(), 1);
            assert.equal(await focused(), 'Gamma');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('[role=menu]').count(), 0);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'opener', 'focus returns to the opener');
            assert.equal(await page.evaluate(() => document.getElementById('opener').hasAttribute('aria-expanded')), false);
        });

        t('Enter chooses, the menu closes, and focus returns to the opener', async () => {
            await open(ITEMS);
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
            assert.deepEqual((await page.evaluate(() => log)).sort(), ['Delta', 'closed']);
            assert.equal(await page.locator('[role=menu]').count(), 0);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'opener');
        });

        t('a disabled item cannot be chosen by click', async () => {
            await open(ITEMS);
            await page.getByRole('menuitem', { name: 'Beta' }).click({ force: true });
            assert.equal(await page.locator('[role=menu]').count(), 1);
            assert.deepEqual(await page.evaluate(() => log), []);
        });

        t('hovering a submenu item opens it; hovering another item closes it', async () => {
            await open(ITEMS);
            await page.getByRole('menuitem', { name: 'Gamma' }).hover();
            await page.waitForTimeout(350);
            assert.equal(await page.locator('[role=menu]').count(), 2);
            await page.getByRole('menuitem', { name: 'Alpha' }).hover();
            await page.waitForTimeout(350);
            assert.equal(await page.locator('[role=menu]').count(), 1);
        });

        t('radio and checkbox items carry aria-checked; keepOpen toggles in place', async () => {
            await inPage(() => {
                window.menu = ui.openMenu({ anchor: document.getElementById('opener'), items: [{ label: 'Name', radio: true, checked: true, keepOpen: true }, { label: 'Recent', radio: true, checked: false, keepOpen: true }, { label: 'Covers', checked: false, keepOpen: true }] });
            });
            assert.deepEqual(await page.locator('.menu__item').evaluateAll((n) => n.map((x) => `${x.getAttribute('role')}:${x.getAttribute('aria-checked')}`)), ['menuitemradio:true', 'menuitemradio:false', 'menuitemcheckbox:false']);
            await page.getByRole('menuitemcheckbox', { name: 'Covers' }).click();
            assert.equal(await page.locator('[role=menu]').count(), 1);
            assert.equal(await page.getByRole('menuitemcheckbox', { name: 'Covers' }).getAttribute('aria-checked'), 'true');
        });

        t('an outside press closes it; a press on the opener closes it and does not reopen it', async () => {
            await open(ITEMS);
            await page.mouse.click(900, 600);
            assert.equal(await page.locator('[role=menu]').count(), 0);
            await open(ITEMS);
            const opener = page.locator('#opener');
            await opener.click();
            assert.equal(await page.locator('[role=menu]').count(), 0);
            const again = await page.evaluate(() => ui.openMenu({ anchor: document.getElementById('opener'), items: [{ label: 'x' }] }));
            assert.equal(again, null, 'the click that follows the closing press must not reopen it');
        });

        t('a context menu opens at the point and stays inside the window', async () => {
            const r = await inPage(() => {
                const m = ui.openMenu({ anchor: null, point: { x: innerWidth - 2, y: innerHeight - 2 }, items: [{ label: 'One' }, { label: 'Two' }] });
                const b = m.el.getBoundingClientRect();
                return { inside: b.right <= innerWidth && b.bottom <= innerHeight && b.left >= 0 && b.top >= 0 };
            });
            assert.equal(r.inside, true);
        });
    });

    describe('status, progress and empty state', () => {
        t('status shows a different mark and the label for each state, and rejects unknown states', async () => {
            const r = await inPage(() => {
                const s = ui.statusIndicator({ label: 'Idle' });
                const out = {};
                for (const st of ['idle', 'running', 'success', 'error']) {
                    s.set(st, st);
                    out[st] = s.el.querySelector('.status__mark').innerHTML;
                }
                let threw = false;
                try { s.set('nope'); } catch (_) { threw = true; }
                return { distinct: new Set(Object.values(out)).size, threw, role: s.el.getAttribute('role') };
            });
            assert.deepEqual(r, { distinct: 4, threw: true, role: 'status' });
        });

        t('progress reports a clamped value, or none while the length is unknown', async () => {
            const r = await inPage(() => {
                const p = ui.progress({ value: 0.5, label: 'Scan' });
                const a = p.el.getAttribute('aria-valuenow');
                p.set(2);
                const b = p.el.getAttribute('aria-valuenow');
                p.set(null);
                return { a, b, c: p.el.getAttribute('aria-valuenow'), indeterminate: p.el.dataset.indeterminate, name: p.el.getAttribute('aria-label') };
            });
            assert.deepEqual(r, { a: '50', b: '100', c: null, indeterminate: 'true', name: 'Scan' });
        });

        t('empty state: roles per state, at most three actions, titles need text', async () => {
            const r = await inPage(() => {
                const e = (o) => ui.emptyState({ title: 'T', ...o });
                const roles = ['empty', 'loading', 'error'].map((state) => e({ state }).getAttribute('role'));
                const throwsFor = (fn) => { try { fn(); return false; } catch (_) { return true; } };
                return { roles, four: throwsFor(() => e({ actions: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }] })), noTitle: throwsFor(() => ui.emptyState({})), first: e({ actions: [{ label: 'Go' }, { label: 'Other' }] }).querySelectorAll('.btn')[0].className.includes('btn--primary') };
            });
            assert.deepEqual(r, { roles: [null, 'status', 'alert'], four: true, noTitle: true, first: true });
        });
    });

    describe('rendered text contrast in every theme and accent', () => {
        // Draws one sample of each text style the components use and compares its color with the first opaque background
        // behind it. Disabled controls are exempt (WCAG), and so are the forced-state gallery classes (they use the same rules).
        async function scan(theme, accent) {
            return page.evaluate(
                ({ theme, accent }) => {
                    document.documentElement.dataset.theme = theme;
                    if (accent) document.documentElement.dataset.accent = accent;
                    else delete document.documentElement.dataset.accent;
                    const stage = document.getElementById('stage');
                    stage.replaceChildren();
                    const host = document.createElement('div');
                    host.style.cssText = 'background:var(--surface-panel);padding:8px;display:flex;flex-wrap:wrap;gap:8px';
                    stage.append(host);
                    const field = ui.textField({ label: 'Title', hint: 'A hint', value: 'abc' });
                    const bad = ui.textField({ label: 'Bad', value: 'x' });
                    bad.setError('Too short');
                    const tabs = ui.tabs({ label: 'm', value: 'a', items: [{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }] });
                    const seg = ui.segmented({ label: 's', value: 'a', items: [{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }] });
                    const chips = ui.chipGroup({ label: 'c', value: 'a', items: [{ value: 'a', label: 'One', count: 3 }, { value: 'b', label: 'Two', count: 4 }] });
                    const toaster = ui.createToaster({ host: stage, max: 3 });
                    toaster.show({ kind: 'success', title: 'Saved', message: 'To the file', duration: 0, action: { label: 'Undo' } });
                    toaster.show({ kind: 'error', title: 'Failed', message: 'Try again', duration: 0 });
                    const status = ['idle', 'running', 'success', 'error'].map((s) => ui.statusIndicator({ state: s, label: s }).el);
                    const hoverItem = (cls) => { const b = document.createElement('button'); b.className = `menu__item ${cls}`; b.innerHTML = '<span class="menu__label">Item</span><span class="menu__shortcut">Ctrl+O</span>'; const ul = document.createElement('ul'); ul.className = 'menu'; ul.style.position = 'static'; ul.append(b); return ul; };
                    const danger = hoverItem('is-hover'); danger.firstChild.dataset.danger = 'true';
                    const empty = ui.emptyState({ title: 'Nothing here', text: 'Do something', actions: [{ label: 'Act' }, { label: 'Other' }] });
                    const err = ui.emptyState({ state: 'error', title: 'Broke', text: 'Retry', actions: [{ label: 'Retry' }] });
                    host.append(
                        ui.button({ label: 'Primary', variant: 'primary' }), ui.button({ label: 'Outline' }), ui.button({ label: 'Ghost', variant: 'ghost' }), ui.button({ label: 'Danger', variant: 'danger' }),
                        ui.button({ label: 'On', pressed: true }), ui.iconButton({ icon: 'heart', label: 'Fav', pressed: true }), ui.iconButton({ icon: 'heart', label: 'Fav2' }), ui.iconButton({ icon: 'play', label: 'Play', variant: 'solid' }),
                        field.el, bad.el, tabs.el, seg.el, chips.el, ...status, hoverItem(''), hoverItem('is-hover'), hoverItem('is-active'), danger, empty, err
                    );
                    const toastNodes = [...document.querySelectorAll('.toast')];

                    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 4).map(Number);
                    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
                    const effectiveBg = (node) => { for (let n = node; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if ((c[3] ?? 1) > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
                    const failures = [];
                    let checked = 0;
                    for (const root of [host, ...toastNodes]) {
                        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
                        for (let node = walker.currentNode; node; node = walker.nextNode()) {
                            const own = [...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
                            const isIcon = node.tagName === 'svg' && node.closest('button, .toast, .status, .field, .empty-state, .menu');
                            if (!own && !isIcon) continue;
                            if (node.closest(':disabled, [aria-disabled="true"], [data-disabled="true"]')) continue;
                            const style = getComputedStyle(node);
                            const fg = rgb(isIcon ? style.color : style.color);
                            const bg = effectiveBg(node);
                            const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
                            const ratio = (hi + 0.05) / (lo + 0.05);
                            checked += 1;
                            const large = parseFloat(style.fontSize) >= 24;
                            const need = isIcon ? 3 : large ? 3 : 4.5;
                            if (ratio < need) failures.push(`${node.className && node.className.baseVal === undefined ? node.className : node.tagName} "${(node.textContent || '').trim().slice(0, 18)}" ${ratio.toFixed(2)}:1 (needs ${need})`);
                        }
                    }
                    return { checked, failures };
                },
                { theme, accent }
            );
        }
        for (const theme of ['warm-graphite', 'deep-forest', 'espresso-copper']) {
            for (const accent of [null, 'green', 'pink', 'purple', 'yellow', 'white']) {
                t(`${theme}${accent ? ` with ${accent} accent` : ''}`, async () => {
                    const r = await scan(theme, accent);
                    assert.ok(r.checked > 40, `only ${r.checked} text nodes were checked`);
                    assert.deepEqual(r.failures, []);
                });
            }
        }
    });

    t('no page errors during all of the above', async () => {
        assert.deepEqual(errors, []);
    });
});
