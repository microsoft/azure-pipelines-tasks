//
// Minify (esbuild bundling) build helpers, extracted from make-util.js.
//
// This module owns the full opt-in minified-task build surface:
//   - the tsc-side inlineSourceMap guard (readEffectiveTsConfig /
//     tsConfigHasInlineSourceMap / assertMinifySourceMapCompatible), run before tsc;
//   - the post-tsc esbuild bundling pipeline: duplicate-package detection, Node
//     execution-target enumeration, the runtime source-map shim, per-entry bundling,
//     the duplicate-package policy, and the top-level minifyNodeTask orchestration.
//
// It depends on make-util.js for the shared shell helpers (test/rm/mkdir/fail/run/
// fileToJson). make-util.js does NOT top-level require this module, so the dependency
// is one-directional; make-util's buildNodeTask lazy-requires this module for the
// inlineSourceMap guard, which keeps that one back-reference cycle-free.
//

const fs = require('fs');
const path = require('path');
const makeUtil = require('./make-util');
const test = makeUtil.test;
const rm = makeUtil.rm;
const mkdir = makeUtil.mkdir;
const fail = makeUtil.fail;
const run = makeUtil.run;
const fileToJson = makeUtil.fileToJson;

// Parse a task's EFFECTIVE TypeScript config (with any `extends` chain flattened)
// by shelling out to `tsc --showConfig`. Returns the parsed object, or null when
// there is no tsconfig.json to inspect or the output cannot be parsed.
var readEffectiveTsConfig = function (taskPath, overrideTscPath) {
    var tsconfigPath = path.join(taskPath, 'tsconfig.json');
    if (!test('-f', tsconfigPath)) {
        return null;
    }
    var tscCmd = overrideTscPath
        ? 'node "' + path.join(overrideTscPath, 'bin', 'tsc') + '"'
        : 'tsc';
    var raw;
    try {
        // --showConfig prints the fully-resolved tsconfig as JSON and compiles nothing.
        raw = run(tscCmd + ' -p "' + tsconfigPath + '" --showConfig', false, true, true);
    } catch (err) {
        // Don't block the build over a diagnostic probe; the real tsc run that
        // follows surfaces any genuine tsconfig error.
        console.log('> minify: tsc --showConfig failed for ' + taskPath + '; skipping inlineSourceMap check');
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.log('> minify: could not parse tsc --showConfig output for ' + taskPath + '; skipping inlineSourceMap check');
        return null;
    }
};
exports.readEffectiveTsConfig = readEffectiveTsConfig;

// Pure predicate: does the (effective) tsconfig turn on inlineSourceMap?
var tsConfigHasInlineSourceMap = function (effectiveConfig) {
    return !!(effectiveConfig && effectiveConfig.compilerOptions &&
        effectiveConfig.compilerOptions.inlineSourceMap === true);
};
exports.tsConfigHasInlineSourceMap = tsConfigHasInlineSourceMap;

// Guard used only in the minify + sourceMap build. Minify source maps chain an
// EXTERNAL tsc .js.map into the bundle map; if a task's effective tsconfig enables
// inlineSourceMap, tsc rejects the added --sourceMap flag with TS5053 (or would
// embed a data-URI map that collides with esbuild's external bundle map). Fail
// early with an actionable message instead of surfacing the cryptic tsc error.
var assertMinifySourceMapCompatible = function (taskPath, overrideTscPath) {
    if (tsConfigHasInlineSourceMap(readEffectiveTsConfig(taskPath, overrideTscPath))) {
        fail('Task "' + path.basename(taskPath) + '" enables "inlineSourceMap" in its effective ' +
            'tsconfig, which conflicts with the minify "sourceMap" option (minify needs an external ' +
            '.js.map to chain into the bundle map). Remove "inlineSourceMap" from the task tsconfig ' +
            '(use "sourceMap"), or disable the minify "sourceMap" option for this task.');
    }
};
exports.assertMinifySourceMapCompatible = assertMinifySourceMapCompatible;

