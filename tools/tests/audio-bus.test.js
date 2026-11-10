// The audio bus (visualizer plan V1): sources -> equalizer chain or bypass -> tap -> speakers, with an analyser hung off the tap only while the
// visualizer is on. Checked with a fake Web Audio that records which node is connected to which, so the wiring is tested without a browser.
//
// Run:   node --test tools/tests/audio-bus.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const MODULE = pathToFileURL(path.join(__dirname, '..', '..', 'src', 'js', 'playback', '15h-equalizer.js')).href;
let counter = 0;
const fresh = () => import(`${MODULE}?bus=${counter++}`);

class Node {
    constructor(kind) {
        this.kind = kind;
        this.out = [];
        this.gain = { value: 1, setTargetAtTime() {} };
        this.frequency = { value: 0 };
        this.Q = { value: 0 };
    }
    connect(to) {
        this.out.push(to);
        return to;
    }
    disconnect(to) {
        this.out = to ? this.out.filter((n) => n !== to) : [];
    }
}

let contexts;
let stored;

function installFakes({ available = true } = {}) {
    contexts = [];
    stored = null;
    class FakeContext {
        constructor() {
            this.state = 'running';
            this.currentTime = 0;
            this.sampleRate = 48000;
            this.destination = new Node('destination');
            this.sources = [];
            contexts.push(this);
        }
        createGain() {
            return new Node('gain');
        }
        createBiquadFilter() {
            return new Node('biquad');
        }
        createAnalyser() {
            const node = new Node('analyser');
            this.analyser = node;
            return node;
        }
        createMediaElementSource(element) {
            const node = new Node('source');
            node.element = element;
            this.sources.push(node);
            return node;
        }
        resume() {
            return Promise.resolve();
        }
    }
    global.window = { AudioContext: FakeContext };
    global.desktopApi = { supports: () => true, files: { mediaProtocolAvailable: () => available } };
    global.STORAGE_KEYS = { EQUALIZER_SETTINGS: 'eq' };
    global.storageReadJson = (_key, fallback, normalize) => normalize(stored || fallback);
    global.storageWriteJson = (_key, value) => {
        stored = value;
    };
    const makeElement = (src) => ({
        _src: src,
        attrs: {},
        listeners: {},
        paused: true,
        ended: false,
        currentTime: 0,
        getAttribute(name) {
            return name === 'src' ? this._src : null;
        },
        removeAttribute(name) {
            delete this.attrs[name];
        },
        addEventListener(name, fn) {
            this.listeners[name] = fn;
        },
        set src(value) {
            this._src = value;
        },
        get src() {
            return this._src;
        }
    });
    global.audioElement = makeElement('file:///music/a.mp3');
    global.gaplessAudioElement = makeElement('');
}

describe('needsProtocolFor', () => {
    test('the protocol is needed when the equalizer is on, or the visualizer is on, or an element is already routed; never when it is not available', async () => {
        const { needsProtocolFor } = await fresh();
        const base = { available: true, equalizerOn: false, visualizerOn: false, routed: false };
        assert.equal(needsProtocolFor(base), false);
        assert.equal(needsProtocolFor({ ...base, equalizerOn: true }), true);
        assert.equal(needsProtocolFor({ ...base, visualizerOn: true }), true);
        assert.equal(needsProtocolFor({ ...base, routed: true }), true);
        for (const flag of ['equalizerOn', 'visualizerOn', 'routed']) assert.equal(needsProtocolFor({ ...base, available: false, [flag]: true }), false, flag);
    });
});

