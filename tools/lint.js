#!/usr/bin/env node
'use strict';

// Runs ESLint over src/js and electron with the root eslint.config.js and prints the problems plus a count per rule.
//
//   node tools/lint.js            report only: always exits 0 (unless ESLint itself cannot run)   (npm run lint)
//   node tools/lint.js --strict   exits 1 if there is any error OR warning                         (npm run lint:strict)
//   node tools/lint.js --summary  only the counts, not every problem
//
// It never fixes anything and never edits a file.

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');
const summaryOnly = process.argv.includes('--summary');

(async () => {
    let ESLint;
    try {
        ({ ESLint } = require('eslint'));
    } catch (e) {
        console.error('ESLint is not installed. Run: npm install');
        process.exit(2);
    }
    const eslint = new ESLint({ cwd: ROOT });
    const results = await eslint.lintFiles(['src/js', 'electron']);

    if (!summaryOnly) {
        const formatter = await eslint.loadFormatter('stylish');
        const text = formatter.format(results);
        if (text) console.log(text);
    }

    const perRule = new Map();
    let errors = 0;
    let warnings = 0;
    for (const r of results) {
        for (const m of r.messages) {
            const key = m.ruleId || '(parse error)';
            const row = perRule.get(key) || { error: 0, warn: 0 };
            if (m.severity === 2) (row.error++, errors++);
            else (row.warn++, warnings++);
            perRule.set(key, row);
        }
    }
    console.log(`\nESLint: ${results.length} files checked, ${errors} error(s), ${warnings} warning(s)`);
    for (const [rule, row] of [...perRule].sort((a, b) => b[1].error + b[1].warn - (a[1].error + a[1].warn))) {
        console.log(`  ${rule.padEnd(24)} errors ${String(row.error).padStart(5)}   warnings ${String(row.warn).padStart(5)}`);
    }
    process.exit(strict && errors + warnings > 0 ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(2);
});