//
// Given an esbuild metafile, return the set of npm packages that were pulled in
// from more than one physical node_modules root. Those are the packages at risk
// of module-level state splitting when bundled (e.g. azure-pipelines-task-lib's
// secret _vault). Returns an array of { package, roots }.
//
var findDuplicatePackages = function (metafile) {
    var byPkg = {};
    Object.keys(metafile.inputs || {}).forEach(function (input) {
        // normalize windows separators
        var norm = input.replace(/\\/g, '/');
        var idx = norm.lastIndexOf('node_modules/');
        if (idx === -1) {
            return; // task's own source, not a dependency
        }
        var rest = norm.slice(idx + 'node_modules/'.length);
        // capture scoped (@scope/name) or plain (name) package id
        var m = rest.match(/^((?:@[^/]+\/)?[^/]+)/);
        if (!m) {
            return;
        }
        var pkg = m[1];
        var root = norm.slice(0, idx + 'node_modules/'.length) + pkg;
        (byPkg[pkg] = byPkg[pkg] || new Set()).add(root);
    });

    var dupes = [];
    Object.keys(byPkg).forEach(function (pkg) {
        if (byPkg[pkg].size > 1) {
            dupes.push({ package: pkg, roots: Array.from(byPkg[pkg]) });
        }
    });
    return dupes;
}
exports.findDuplicatePackages = findDuplicatePackages;

// Duplicate tolerance is opt-in PER TASK only - there is no global allowlist, so
// even packages commonly assumed stateless (e.g. uuid) must be allowlisted
// explicitly by the task that bundles two copies. This forces task owners to
// consciously converge versions (by aligning direct dependencies) before opting
// in, rather than inheriting a silent global exemption. Extend per-task via
// make.json: "minify": { "allowDuplicates": [...] }.
var DEFAULT_DUPLICATE_ALLOWLIST = [];
exports.DEFAULT_DUPLICATE_ALLOWLIST = DEFAULT_DUPLICATE_ALLOWLIST;

// Every execution phase the agent can launch a Node entry point from. A task can
// declare a Node handler in any of these (e.g. HelmDeploy runs a cleanup script
// via postjobexecution), and each such entry must be bundled - otherwise deleting
// node_modules after minify leaves that phase's script unable to resolve its deps.
var NODE_EXECUTION_PHASES = ['execution', 'prejobexecution', 'postjobexecution'];

// Supported Node handler majors. esbuild must transpile each bundle down to the
// runtime the agent will actually launch it with; without a target it defaults to
// esnext and can emit syntax (optional chaining, nullish coalescing) that older
// runtimes like Node 10 cannot parse.
var NODE_HANDLER_MAJORS = { node10: 10, node16: 16, node20: 20, node24: 24 };

// Map a task.json Node handler name (e.g. 'Node10', 'Node20_1') to its runtime
// major version, or null when the handler is not a recognized Node runtime. The
// trailing "_N" revision suffix (Node20_1) does not change the language target,
// so it is stripped before lookup.
var nodeHandlerToMajor = function (handler) {
    var key = String(handler).toLowerCase().replace(/_\d+$/, '');
    return Object.prototype.hasOwnProperty.call(NODE_HANDLER_MAJORS, key)
        ? NODE_HANDLER_MAJORS[key]
        : null;
};
exports.nodeHandlerToMajor = nodeHandlerToMajor;