describe('the bus', () => {
    beforeEach(() => installFakes());

    test('visualizer off and equalizer off: no audio graph, no analyser, a track is a plain assignment', async () => {
        const bus = await fresh();
        assert.equal(bus.getVisualizerAnalyser(), null);
        const element = global.audioElement;
        bus.assignAudioSource(element, 'file:///music/b.mp3');
        assert.equal(contexts.length, 0, 'nothing was created');
        assert.equal(element.src, 'file:///music/b.mp3');
    });

    test('visualizer on, equalizer off: sources go to the tap, the tap goes to the speakers and to the analyser, the analyser goes nowhere', async () => {
        const bus = await fresh();
        assert.equal(bus.setVisualizerActive(true), true);
        const [context] = contexts;
        const analyser = bus.getVisualizerAnalyser();
        assert.ok(analyser && analyser === context.analyser);
        const tap = context.sources[0].out[0];
        assert.equal(tap.kind, 'gain');
        assert.ok(tap.out.includes(context.destination), 'the tap feeds the speakers');
        assert.ok(tap.out.includes(analyser), 'the tap feeds the analyser');
        assert.equal(analyser.out.length, 0, 'the analyser is a dead end: it cannot change the sound');
        assert.equal(context.destination.out.length, 0);
        assert.equal(context.sources.length, 2, 'both physical elements (the gapless pair) are in the chain');
    });

    test('with the visualizer on, a new track is loaded through the media protocol and its element is routed first', async () => {
        const bus = await fresh();
        bus.setVisualizerActive(true);
        const element = global.gaplessAudioElement;
        bus.assignAudioSource(element, 'file:///music/c.mp3');
        assert.match(element.src, /^xplayer-media:\/\/media\//);
        assert.ok(contexts[0].sources.some((s) => s.element === element), 'the gapless element is in the chain');
    });

    test('visualizer and equalizer both on: sources go through the filters, the last filter goes to the tap, the analyser listens at the tap', async () => {
        const bus = await fresh();
        bus.setEqualizerEnabled(true);
        bus.setVisualizerActive(true);
        const [context] = contexts;
        const source = context.sources[0];
        const input = source.out[0];
        assert.notEqual(input.out[0].kind, 'destination');
        let node = input.out[0];
        while (node.kind === 'biquad' && node.out[0] && node.out[0].kind === 'biquad') node = node.out[0];
        const tap = node.out[0];
        assert.equal(tap.kind, 'gain');
        assert.ok(tap.out.includes(context.destination) && tap.out.includes(context.analyser));
    });

    test('visualizer off again: the analyser is gone, the sound path to the speakers is untouched', async () => {
        const bus = await fresh();
        bus.setVisualizerActive(true);
        const [context] = contexts;
        const analyser = bus.getVisualizerAnalyser();
        const tap = context.sources[0].out[0];
        assert.equal(bus.setVisualizerActive(false), true);
        assert.equal(bus.getVisualizerAnalyser(), null);
        assert.ok(!tap.out.includes(analyser));
        assert.ok(tap.out.includes(context.destination));
        assert.equal(bus.setVisualizerActive(true), true, 'and it can come back');
        assert.ok(bus.getVisualizerAnalyser());
    });

    test('turning the visualizer on twice makes one analyser', async () => {
        const bus = await fresh();
        bus.setVisualizerActive(true);
        const first = bus.getVisualizerAnalyser();
        bus.setVisualizerActive(true);
        assert.equal(bus.getVisualizerAnalyser(), first);
        assert.equal(contexts.length, 1);
    });
});

describe('where the bus is not available', () => {
    test('without the media protocol (a plain browser) the visualizer cannot start and nothing is created', async () => {
        installFakes({ available: false });
        const bus = await fresh();
        assert.equal(bus.setVisualizerActive(true), false);
        assert.equal(bus.getVisualizerAnalyser(), null);
        assert.equal(contexts.length, 0);
    });

    test('if Web Audio throws, the visualizer reports false and leaves no analyser', async () => {
        installFakes();
        global.window.AudioContext = function () {
            throw new Error('no audio');
        };
        const bus = await fresh();
        assert.equal(bus.setVisualizerActive(true), false);
        assert.equal(bus.getVisualizerAnalyser(), null);
    });
});
