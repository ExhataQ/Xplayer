'use strict';

// Agent A's "same calls, same order" suite. Add scenarios in helpers/scenarios-a.js;
// the recorded sequences live in expected/events-a.json. See helpers/sequence-suite.js.

const path = require('path');
const { defineSequenceSuite } = require('./helpers/sequence-suite');
const { SCENARIOS } = require('./helpers/scenarios-a');

defineSequenceSuite({
    title: 'event bus, agent A: converted reactions keep their call order',
    scenarios: SCENARIOS,
    expectedFile: path.join(__dirname, 'expected', 'events-a.json')
});