// Return the Node entry points a task declares across ALL execution phases, each
// paired with the lowest Node runtime major that any handler uses to invoke it.
// That lowest major is what esbuild must target so a single .js referenced by two
// runtimes (e.g. Node10 + Node16) stays parseable on the oldest one.
//   -> [{ file: 'cleanup.js', nodeMajor: 10 }, ...]
// Throws on an unrecognized Node* handler so an unsupported/typo'd runtime is a
// hard build error rather than a silently mis-targeted (or unbundled) entry.
var collectNodeExecutionTargets = function (taskDef, taskName) {
    var byFile = new Map(); // entry .js -> lowest Node major targeting it
    NODE_EXECUTION_PHASES.forEach(function (phase) {
        var handlers = (taskDef && taskDef[phase]) || {};
        Object.keys(handlers).forEach(function (handler) {
            if (!/^Node/i.test(handler)) {
                return;
            }
            var target = handlers[handler] && handlers[handler].target;
            if (!target || !/\.js$/i.test(target)) {
                return;
            }
            var major = nodeHandlerToMajor(handler);
            if (major === null) {
                throw new Error('minify: unsupported Node handler "' + handler + '" in ' +
                    (taskName || 'task') + '.' + phase + '.target=' + target +
                    '. Supported handlers: Node10, Node16, Node20, Node20_1, Node24.');
            }
            var existing = byFile.get(target);
            byFile.set(target, existing === undefined ? major : Math.min(existing, major));
        });
    });
    return Array.from(byFile.entries()).map(function (kv) {
        return { file: kv[0], nodeMajor: kv[1] };
    });
};
exports.collectNodeExecutionTargets = collectNodeExecutionTargets;

// Read the installed version of a package at a given node_modules root (relative
// to outDir) so duplicate diagnostics can tell the task owner exactly which
// version each copy resolved to, and therefore which direct dependency to align.
var readRootVersion = function (outDir, root) {
    try {
        var pj = path.join(outDir, root, 'package.json');
        if (fs.existsSync(pj)) {
            var v = JSON.parse(fs.readFileSync(pj, 'utf8')).version;
            if (v) return v;
        }
    } catch (e) { /* fall through */ }
    return 'unknown';
};
exports.readRootVersion = readRootVersion;

// Return the declared Node execution targets that are missing from the build
// output. A declared handler target that never got built (task.json typo, case
// mismatch, tsc exclude, wrong path) must FAIL the build: minify deletes
// node_modules, so publishing a task whose entry is absent (or left un-bundled and
// now dependency-less) yields a task that only breaks at runtime in the agent.
var findMissingEntries = function (outDir, entries) {
    return entries
        .filter(function (e) { return !test('-f', path.join(outDir, e.file)); })
        .map(function (e) { return e.file; });
};
exports.findMissingEntries = findMissingEntries;

// ES5, dependency-free source-map shim, prepended (as an esbuild banner) to each
// bundle ONLY in sourcemap mode. It installs a lazy Error.prepareStackTrace hook
// that rewrites bundled stack frames back to the original .ts using the shipped
// <file>.map. Being lazy (it maps at .stack-access time, not at compile time) it
// can map the entry's own frames while the entry stays the directly-launched main
// module - so require.main === module is preserved (unlike a require() bootstrap).
// On Node <13 (e.g. Node10) module.SourceMap is absent, so it cleanly no-ops and
// frames keep their keepNames function names (still offline-decodable via the map).
// NOTE: banners are inserted verbatim (NOT transpiled by 'target'), so this must
// stay ES5 - no const/let, arrow functions, or optional chaining.
var SOURCEMAP_SHIM =
    '(function(){try{var Module=require("module"),fs=require("fs");' +
    'if(!Module.SourceMap)return;var cache={};' +
    'var getMap=function(file){if(file in cache)return cache[file];var m=null;' +
    'try{m=new Module.SourceMap(JSON.parse(fs.readFileSync(file+".map","utf8")))}catch(e){}' +
    'return cache[file]=m};' +
    'Error.prepareStackTrace=function(err,frames){var lines=[err.toString()];' +
    'for(var i=0;i<frames.length;i++){var f=frames[i],out="    at "+f.toString();' +
    'try{var file=f.getFileName(),sm=file&&getMap(file);' +
    'if(sm){var e=sm.findEntry((f.getLineNumber()||1)-1,(f.getColumnNumber()||1)-1);' +
    'if(e&&e.originalSource){var name=f.getFunctionName()||"<anonymous>";' +
    'out="    at "+name+" ("+e.originalSource+":"+(e.originalLine+1)+":"+(e.originalColumn+1)+")"}}}' +
    'catch(_){}lines.push(out)}return lines.join("\\n")}}catch(e){}})();\n';
exports.SOURCEMAP_SHIM = SOURCEMAP_SHIM;

