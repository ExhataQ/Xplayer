'use strict';

// The "same calls, same order" suite for playback and selection (10*, 13-17). Add scenarios in helpers/scenarios-b.js;
// the recorded sequences live in expected/events-b.json. See helpers/sequence-suite.js.

const path = require('path');
const { defineSequenceSuite } = require('./helpers/sequence-suite');
const { SCENARIOS } = require('./helpers/scenarios-b');

defineSequenceSuite({
    title: 'event bus, agent B: converted reactions keep their call order',
    scenarios: SCENARIOS,
    expectedFile: path.join(__dirname, 'expected', 'events-b.json')
});
