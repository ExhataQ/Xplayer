'use strict';

// Agent D's "same calls, same order" suite. Add scenarios in helpers/scenarios-d.js;
// the recorded sequences live in expected/events-d.json. See helpers/sequence-suite.js.

const path = require('path');
const { defineSequenceSuite } = require('./helpers/sequence-suite');
const { SCENARIOS } = require('./helpers/scenarios-d');

defineSequenceSuite({
    title: 'event bus, agent D: converted reactions keep their call order',
    scenarios: SCENARIOS,
    expectedFile: path.join(__dirname, 'expected', 'events-d.json')
});
