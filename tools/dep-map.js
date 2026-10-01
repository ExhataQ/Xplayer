#!/usr/bin/env node
// Cross-file dependency map for the classic-script renderer (src/js).
// Needs: npm i -D acorn acorn-walk
//
//   node tools/dep-map.js                 summary report
//   node tools/dep-map.js writers <name>  files that assign to a global (defining file marked *)
//   node tools/dep-map.js uses <name>     files that reference a global
//   node tools/dep-map.js json <out.json> full map (defs, uses, writes, edges)
//
// Limits: static only. Dynamic access such as window[name] is invisible, and a
// global that shares a name with a local is resolved by scope, not by intent.
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const ROOT = process.env.SOURCE_ROOT || path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'src', 'js');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'manifest.json'), 'utf8'));
const files = [...manifest.js, '99-player.js'];
const order = Object.fromEntries(files.map((f, i) => [f, i]));

function patternNames(p, out = []) {
    if (!p) return out;
    if (p.type === 'Identifier') out.push(p.name);
    else if (p.type === 'ObjectPattern') p.properties.forEach((x) => patternNames(x.value || x.argument, out));
    else if (p.type === 'ArrayPattern') p.elements.forEach((x) => patternNames(x, out));
    else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
    else if (p.type === 'RestElement') patternNames(p.argument, out);
    return out;
}

function ownDeclarations(block, set) {
    for (const x of block.body) {
        if (x.type === 'VariableDeclaration') x.declarations.forEach((d) => patternNames(d.id).forEach((n) => set.add(n)));
        else if (x.type === 'FunctionDeclaration' || x.type === 'ClassDeclaration') set.add(x.id.name);
    }
    walk.simple({ type: 'BlockStatement', body: block.body }, {
        VariableDeclaration(v) {
            if (v.kind === 'var') v.declarations.forEach((d) => patternNames(d.id).forEach((n) => set.add(n)));
        }
    });
}

function parse(file) {
    const src = fs.readFileSync(path.join(JS_DIR, file), 'utf8').replace(/\{\{[A-Z_]+\}\}/g, 'null');
    return acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true });
}

const asts = {};
const defs = {};
const decls = {};
for (const f of files) {
    asts[f] = parse(f);
    decls[f] = [];
    for (const n of asts[f].body) {
        let names = [];
        let kind;
        if (n.type === 'FunctionDeclaration') { names = [n.id.name]; kind = 'fn'; }
        else if (n.type === 'ClassDeclaration') { names = [n.id.name]; kind = 'class'; }
        else if (n.type === 'VariableDeclaration') {
            kind = n.kind;
            n.declarations.forEach((d) => patternNames(d.id, names));
        }
        for (const name of names) {
            defs[name] = defs[name] || { file: f, kind };
            decls[f].push(name);
        }
    }
}

const uses = {};
const writes = {};
const loadTime = {};

function analyze(f) {
    const u = (uses[f] = new Map());
    const w = (writes[f] = new Map());
    const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    const isGlobal = (name, scope) => !scope.has(name) && defs[name];

    walk.recursive(asts[f], new Set(), {
        Function(n, st, c) {
            const s = new Set(st);
            n.params.forEach((p) => patternNames(p, []).forEach((x) => s.add(x)));
            if (n.id && n.type === 'FunctionExpression') s.add(n.id.name);
            if (n.body.type === 'BlockStatement') ownDeclarations(n.body, s);
            n.params.forEach((p) => p.type === 'AssignmentPattern' && c(p.right, s));
            c(n.body, s);
        },
        BlockStatement(n, st, c) {
            const s = new Set(st);
            ownDeclarations(n, s);
            n.body.forEach((x) => c(x, s));
        },
        ForStatement(n, st, c) {
            const s = new Set(st);
            if (n.init && n.init.type === 'VariableDeclaration') ownDeclarations({ body: [n.init] }, s);
            [n.init, n.test, n.update, n.body].forEach((x) => x && c(x, s));
        },
        ForInStatement(n, st, c) {
            const s = new Set(st);
            if (n.left.type === 'VariableDeclaration') ownDeclarations({ body: [n.left] }, s);
            c(n.right, s); c(n.body, s);
        },
        ForOfStatement(n, st, c) {
            const s = new Set(st);
            if (n.left.type === 'VariableDeclaration') ownDeclarations({ body: [n.left] }, s);
            c(n.right, s); c(n.body, s);
        },
        CatchClause(n, st, c) {
            const s = new Set(st);
            patternNames(n.param, []).forEach((x) => s.add(x));
            c(n.body, s);
        },
        MemberExpression(n, st, c) { c(n.object, st); if (n.computed) c(n.property, st); },
        Property(n, st, c) { if (n.computed) c(n.key, st); if (n.value) c(n.value, st); },
        MethodDefinition(n, st, c) { if (n.computed) c(n.key, st); c(n.value, st); },
        PropertyDefinition(n, st, c) { if (n.value) c(n.value, st); },
        LabeledStatement(n, st, c) { c(n.body, st); },
        BreakStatement() {},
        ContinueStatement() {},
        Identifier(n, st) { if (isGlobal(n.name, st)) bump(u, n.name); },
        AssignmentExpression(n, st, c) {
            const t = n.left;
            const targets = t.type === 'Identifier' ? [t.name] : t.type.endsWith('Pattern') ? patternNames(t) : [];
            targets.forEach((id) => { if (isGlobal(id, st)) { bump(w, id); bump(u, id); } });
            if (t.type === 'MemberExpression') c(t, st);
            c(n.right, st);
        },
        UpdateExpression(n, st, c) {
            if (n.argument.type === 'Identifier' && isGlobal(n.argument.name, st)) bump(w, n.argument.name);
            c(n.argument, st);
        }
    });

    const lt = (loadTime[f] = new Map());
    const own = new Set(decls[f]);
    walk.recursive(asts[f], null, {
        Function() {},
        MemberExpression(n, s, c) { c(n.object, s); if (n.computed) c(n.property, s); },
        Property(n, s, c) { if (n.computed) c(n.key, s); c(n.value, s); },
        Identifier(n) {
            const d = defs[n.name];
            if (d && d.file !== f && !own.has(n.name)) lt.set(n.name, d.file);
        }
    });
}
files.forEach(analyze);