// Bundle a single entry point into a staging file with esbuild and return its
// metafile so the caller can validate duplicate packages before publishing.
var bundleEntry = async function (esbuild, opts) {
    var buildOptions = {
        entryPoints: [opts.entryPath],
        bundle: true,
        minify: true,
        platform: 'node',
        format: 'cjs',
        target: opts.nodeTarget,    // e.g. 'node10' - transpile down to the entry's oldest declared runtime
        keepNames: true,        // preserve fn/class names in stack frames even without a map
        legalComments: 'eof',   // retain third-party license/legal comments (node_modules, incl. LICENSE files, is deleted after bundling)
        metafile: true,
        absWorkingDir: opts.outDir,
        outfile: opts.tmpOut,
        logLevel: 'warning',
        // A source map is only emitted when requested; it chains the tsc-emitted
        // maps so task-code frames resolve back to the original .ts (dependency
        // frames resolve to their original node_modules .js). sourcesContent embeds
        // every referenced source in the map so it survives node_modules deletion. In
        // sourcemap mode a small ES5 shim is prepended (banner) that maps stack frames
        // at runtime without a separate bootstrap module, so require.main is preserved.
        sourcemap: opts.withSourceMap ? true : false,
        sourcesContent: opts.withSourceMap ? true : false,
        banner: opts.withSourceMap ? { js: SOURCEMAP_SHIM } : undefined
    };
    var result = await esbuild.build(buildOptions);
    return result.metafile;
};

// Merge the duplicate packages reported for one bundle's metafile into a shared
// package -> Set<root> map, so the final diagnostic lists every node_modules root
// a package resolved from across all entry points.
var mergeDuplicateRoots = function (map, metafile) {
    findDuplicatePackages(metafile).forEach(function (dupe) {
        var roots = map.get(dupe.package) || new Set();
        dupe.roots.forEach(function (root) { roots.add(root); });
        map.set(dupe.package, roots);
    });
};

// Apply the duplicate-package policy. Warns about stale allowlist entries and
// allowlisted (assumed-stateless) duplicates, and - unless failOnDuplicates is
// false - throws on any non-allowlisted duplicate. Thrown (not fail()/exit) so
// the per-task build loop records the failure and continues to the summary.
var enforceDuplicatePolicy = function (duplicates, opts) {
    var outDir = opts.outDir;
    var allowlist = opts.allowlist;         // Set<string>
    var perTaskAllow = opts.perTaskAllow;   // string[]
    var failOnDuplicates = opts.failOnDuplicates;

    // Warn about per-task allowlist entries that aren't actually duplicated
    // (typos / stale entries that give a false sense of protection).
    if (perTaskAllow.length) {
        var duplicateNames = new Set(duplicates.map(function (d) { return d.package; }));
        var staleAllow = perTaskAllow.filter(function (p) { return !duplicateNames.has(p); });
        if (staleAllow.length) {
            console.warn('> minify: NOTE - ' + path.basename(outDir) + ' allowlists package(s) that are not ' +
                'duplicated in this build (stale or misspelled allowDuplicates entries): ' + staleAllow.join(', ') +
                '. Remove them from make.json "minify": { "allowDuplicates": [...] }.');
        }
    }

    if (!duplicates.length) {
        return;
    }

    var allowedDuplicates = duplicates.filter(function (d) { return allowlist.has(d.package); });
    var blockingDuplicates = duplicates.filter(function (d) { return !allowlist.has(d.package); });
    var printDuplicates = function (list, log) {
        list.forEach(function (dupe) {
            log('    ' + dupe.package);
            dupe.roots.forEach(function (root) {
                log('      - ' + root + ' (' + readRootVersion(outDir, root) + ')');
            });
        });
    };

    // Allowlisted packages are assumed stateless: report but don't block.
    if (allowedDuplicates.length) {
        console.warn('> minify: NOTE - allowlisted packages bundled from multiple node_modules roots (assumed stateless):');
        printDuplicates(allowedDuplicates, console.warn);
    }

    if (!blockingDuplicates.length) {
        return;
    }

    var header = 'minify: ' + path.basename(outDir) +
        ' bundles the following package(s) from more than one node_modules root, ' +
        'which can split module-level state (e.g. secrets in azure-pipelines-task-lib):';
    if (!failOnDuplicates) {
        console.warn('> minify: WARNING (--allow-duplicates) - ' + header);
        printDuplicates(blockingDuplicates, console.warn);
        return;
    }
    console.error('> ' + header);
    printDuplicates(blockingDuplicates, console.error);
    console.error('> Fix by aligning versions so each package resolves to a single copy: update this ' +
        'task\'s DIRECT dependencies in package.json so the indirect copies converge to one version - ' +
        'first-party azure-pipelines-* packages (task-lib, tool-lib, node-api, ...) are the usual ' +
        'culprits - then reinstall (npm install && npm dedupe) and rebuild. Only if the package is ' +
        'genuinely stateless, opt in per task via make.json ' +
        '"minify": { "allowDuplicates": ["' + blockingDuplicates[0].package + '"] }.');
    throw new Error(header + ' ' + blockingDuplicates.map(function (d) { return d.package; }).join(', '));
};

