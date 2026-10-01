'use strict';

// Agent C's "same calls, same order" suite. Add scenarios in helpers/scenarios-c.js;
// the recorded sequences live in expected/events-c.json. See helpers/sequence-suite.js.

const path = require('path');
const { defineSequenceSuite } = require('./helpers/sequence-suite');
const { SCENARIOS } = require('./helpers/scenarios-c');

defineSequenceSuite({
    title: 'event bus, agent C: converted reactions keep their call order',
    scenarios: SCENARIOS,
    expectedFile: path.join(__dirname, 'expected', 'events-c.json')
});
