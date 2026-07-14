// Unit tests for the minify (esbuild bundling) build helpers extracted into
// minify-util.js (which owns the whole minify surface, including the inlineSourceMap C4 guard).
//
// This suite is required from Tests/L0.ts so it registers under the same L0.js entry
// that the repo test harness runs (make.js only executes _build/Tests/L0.js).
import assert = require('assert');
import path = require('path');
import fs = require('fs');

describe('Minify build helpers (minify-util)', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    // Repo-root module; from _build/Tests this is ../../. minify-util.js owns the
    // whole minify surface: the bundling pipeline + the inlineSourceMap (C4) guard.
    var minifyUtil = require('../../minify-util.js');

    describe('nodeHandlerToMajor', function () {
        it('maps supported Node handlers to their runtime major', () => {
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('Node10'), 10);
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('Node16'), 16);
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('Node20'), 20);
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('Node24'), 24);
        });

        it('strips the _N revision suffix (Node20_1 targets node20)', () => {
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('Node20_1'), 20);
        });

        it('returns null for bare Node, unknown Node* and non-Node handlers', () => {
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('Node'), null);
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('Node22'), null);
            assert.strictEqual(minifyUtil.nodeHandlerToMajor('PowerShell3'), null);
        });
    });

    describe('collectNodeExecutionTargets', function () {
        it('collects Node entries from execution, prejobexecution and postjobexecution', () => {
            var def = {
                execution: { Node16: { target: 'main.js' } },
                prejobexecution: { Node16: { target: 'pre.js' } },
                postjobexecution: { Node16: { target: 'post.js' } }
            };
            var files = minifyUtil.collectNodeExecutionTargets(def, 'T').map(e => e.file).sort();
            assert.strictEqual(JSON.stringify(files), JSON.stringify(['main.js', 'post.js', 'pre.js']));
        });

        it('targets the lowest declared runtime when an entry is shared across runtimes', () => {
            var def = { execution: { Node16: { target: 'main.js' }, Node10: { target: 'main.js' } } };
            var entries = minifyUtil.collectNodeExecutionTargets(def, 'T');
            assert.strictEqual(JSON.stringify(entries), JSON.stringify([{ file: 'main.js', nodeMajor: 10 }]));
        });

        it('derives per-entry targets independently across phases', () => {
            // execution declares Node10 (=> node10), prejob only Node16 (=> node16)
            var def = {
                execution: { Node10: { target: 'main.js' }, Node16: { target: 'main.js' } },
                prejobexecution: { Node16: { target: 'pre.js' } }
            };
            var byFile = {};
            minifyUtil.collectNodeExecutionTargets(def, 'T').forEach(e => { byFile[e.file] = e.nodeMajor; });
            assert.strictEqual(byFile['main.js'], 10);
            assert.strictEqual(byFile['pre.js'], 16);
        });

        it('ignores non-Node handlers and non-js targets', () => {
            var def = {
                execution: { PowerShell3: { target: 'x.ps1' }, Node16: { target: 'main.exe' } }
            };
            assert.strictEqual(JSON.stringify(minifyUtil.collectNodeExecutionTargets(def, 'T')), '[]');
        });

        it('throws a hard error on an unsupported Node handler before any bundling', () => {
            var def = { execution: { Node22: { target: 'x.js' } } };
            assert.throws(
                () => minifyUtil.collectNodeExecutionTargets(def, 'BadTask'),
                /unsupported Node handler/);
        });
    });

    describe('duplicate-package detection (B4)', function () {
        var os = require('os');
        var anyFs: any = fs;

        it('has no global default allowlist (duplicate tolerance is per-task opt-in)', () => {
            assert.strictEqual(JSON.stringify(minifyUtil.DEFAULT_DUPLICATE_ALLOWLIST), '[]');
        });

        it('flags a first-party package resolved from two node_modules roots', () => {
            // Simulates a task copy and a Common-module nested copy of task-lib.
            var metafile = {
                inputs: {
                    'node_modules/azure-pipelines-task-lib/task.js': {},
                    'node_modules/common/node_modules/azure-pipelines-task-lib/task.js': {},
                    'src/main.js': {}
                }
            };
            var dupes = minifyUtil.findDuplicatePackages(metafile);
            assert.strictEqual(dupes.length, 1);
            assert.strictEqual(dupes[0].package, 'azure-pipelines-task-lib');
            assert.strictEqual(dupes[0].roots.length, 2);
        });

        it('does not flag a package resolved from a single root', () => {
            var metafile = {
                inputs: {
                    'node_modules/azure-pipelines-task-lib/task.js': {},
                    'node_modules/azure-pipelines-task-lib/internal.js': {}
                }
            };
            assert.strictEqual(minifyUtil.findDuplicatePackages(metafile).length, 0);
        });

        it('reads the resolved version at a node_modules root for actionable diagnostics', () => {
            var tmp = anyFs.mkdtempSync(path.join(os.tmpdir(), 'minify-ver-'));
            try {
                var pkgDir = path.join(tmp, 'node_modules', 'azure-pipelines-task-lib');
                anyFs.mkdirSync(pkgDir, { recursive: true });
                anyFs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '4.17.3' }));
                assert.strictEqual(
                    minifyUtil.readRootVersion(tmp, 'node_modules/azure-pipelines-task-lib'),
                    '4.17.3');
            } finally {
                anyFs.rmSync(tmp, { recursive: true, force: true });
            }
        });

        it('returns "unknown" when a root has no readable package.json', () => {
            var tmp = anyFs.mkdtempSync(path.join(os.tmpdir(), 'minify-ver-'));
            try {
                assert.strictEqual(minifyUtil.readRootVersion(tmp, 'node_modules/missing'), 'unknown');
            } finally {
                anyFs.rmSync(tmp, { recursive: true, force: true });
            }
        });
    });

    describe('source-map semantics (C2 + B2)', function () {
        var os = require('os');
        var anyFs: any = fs;
        var Module = require('module');

        it('ships an ES5-only banner shim (banners are inserted untranspiled)', () => {
            var shim = minifyUtil.SOURCEMAP_SHIM;
            assert.ok(typeof shim === 'string' && shim.length > 0);
            // No ES6+ constructs that would break on the entry runtime (e.g. Node10).
            assert.ok(!/=>/.test(shim), 'shim must not use arrow functions');
            assert.ok(!/\bconst\b|\blet\b/.test(shim), 'shim must not use const/let');
            assert.ok(!/\?\./.test(shim), 'shim must not use optional chaining');
            assert.ok(!/\?\?/.test(shim), 'shim must not use nullish coalescing');
        });

        it('guards on module.SourceMap so it cleanly no-ops on Node <13', () => {
            assert.ok(/if\(!Module\.SourceMap\)return/.test(minifyUtil.SOURCEMAP_SHIM));
        });

        it('does not resurrect the setSourceMapsEnabled bootstrap (require.main parity)', () => {
            // Option B replaces the entry in place; there must be no require()-child
            // bootstrap anywhere in the build facility, or require.main === module breaks.
            var srcFile = path.join(__dirname, '..', '..', 'minify-util.js');
            var src = anyFs.readFileSync(srcFile, 'utf8');
            assert.ok(src.indexOf('setSourceMapsEnabled') === -1,
                'setSourceMapsEnabled bootstrap must be gone');
            assert.ok(src.indexOf('.bundle.js') === -1,
                'the .bundle.js indirection must be gone (bundle replaces the entry in place)');
        });

        it('maps a bundle stack frame back to the original source at runtime, no flag', () => {
            if (!Module.SourceMap) { return; } // Node <13 has no built-in decoder
            var anyError: any = Error;
            var tmp = anyFs.mkdtempSync(path.join(os.tmpdir(), 'minify-sm-'));
            var savedPrepare = anyError.prepareStackTrace;
            try {
                var bundle = path.join(tmp, 'bundle.js');
                anyFs.writeFileSync(bundle, '// bundled\n');
                // Minimal single-segment map: generated (0,0) -> orig.ts (0,0).
                anyFs.writeFileSync(bundle + '.map', JSON.stringify({
                    version: 3, sources: ['orig.ts'], sourcesContent: ['throw new Error()'],
                    names: [], mappings: 'AAAA'
                }));
                // Install the shipped shim exactly as it ships (eval the banner IIFE).
                eval(minifyUtil.SOURCEMAP_SHIM);
                var frame = {
                    getFileName: function () { return bundle; },
                    getLineNumber: function () { return 1; },   // 1-based; shim subtracts 1
                    getColumnNumber: function () { return 1; },
                    getFunctionName: function () { return 'run'; },
                    toString: function () { return 'run (' + bundle + ':1:1)'; }
                };
                var out = anyError.prepareStackTrace(new Error('boom'), [frame]);
                assert.ok(/orig\.ts:1:1/.test(out), 'frame should map to orig.ts:1:1, got: ' + out);
                assert.ok(/at run /.test(out), 'mapped frame should keep the function name');
            } finally {
                anyError.prepareStackTrace = savedPrepare;
                anyFs.rmSync(tmp, { recursive: true, force: true });
            }
        });

        it('falls back to the original frame text when no map is present (no throw)', () => {
            if (!Module.SourceMap) { return; }
            var anyError: any = Error;
            var savedPrepare = anyError.prepareStackTrace;
            try {
                eval(minifyUtil.SOURCEMAP_SHIM);
                var frame = {
                    getFileName: function () { return '/no/such/file.js'; },
                    getLineNumber: function () { return 5; },
                    getColumnNumber: function () { return 7; },
                    getFunctionName: function () { return 'noMap'; },
                    toString: function () { return 'noMap (/no/such/file.js:5:7)'; }
                };
                var out = anyError.prepareStackTrace(new Error('x'), [frame]);
                assert.ok(/noMap \(\/no\/such\/file\.js:5:7\)/.test(out));
            } finally {
                anyError.prepareStackTrace = savedPrepare;
            }
        });
    });

    describe('inlineSourceMap conflict guard (C4)', function () {
        it('flags an effective tsconfig that enables inlineSourceMap', () => {
            assert.strictEqual(
                minifyUtil.tsConfigHasInlineSourceMap({ compilerOptions: { inlineSourceMap: true } }),
                true);
        });

        it('does not flag inlineSourceMap: false or an unset option', () => {
            assert.strictEqual(
                minifyUtil.tsConfigHasInlineSourceMap({ compilerOptions: { inlineSourceMap: false } }),
                false);
            assert.strictEqual(
                minifyUtil.tsConfigHasInlineSourceMap({ compilerOptions: { sourceMap: true } }),
                false);
        });

        it('does not flag inlineSources (only inlineSourceMap conflicts)', () => {
            assert.strictEqual(
                minifyUtil.tsConfigHasInlineSourceMap({ compilerOptions: { sourceMap: true, inlineSources: true } }),
                false);
        });

        it('is safe on null / missing compilerOptions (no tsconfig to inspect)', () => {
            assert.strictEqual(minifyUtil.tsConfigHasInlineSourceMap(null), false);
            assert.strictEqual(minifyUtil.tsConfigHasInlineSourceMap({}), false);
        });
    });

    describe('missing declared entry (B3)', function () {
        var os = require('os');
        var anyFs: any = fs;

        it('returns declared entries that are absent from the build output', () => {
            var tmp = anyFs.mkdtempSync(path.join(os.tmpdir(), 'minify-miss-'));
            try {
                anyFs.writeFileSync(path.join(tmp, 'present.js'), '// built\n');
                var entries = [{ file: 'present.js', nodeMajor: 10 }, { file: 'gone.js', nodeMajor: 16 }];
                assert.strictEqual(
                    JSON.stringify(minifyUtil.findMissingEntries(tmp, entries)),
                    JSON.stringify(['gone.js']));
            } finally {
                anyFs.rmSync(tmp, { recursive: true, force: true });
            }
        });

        it('returns every missing entry, not just the first', () => {
            var tmp = anyFs.mkdtempSync(path.join(os.tmpdir(), 'minify-miss-'));
            try {
                var entries = [{ file: 'a.js', nodeMajor: 10 }, { file: 'b.js', nodeMajor: 10 }];
                assert.strictEqual(
                    JSON.stringify(minifyUtil.findMissingEntries(tmp, entries)),
                    JSON.stringify(['a.js', 'b.js']));
            } finally {
                anyFs.rmSync(tmp, { recursive: true, force: true });
            }
        });

        it('resolves entries in nested paths and returns none when all exist', () => {
            var tmp = anyFs.mkdtempSync(path.join(os.tmpdir(), 'minify-miss-'));
            try {
                anyFs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
                anyFs.writeFileSync(path.join(tmp, 'src', 'helm.js'), '// built\n');
                var entries = [{ file: 'src/helm.js', nodeMajor: 10 }];
                assert.strictEqual(JSON.stringify(minifyUtil.findMissingEntries(tmp, entries)), '[]');
            } finally {
                anyFs.rmSync(tmp, { recursive: true, force: true });
            }
        });
    });
});