const edges = {};
for (const f of files) {
    edges[f] = new Map();
    for (const name of uses[f].keys()) {
        const o = defs[name].file;
        if (o !== f) edges[f].set(o, (edges[f].get(o) || 0) + 1);
    }
}

function sccs() {
    let i = 0;
    const stack = [], on = new Set(), ix = {}, low = {}, out = [];
    function visit(v) {
        ix[v] = low[v] = i++;
        stack.push(v);
        on.add(v);
        for (const w of edges[v].keys()) {
            if (ix[w] === undefined) { visit(w); low[v] = Math.min(low[v], low[w]); }
            else if (on.has(w)) low[v] = Math.min(low[v], ix[w]);
        }
        if (low[v] === ix[v]) {
            const comp = [];
            let w;
            do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v);
            out.push(comp);
        }
    }
    files.forEach((f) => { if (ix[f] === undefined) visit(f); });
    return out.filter((c) => c.length > 1);
}

function crossFileWriters() {
    const out = {};
    for (const f of files) for (const name of writes[f].keys()) {
        if (defs[name].file !== f) (out[name] = out[name] || new Set()).add(f);
    }
    return out;
}

function fanIn() {
    const out = {};
    for (const f of files) for (const o of edges[f].keys()) out[o] = (out[o] || 0) + 1;
    return out;
}

function report() {
    const fin = fanIn();
    const consumers = {};
    for (const f of files) for (const name of uses[f].keys()) {
        if (defs[name].file !== f) consumers[name] = (consumers[name] || 0) + 1;
    }
    const writers = crossFileWriters();
    const kinds = {};
    Object.values(defs).forEach((d) => { kinds[d.kind] = (kinds[d.kind] || 0) + 1; });

    console.log(`files: ${files.length}   globals: ${Object.keys(defs).length}   kinds: ${JSON.stringify(kinds)}`);

    console.log('\nFiles most depended on (files that use something they define):');
    Object.entries(fin).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    console.log('\nFiles that depend on the most other files:');
    files.map((f) => [f, edges[f].size]).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    console.log('\nMost shared globals (consumer files):');
    Object.entries(consumers).sort((a, b) => b[1] - a[1]).slice(0, 25)
        .forEach(([k, v]) => console.log(`  ${k}: ${v}  (${defs[k].file}, ${defs[k].kind})`));

    const wl = Object.entries(writers).sort((a, b) => b[1].size - a[1].size);
    console.log(`\nMutable globals assigned from other files: ${wl.length}`);
    wl.slice(0, 30).forEach(([k, v]) => console.log(`  ${k} [${defs[k].file}] <- ${[...v].join(', ')}`));

    const cycles = sccs();
    console.log(`\nFile-level cycles: ${cycles.map((c) => c.length).join(', ') || 'none'}`);

    const loadRefs = [];
    for (const f of files) for (const [name, o] of loadTime[f]) loadRefs.push({ f, name, o, forward: order[o] > order[f] });
    console.log(`\nLoad-time cross-file references: ${loadRefs.length} (forward, would break if reordered: ${loadRefs.filter((r) => r.forward).length})`);
    const by = {};
    loadRefs.forEach((r) => { (by[r.f] = by[r.f] || new Set()).add(r.o); });
    Object.entries(by).forEach(([k, v]) => console.log(`  ${k} <- ${[...v].join(', ')}`));

    console.log('\nLeaf candidates (depend on at most 2 other files):');
    files.filter((f) => edges[f].size <= 2 && decls[f].length)
        .forEach((f) => console.log(`  ${f}  out=${edges[f].size}  defs=${decls[f].length}  in=${fin[f] || 0}`));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'writers') {
    for (const name of args) {
        if (!defs[name]) { console.log(`${name}: not a known global`); continue; }
        const list = files.filter((f) => writes[f].has(name));
        console.log(`${name} (${defs[name].kind}, defined in ${defs[name].file})`);
        list.forEach((f) => console.log(`  ${f === defs[name].file ? '*' : ' '} ${f}  x${writes[f].get(name)}`));
    }
} else if (cmd === 'uses') {
    for (const name of args) {
        if (!defs[name]) { console.log(`${name}: not a known global`); continue; }
        console.log(`${name} (${defs[name].kind}, defined in ${defs[name].file})`);
        files.filter((f) => uses[f].has(name)).forEach((f) => console.log(`    ${f}  x${uses[f].get(name)}`));
    }
} else if (cmd === 'json') {
    const out = args[0];
    if (!out) { console.error('usage: dep-map.js json <out.json>'); process.exit(1); }
    fs.writeFileSync(out, JSON.stringify({
        files, defs, decls,
        uses: Object.fromEntries(files.map((f) => [f, Object.fromEntries(uses[f])])),
        writes: Object.fromEntries(files.map((f) => [f, Object.fromEntries(writes[f])])),
        edges: Object.fromEntries(files.map((f) => [f, Object.fromEntries(edges[f])]))
    }, null, 2));
    console.log(`wrote ${out}`);
} else {
    report();
}
