// The view registry and the view router (shell/view-registry.js, shell/view-router.js). Pure Node: the router has no DOM, the shell hands
// it what drawing means, so every rule is tested here with a fake shell.
//
// Run:   node --test tools/tests/ui-next-view-router.test.js

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const SHELL = path.resolve(__dirname, '..', '..', 'src', 'ui-next', 'shell');
let createViewRegistry, showsEnginePage, createRouter;

before(async () => {
    ({ createViewRegistry, showsEnginePage } = await import(pathToFileURL(path.join(SHELL, 'view-registry.js')).href));
    ({ createRouter } = await import(pathToFileURL(path.join(SHELL, 'view-router.js')).href));
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// A fake shell around a registry: `state.current` is what is on screen, `log` records every call the router makes.
function fakeShell(definitions, { enter, recover } = {}) {
    const registry = createViewRegistry(definitions);
    const state = { current: null };
    const log = [];
    const router = createRouter({
        registry,
        env: {
            current: () => state.current,
            enter: (view, options) => {
                log.push(`enter:${view.id}`);
                if (enter) {
                    const result = enter(view, options);
                    if (result === false) return false;
                }
                state.current = view.id;
                return true;
            },
            recover: (view, options, error) => {
                log.push(`recover:${view.id}`);
                state.current = view.id;
                if (recover) recover(view, error);
            },
            willLeave: (view) => log.push(`willLeave:${view.id}`),
            didLeave: (view) => log.push(`didLeave:${view.id}`),
            committed: (view) => log.push(`committed:${view.id}`),
            report: (phase, view) => log.push(`report:${phase}:${view && view.id}`)
        }
    });
    state.current = definitions[0].id;
    return { registry, router, state, log };
}

const VIEWS = () => [
    { id: 'home', label: 'Home', own: true, mount() {} },
    { id: 'library', label: 'Library', engine: 'all-songs', engineViews: ['all-songs', 'favorites', (name) => name.startsWith('playlist-')] },
    { id: 'recent', label: 'Recent', panelOnly: true, hostedBy: 'library', engineViews: ['history'] },
    { id: 'settings', label: 'Settings', engine: 'settings', engineViews: ['settings', /^settings-/] }
];

describe('createViewRegistry', () => {
    test('rejects a duplicate id, a missing label, an unknown field and a view that draws itself without mount()', () => {
        assert.throws(() => createViewRegistry([{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }]), /Two views have the id "a"/);
        assert.throws(() => createViewRegistry([{ id: 'a' }]), /needs a label/);
        assert.throws(() => createViewRegistry([{ id: 'a', label: 'A', colour: 'red' }]), /unknown field "colour"/);
        assert.throws(() => createViewRegistry([{ id: 'a', label: 'A', own: true }]), /no mount/);
        assert.throws(() => createViewRegistry([{ id: 'a', label: 'A', hostedBy: 'nope' }]), /does not exist/);
        assert.throws(() => createViewRegistry([]), /at least one view/);
    });

    test('forEngine finds the owner of an engine page by string, RegExp or function; hostFor sends a panel-only item to its host', () => {
        const { registry } = fakeShell(VIEWS());
        assert.equal(registry.forEngine('favorites').id, 'library');
        assert.equal(registry.forEngine('playlist-7').id, 'library');
        assert.equal(registry.forEngine('settings-advanced').id, 'settings');
        assert.equal(registry.forEngine('history').id, 'recent');
        assert.equal(registry.hostFor('history').id, 'library', 'Recents only fills the panel; its list is shown by the Library view');
        assert.equal(registry.forEngine('nothing'), null);
        assert.equal(registry.forEngine(''), null);
    });

    test('railItems skips rail:false; reenter defaults to keep for a view with leave() and rebuild for the others', () => {
        const registry = createViewRegistry([{ id: 'a', label: 'A', leave() {} }, { id: 'b', label: 'B', rail: false }, { id: 'c', label: 'C', leave() {}, reenter: 'rebuild' }]);
        assert.deepEqual(registry.railItems().map((v) => v.id), ['a', 'c']);
        assert.equal(registry.reenter(registry.get('a')), 'keep');
        assert.equal(registry.reenter(registry.get('b')), 'rebuild');
        assert.equal(registry.reenter(registry.get('c')), 'rebuild');
    });

    test('showsEnginePage is true for an engine page, not for an engine panel tab or a view of the shell', () => {
        assert.equal(showsEnginePage({ engine: 'all-songs' }), true);
        assert.equal(showsEnginePage({ enginePanel: 'metadata' }), false);
        assert.equal(showsEnginePage({ own: true }), false);
        assert.equal(showsEnginePage(null), false);
    });
});

describe('createRouter', () => {
    test('a plain change draws the view, records it and runs after()', () => {
        const { router, log, state } = fakeShell(VIEWS());
        let after = 0;
        assert.equal(router.go('library', { after: () => after++ }), 'shown');
        assert.deepEqual(log, ['enter:library', 'committed:library']);
        assert.equal(state.current, 'library');
        assert.equal(after, 1);
    });

    test('an unknown id falls back to the first view', () => {
        const { router, state } = fakeShell(VIEWS());
        state.current = 'settings';
        router.go('no-such-view');
        assert.equal(state.current, 'home');
    });

    test('a view that is not ready reports unavailable, is recorded, and does not run after()', () => {
        const { router, log } = fakeShell(VIEWS(), { enter: (view) => (view.id === 'library' ? false : true) });
        let after = 0;
        assert.equal(router.go('library', { after: () => after++ }), 'unavailable');
        assert.deepEqual(log, ['enter:library', 'committed:library']);
        assert.equal(after, 0);
    });

    test('leave() returning false keeps the person where they are', () => {
        const defs = VIEWS();
        defs[0].leave = () => false;
        const { router, log, state } = fakeShell(defs);
        assert.equal(router.go('library'), 'stayed');
        assert.equal(state.current, 'home');
        assert.deepEqual(log, ['willLeave:home', 'didLeave:home']);
    });

    test('a view with a form keeps it when chosen again, a view without one is drawn again, rebuild:true forces it', () => {
        const defs = VIEWS();
        defs[0].leave = () => true;
        const { router, log } = fakeShell(defs);
        assert.equal(router.go('home'), 'shown');
        assert.deepEqual(log, [], 'home has a leave(): choosing it again draws nothing');
        router.go('home', { rebuild: true });
        assert.deepEqual(log, ['willLeave:home', 'didLeave:home', 'enter:home', 'committed:home'], 'rebuild asks the view first, then draws it again');
        log.length = 0;
        router.go('library');
        router.go('library');
        assert.equal(log.filter((entry) => entry === 'enter:library').length, 2);
    });

    test('fromEngine does not ask the view on screen: the engine already moved it away', () => {
        const defs = VIEWS();
        let asked = 0;
        defs[0].leave = () => (asked++, false);
        const { router, state } = fakeShell(defs);
        assert.equal(router.go('library', { fromEngine: true }), 'shown');
        assert.equal(asked, 0);
        assert.equal(state.current, 'library');
    });

    test('a leave() that answers later: the change waits, then happens on yes and is dropped on no', async () => {
        for (const answer of [true, false]) {
            const defs = VIEWS();
            let resolveLeave;
            defs[0].leave = () => new Promise((resolve) => (resolveLeave = resolve));
            const { router, state, log } = fakeShell(defs);
            const outcome = router.go('library');
            assert.equal(typeof outcome.then, 'function');
            assert.equal(router.asking(), true);
            assert.equal(state.current, 'home', 'nothing changes while the person is being asked');
            resolveLeave(answer);
            assert.equal(await outcome, answer ? 'shown' : 'stayed');
            assert.equal(state.current, answer ? 'library' : 'home');
            assert.equal(router.asking(), false);
            assert.equal(log.filter((entry) => entry === 'willLeave:home').length, 1);
        }
    });

    test('a second choice while the question is open does not ask again; the last choice is the one that happens', async () => {
        const defs = VIEWS();
        let asked = 0;
        let resolveLeave;
        defs[0].leave = () => (asked++, new Promise((resolve) => (resolveLeave = resolve)));
        const { router, state } = fakeShell(defs);
        const first = router.go('library');
        const second = router.go('settings');
        assert.equal(asked, 1);
        resolveLeave(true);
        await first;
        await second;
        assert.equal(state.current, 'settings');
    });

    test('choosing the view you are on while it asks cancels the change that was waiting', async () => {
        const defs = VIEWS();
        let resolveLeave;
        defs[0].leave = () => new Promise((resolve) => (resolveLeave = resolve));
        const { router, state } = fakeShell(defs);
        const outcome = router.go('library');
        assert.equal(router.go('home'), 'shown');
        resolveLeave(true);
        assert.equal(await outcome, 'stayed');
        assert.equal(state.current, 'home');
    });

    test('after() also runs when the change had to wait for an answer', async () => {
        const defs = VIEWS();
        let resolveLeave;
        defs[0].leave = () => new Promise((resolve) => (resolveLeave = resolve));
        const { router } = fakeShell(defs);
        let after = 0;
        const outcome = router.go('library', { after: () => after++ });
        assert.equal(after, 0);
        resolveLeave(true);
        await outcome;
        assert.equal(after, 1);
    });

    test('a leave() that throws never traps the person, and the leaving flag is always put down again', () => {
        const defs = VIEWS();
        defs[0].leave = () => {
            throw new Error('boom');
        };
        const { router, log, state } = fakeShell(defs);
        assert.equal(router.go('library'), 'shown');
        assert.equal(state.current, 'library');
        assert.ok(log.includes('report:leave:home'));
        assert.equal(log.indexOf('didLeave:home') > log.indexOf('willLeave:home'), true);
    });

    test('a leave() whose Promise rejects is treated as yes', async () => {
        const defs = VIEWS();
        defs[0].leave = () => Promise.reject(new Error('boom'));
        const { router, state } = fakeShell(defs);
        assert.equal(await router.go('library'), 'shown');
        assert.equal(state.current, 'library');
    });

    test('a view that throws while it is drawn is recovered, reported, and drawn again the next time even if it would keep its form', () => {
        const defs = VIEWS();
        defs[3].leave = () => false; // Settings would refuse to be left, and a view that never drew must not hold anyone
        let failing = true;
        const { router, log, state } = fakeShell(defs, {
            enter: (view) => {
                if (view.id === 'settings' && failing) throw new Error('mount failed');
            }
        });
        assert.equal(router.go('settings'), 'failed');
        assert.equal(state.current, 'settings');
        assert.ok(log.includes('recover:settings') && log.includes('report:enter:settings'));
        assert.equal(router.brokenView(), 'settings');
        assert.equal(router.go('library'), 'shown', 'the broken view has no guard: the person can leave it');
        assert.equal(router.brokenView(), null);
        failing = false;
        assert.equal(router.go('settings'), 'shown');
    });

    test('choosing a broken view again draws it again instead of keeping the empty page', () => {
        const defs = VIEWS();
        defs[3].leave = () => true;
        let failing = true;
        const { router, log } = fakeShell(defs, {
            enter: (view) => {
                if (view.id === 'settings' && failing) throw new Error('mount failed');
            }
        });
        router.go('settings');
        failing = false;
        log.length = 0;
        assert.equal(router.go('settings'), 'shown');
        assert.ok(log.includes('enter:settings'));
    });

    test('canEnter can refuse, redirect, or throw without locking the view out', () => {
        const defs = VIEWS();
        defs[1].canEnter = () => false;
        const refused = fakeShell(defs);
        assert.equal(refused.router.go('library'), 'refused');
        assert.equal(refused.state.current, 'home');

        const redirectDefs = VIEWS();
        redirectDefs[1].canEnter = () => ({ redirect: 'settings' });
        const redirected = fakeShell(redirectDefs);
        assert.equal(redirected.router.go('library'), 'shown');
        assert.equal(redirected.state.current, 'settings');

        const throwingDefs = VIEWS();
        throwingDefs[1].canEnter = () => {
            throw new Error('boom');
        };
        const lenient = fakeShell(throwingDefs);
        assert.equal(lenient.router.go('library'), 'shown');
        assert.equal(lenient.state.current, 'library');
    });

    test('a redirect loop is cut off', () => {
        const defs = VIEWS();
        defs[1].canEnter = () => ({ redirect: 'settings' });
        defs[3].canEnter = () => ({ redirect: 'library' });
        const { router, state } = fakeShell(defs);
        assert.equal(router.go('library'), 'refused');
        assert.equal(state.current, 'home');
    });

    test('a change asked for while another is being drawn waits until that one is done', () => {
        const defs = VIEWS();
        let router;
        const order = [];
        const shell = fakeShell(defs, {
            enter: (view) => {
                order.push(`start:${view.id}`);
                if (view.id === 'library') assert.equal(router.go('settings'), 'queued');
                order.push(`end:${view.id}`);
            }
        });
        router = shell.router;
        router.go('library');
        assert.deepEqual(order, ['start:library', 'end:library', 'start:settings', 'end:settings']);
        assert.equal(shell.state.current, 'settings');
    });

    test('drawing() is true only while a view is drawn', () => {
        let router;
        let during;
        const shell = fakeShell(VIEWS(), { enter: () => (during = router.drawing()) });
        router = shell.router;
        assert.equal(router.drawing(), false);
        router.go('library');
        assert.equal(during, true);
        assert.equal(router.drawing(), false);
    });

    test('an after() that throws is reported and does not undo the change', () => {
        const { router, log, state } = fakeShell(VIEWS());
        assert.equal(router.go('library', { after: () => { throw new Error('boom'); } }), 'shown');
        assert.equal(state.current, 'library');
        assert.ok(log.includes('report:after:library'));
    });
});

describe('the leave guard and a view that is asked twice in a row', () => {
    test('after the person answers yes the view is not asked a second time', async () => {
        const defs = VIEWS();
        let asked = 0;
        let resolveLeave;
        defs[0].leave = () => (asked++, new Promise((resolve) => (resolveLeave = resolve)));
        const { router } = fakeShell(defs);
        const outcome = router.go('library');
        resolveLeave(true);
        await outcome;
        await tick();
        assert.equal(asked, 1);
    });
});