// Remove intermediate tsc *.js.map files left in outDir, keeping only the final
// bundle maps (whose absolute paths are in keepMapAbsPaths). The stray maps'
// content is already inlined into the bundle maps.
var removeIntermediateSourceMaps = function (outDir, keepMapAbsPaths) {
    if (!fs.existsSync(outDir)) {
        return;
    }
    var walk = function (dir) {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(function (dirent) {
            var full = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                walk(full);
            } else if (/\.js\.map$/i.test(dirent.name) && !keepMapAbsPaths.has(full)) {
                rm('-f', full);
            }
        });
    };
    walk(outDir);
};

//
// Minify a compiled Node task: bundle every Node execution entry point (and its
// dependencies) into a single minified file using esbuild, then drop the now
// inlined node_modules folder.
//
// options:
//   sourceMap        - when true, chain the tsc-emitted maps so task-code stack
//                      frames resolve back to the original .ts (dependency frames
//                      resolve to their original node_modules .js; sourcesContent
//                      embeds every source so it survives node_modules deletion).
//                      When false, no map is emitted (smallest output); keepNames
//                      still preserves fn/class names in stack frames.
//   allowDuplicates  - per-task list of packages exempt from the duplicate check.
//   failOnDuplicates - when false, a non-allowlisted duplicate warns instead of
//                      failing (the --allow-duplicates escape hatch).
//
// The whole task is built and validated into a staging dir first; outDir is only
// mutated once every entry bundles and the duplicate-package policy passes, so a
// mid-build failure never leaves the task partially rewritten.
//
// Returns { entries, duplicates } for reporting. Async because esbuild plugins
// (needed for dedupe) are only supported by the async build API.
//
var minifyNodeTask = async function (taskPath, outDir, options) {
    options = options || {};
    var withSourceMap = !!options.sourceMap;
    var perTaskAllow = Array.isArray(options.allowDuplicates) ? options.allowDuplicates : [];
    var failOnDuplicates = options.failOnDuplicates !== false; // default: fail
    var duplicateAllowlist = new Set(DEFAULT_DUPLICATE_ALLOWLIST.concat(perTaskAllow));

    var esbuild;
    try {
        esbuild = require('esbuild');
    } catch (err) {
        fail('--minify requires the "esbuild" package. Run "npm install" at the repo root. ' + err.message);
    }

    // task.json in the build output tells us which files the agent executes.
    var taskJsonPath = path.join(outDir, 'task.json');
    if (!test('-f', taskJsonPath)) {
        taskJsonPath = path.join(taskPath, 'task.json');
    }
    if (!test('-f', taskJsonPath)) {
        console.log('> minify: no task.json found, skipping ' + outDir);
        return { entries: [], duplicates: [] };
    }

    var entries = collectNodeExecutionTargets(fileToJson(taskJsonPath), path.basename(outDir));
    if (entries.length === 0) {
        console.log('> minify: no Node execution targets found, skipping ' + outDir);
        return { entries: [], duplicates: [] };
    }

    // B3: a declared Node target that is missing from the build output must be a
    // HARD build error - never skip it and then delete node_modules, which would
    // publish a task that only fails at runtime in the agent. Check before creating
    // the staging dir or touching outDir, so a failure leaves the output intact.
    var missingEntries = findMissingEntries(outDir, entries);
    if (missingEntries.length > 0) {
        throw new Error('minify: task ' + path.basename(outDir) +
            ' declares Node execution target(s) missing from the build output: ' +
            missingEntries.join(', ') + '. Every declared entry must be built before minify ' +
            'removes node_modules; fix the task.json handler "target" path(s) or the tsc output.');
    }

    // esbuild refuses to overwrite an input file, so every bundle is first written
    // to a unique staging dir. It lives inside outDir so renameSync into place stays
    // on one volume, and it is always removed in finally. Nothing in outDir is
    // touched until all entries build and pass the duplicate-package policy.
    var stagingDir = fs.mkdtempSync(path.join(outDir, '.minify-'));
    var duplicates = [];
    var bundleMapAbsPaths = new Set();
    try {
        var duplicateRoots = new Map();
        var staged = [];

        // Phase 1: build + validate every entry into the staging dir.
        for (const entry of entries) {
            var entryPath = path.join(outDir, entry.file);

            // The bundle always replaces the entry in place (even in sourcemap mode),
            // so the entry stays the directly-launched main module and
            // require.main === module keeps working. Runtime .ts mapping comes from
            // the shipped <entry>.js.map plus the ES5 banner shim, not a bootstrap.
            var outName = entry.file;
            var tmpOut = path.join(stagingDir, outName);
            mkdir('-p', path.dirname(tmpOut));

            console.log('> minifying ' + entry.file + ' (target node' + entry.nodeMajor + ')');
            var metafile = await bundleEntry(esbuild, {
                entryPath: entryPath,
                outDir: outDir,
                tmpOut: tmpOut,
                withSourceMap: withSourceMap,
                nodeTarget: 'node' + entry.nodeMajor
            });
            mergeDuplicateRoots(duplicateRoots, metafile);

            staged.push({
                entryPath: entryPath,
                outName: outName,
                tmpOut: tmpOut,
                hasMap: fs.existsSync(tmpOut + '.map')
            });
        }

        duplicates = Array.from(duplicateRoots.entries()).map(function (kv) {
            return { package: kv[0], roots: Array.from(kv[1]) };
        });

        // Enforce the policy BEFORE touching outDir: a blocking duplicate throws
        // here, the staging dir is discarded (finally), and the original output is
        // left intact for the build loop to report as a failed task.
        enforceDuplicatePolicy(duplicates, {
            outDir: outDir,
            allowlist: duplicateAllowlist,
            perTaskAllow: perTaskAllow,
            failOnDuplicates: failOnDuplicates
        });

        // Phase 2: publish. Everything built and passed, so move bundles into place.
        // The bundle replaces the entry in place; in sourcemap mode its <entry>.js.map
        // ships alongside and the banner shim maps frames at runtime. No bootstrap is
        // written, so require.main === module is preserved in both modes.
        staged.forEach(function (s) {
            var outPath = path.join(outDir, s.outName);
            rm('-f', outPath);
            fs.renameSync(s.tmpOut, outPath);
            if (s.hasMap) {
                rm('-f', outPath + '.map');
                fs.renameSync(s.tmpOut + '.map', outPath + '.map');
                bundleMapAbsPaths.add(outPath + '.map');
            }
        });
    } finally {
        rm('-rf', stagingDir);
    }

    // Dependencies are now inlined into the bundle(s); remove node_modules.
    var nodeModulesPath = path.join(outDir, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        console.log('> minify: removing inlined node_modules');
        rm('-rf', nodeModulesPath);
    }

    removeIntermediateSourceMaps(outDir, bundleMapAbsPaths);

    return { entries: entries.map(function (e) { return e.file; }), duplicates: duplicates };
}
exports.minifyNodeTask = minifyNodeTask;
