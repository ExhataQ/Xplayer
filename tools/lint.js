#!/usr/bin/env node
'use strict';

// Runs ESLint over src/js and electron with the root eslint.config.js and prints the problems plus a count per rule.
//
//   node tools/lint.js            exits 1 if there is any ERROR; warnings are only reported      (npm run lint)
//   node tools/lint.js --strict   exits 1 if there is any error OR warning                       (npm run lint:strict)
//   node tools/lint.js --summary  only the counts, not every problem
//
// Exit codes: 0 = pass, 1 = lint failed, 2 = ESLint could not run (not installed, or it threw).
// It never fixes anything and never edits a file.

const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Counts errors and warnings (and a per-rule breakdown) in ESLint's result array. A parse error has no ruleId
// and severity 2, so it counts as an error.
function tally(results) {
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
    return { errors, warnings, perRule };
}

// Errors always fail. Warnings fail only in strict mode.
function exitCodeFor({ errors, warnings, strict }) {
    if (errors > 0) return 1;
    if (strict && warnings > 0) return 1;
    return 0;
}

async function main(argv) {
    const strict = argv.includes('--strict');
    const summaryOnly = argv.includes('--summary');

    let ESLint;
    try {
        ({ ESLint } = require('eslint'));
    } catch (e) {
        console.error('ESLint is not installed. Run: npm install');
        return 2;
    }
    const eslint = new ESLint({ cwd: ROOT });
    const results = await eslint.lintFiles(['src/js', 'electron']);

    if (!summaryOnly) {
        const formatter = await eslint.loadFormatter('stylish');
        const text = formatter.format(results);
        if (text) console.log(text);
    }

    const { errors, warnings, perRule } = tally(results);
    console.log(`\nESLint: ${results.length} files checked, ${errors} error(s), ${warnings} warning(s)`);
    for (const [rule, row] of [...perRule].sort((a, b) => b[1].error + b[1].warn - (a[1].error + a[1].warn))) {
        console.log(`  ${rule.padEnd(24)} errors ${String(row.error).padStart(5)}   warnings ${String(row.warn).padStart(5)}`);
    }

    const code = exitCodeFor({ errors, warnings, strict });
    if (code !== 0) {
        console.log(errors > 0 ? `\nLint failed: ${errors} error(s).` : `\nLint failed (--strict): ${warnings} warning(s).`);
    }
    return code;
}

module.exports = { tally, exitCodeFor };

if (require.main === module) {
    main(process.argv).then(
        (code) => process.exit(code),
        (e) => {
            console.error(e);
            process.exit(2);
        }
    );
}
