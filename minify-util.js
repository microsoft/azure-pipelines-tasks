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
const Module = require('module');
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

// Only top-level npm package names are accepted in make.json. Subpath requests
// such as "pkg/internal" would make it ambiguous which installed package root and
// dependency closure must be retained.
var normalizeExternalPackages = function (external) {
    if (external === undefined) {
        return [];
    }
    if (!Array.isArray(external)) {
        throw new Error('minify: "external" must be an array of top-level npm package names.');
    }

    var seen = new Set();
    return external.map(function (value) {
        if (typeof value !== 'string') {
            throw new Error('minify: every "external" entry must be a top-level npm package name.');
        }
        var name = value.trim();
        var valid = name.length > 0 &&
            !name.startsWith('.') &&
            !/\s|\\/.test(name) &&
            (/^[^/@][^/]*$/.test(name) || /^@[^/]+\/[^/]+$/.test(name));
        if (!valid) {
            throw new Error('minify: invalid external package "' + value +
                '". Use a top-level npm package name such as "package" or "@scope/package", not a subpath.');
        }
        return name;
    }).filter(function (name) {
        if (seen.has(name)) {
            return false;
        }
        seen.add(name);
        return true;
    });
};
exports.normalizeExternalPackages = normalizeExternalPackages;

var pathKey = function (value) {
    var resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

var packagePath = function (nodeModulesPath, packageName) {
    return path.join.apply(path, [nodeModulesPath].concat(packageName.split('/')));
};

// Visit every physical package root in an installed node_modules tree. This is
// used to reject an external package name that exists at multiple roots: esbuild
// externalization is name-based, so moving all requires to the bundle root would
// otherwise silently change which version nested importers load.
var walkInstalledPackages = function (nodeModulesPath, visitor) {
    if (!fs.existsSync(nodeModulesPath)) {
        return;
    }
    if (fs.lstatSync(nodeModulesPath).isSymbolicLink()) {
        return;
    }
    fs.readdirSync(nodeModulesPath, { withFileTypes: true }).forEach(function (entry) {
        if (entry.name === '.bin' || entry.name.startsWith('.')) {
            return;
        }
        var entryPath = path.join(nodeModulesPath, entry.name);
        if (entry.name.startsWith('@')) {
            if (!entry.isDirectory()) {
                return;
            }
            fs.readdirSync(entryPath, { withFileTypes: true }).forEach(function (scopedEntry) {
                if (!scopedEntry.isDirectory()) {
                    return;
                }
                var root = path.join(entryPath, scopedEntry.name);
                visitor(root);
                walkInstalledPackages(path.join(root, 'node_modules'), visitor);
            });
            return;
        }
        if (!entry.isDirectory()) {
            return;
        }
        visitor(entryPath);
        walkInstalledPackages(path.join(entryPath, 'node_modules'), visitor);
    });
};
exports.walkInstalledPackages = walkInstalledPackages;

var readPackageJson = function (packageRoot) {
    var packageJsonPath = path.join(packageRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('minify: retained package is missing package.json: ' + packageRoot);
    }
    try {
        return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (err) {
        throw new Error('minify: could not read retained package metadata at ' +
            packageJsonPath + ': ' + err.message);
    }
};

// Resolve a dependency using Node's search paths from the installed issuer, but
// locate its package directory directly instead of resolving "<dep>/package.json"
// (which modern package "exports" maps may intentionally hide).
var resolveInstalledDependency = function (issuerRoot, dependencyName) {
    var issuerRequire = Module.createRequire(path.join(issuerRoot, 'package.json'));
    var searchPaths = issuerRequire.resolve.paths(dependencyName) || [];
    for (const searchPath of searchPaths) {
        var candidate = packagePath(searchPath, dependencyName);
        if (fs.existsSync(path.join(candidate, 'package.json'))) {
            return candidate;
        }
    }
    return null;
};
exports.resolveInstalledDependency = resolveInstalledDependency;

var packageBinNames = function (packageJson) {
    if (typeof packageJson.bin === 'string') {
        return [String(packageJson.name || '').split('/').pop()].filter(Boolean);
    }
    if (packageJson.bin && typeof packageJson.bin === 'object') {
        return Object.keys(packageJson.bin);
    }
    return [];
};

var containingNodeModules = function (packageRoot) {
    var parent = path.dirname(packageRoot);
    return path.basename(parent).startsWith('@') ? path.dirname(parent) : parent;
};

var assertRetainablePackageRoot = function (packageRoot, nodeModulesPath) {
    var stat = fs.lstatSync(packageRoot);
    if (stat.isSymbolicLink()) {
        throw new Error('minify: external package closures do not support symlinked package roots: ' +
            packageRoot + '. Install the task with npm so packages are materialized before minifying.');
    }
    if (!stat.isDirectory()) {
        throw new Error('minify: retained package root is not a directory: ' + packageRoot);
    }

    var realNodeModules = fs.realpathSync(nodeModulesPath);
    var realPackageRoot = fs.realpathSync(packageRoot);
    var relative = path.relative(realNodeModules, realPackageRoot);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('minify: retained package resolves outside the task node_modules tree: ' + packageRoot);
    }

    var nestedNodeModules = path.join(packageRoot, 'node_modules');
    if (fs.existsSync(nestedNodeModules) && fs.lstatSync(nestedNodeModules).isSymbolicLink()) {
        throw new Error('minify: retained package has a symlinked node_modules directory: ' +
            nestedNodeModules + '. Materialize its dependency tree before minifying.');
    }
};

// Compute the exact installed runtime closure for configured top-level external
// packages. The existing physical layout is retained so nested dependency versions
// continue to resolve exactly as npm installed them.
var collectExternalPackageClosure = function (outDir, external) {
    var externalPackages = normalizeExternalPackages(external);
    var nodeModulesPath = path.join(outDir, 'node_modules');
    var retainedRoots = new Map(); // canonical absolute path -> { root, name, version }
    var retainedBins = new Map();  // canonical node_modules path -> Set<bin name>

    if (!externalPackages.length) {
        return {
            externalPackages: externalPackages,
            nodeModulesPath: nodeModulesPath,
            retainedRoots: retainedRoots,
            retainedBins: retainedBins
        };
    }
    if (!fs.existsSync(nodeModulesPath)) {
        throw new Error('minify: cannot retain external packages because node_modules is missing from ' + outDir);
    }

    var rootPackages = externalPackages.map(function (packageName) {
        var root = packagePath(nodeModulesPath, packageName);
        if (!fs.existsSync(path.join(root, 'package.json'))) {
            throw new Error('minify: external package "' + packageName +
                '" is not installed at the task node_modules root: ' + root);
        }
        assertRetainablePackageRoot(root, nodeModulesPath);
        return { name: packageName, root: root };
    });

    var installedByName = new Map();
    walkInstalledPackages(nodeModulesPath, function (root) {
        var packageJson = readPackageJson(root);
        if (!installedByName.has(packageJson.name)) {
            installedByName.set(packageJson.name, []);
        }
        installedByName.get(packageJson.name).push(root);
    });

    var queue = [];
    rootPackages.forEach(function (rootPackage) {
        var occurrences = installedByName.get(rootPackage.name) || [];
        if (occurrences.length !== 1) {
            throw new Error('minify: external package "' + rootPackage.name + '" is installed at ' +
                occurrences.length + ' physical roots. Align/dedupe it to one version before externalizing: ' +
                occurrences.join(', '));
        }
        queue.push(rootPackage.root);
    });

    while (queue.length) {
        var packageRoot = queue.shift();
        var key = pathKey(packageRoot);
        if (retainedRoots.has(key)) {
            continue;
        }
        assertRetainablePackageRoot(packageRoot, nodeModulesPath);

        var relative = path.relative(nodeModulesPath, packageRoot);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('minify: retained package resolved outside the task node_modules tree: ' + packageRoot);
        }

        var packageJson = readPackageJson(packageRoot);
        retainedRoots.set(key, {
            root: packageRoot,
            name: packageJson.name || relative.replace(/\\/g, '/'),
            version: packageJson.version || 'unknown'
        });

        var binNames = packageBinNames(packageJson);
        if (binNames.length) {
            var binKey = pathKey(containingNodeModules(packageRoot));
            var bins = retainedBins.get(binKey) || new Set();
            binNames.forEach(function (name) { bins.add(name); });
            retainedBins.set(binKey, bins);
        }

        var dependencies = Object.assign({}, packageJson.dependencies || {});
        var optional = new Set(Object.keys(packageJson.optionalDependencies || {}));
        Object.assign(dependencies, packageJson.optionalDependencies || {});

        var peerMeta = packageJson.peerDependenciesMeta || {};
        Object.keys(packageJson.peerDependencies || {}).forEach(function (name) {
            dependencies[name] = packageJson.peerDependencies[name];
            if (peerMeta[name] && peerMeta[name].optional) {
                optional.add(name);
            }
        });

        var bundled = packageJson.bundleDependencies || packageJson.bundledDependencies || [];
        if (Array.isArray(bundled)) {
            bundled.forEach(function (name) {
                if (!Object.prototype.hasOwnProperty.call(dependencies, name)) {
                    dependencies[name] = '*';
                }
            });
        }

        Object.keys(dependencies).forEach(function (dependencyName) {
            var dependencyRoot = resolveInstalledDependency(packageRoot, dependencyName);
            if (!dependencyRoot) {
                if (optional.has(dependencyName)) {
                    return;
                }
                throw new Error('minify: retained package ' + packageJson.name + '@' +
                    (packageJson.version || 'unknown') + ' requires "' + dependencyName +
                    '", but it is not installed/resolvable from ' + packageRoot);
            }
            queue.push(dependencyRoot);
        });
    }

    return {
        externalPackages: externalPackages,
        nodeModulesPath: nodeModulesPath,
        retainedRoots: retainedRoots,
        retainedBins: retainedBins
    };
};
exports.collectExternalPackageClosure = collectExternalPackageClosure;

// Return retained physical package roots that esbuild also inlined. Loading the
// same installed module once from disk and once from the bundle creates two
// module-level singletons, even though both copies came from one npm directory.
var findRetainedPackageOverlaps = function (metafile, outDir, retainedRoots) {
    var overlaps = new Map();
    Object.keys(metafile.inputs || {}).forEach(function (input) {
        var norm = input.replace(/\\/g, '/');
        var idx = norm.lastIndexOf('node_modules/');
        if (idx === -1) {
            return;
        }
        var rest = norm.slice(idx + 'node_modules/'.length);
        var match = rest.match(/^((?:@[^/]+\/)?[^/]+)/);
        if (!match) {
            return;
        }
        var rootText = norm.slice(0, idx + 'node_modules/'.length) + match[1];
        var absoluteRoot = path.isAbsolute(rootText)
            ? rootText
            : path.join(outDir, rootText);
        var retained = retainedRoots.get(pathKey(absoluteRoot));
        if (retained) {
            overlaps.set(retained.name, retained);
        }
    });
    return Array.from(overlaps.values());
};
exports.findRetainedPackageOverlaps = findRetainedPackageOverlaps;

var enforceRetainedPackagePolicy = function (overlaps, allowlist, outDir) {
    if (!overlaps.length) {
        return;
    }
    var allowed = overlaps.filter(function (pkg) { return allowlist.has(pkg.name); });
    var blocking = overlaps.filter(function (pkg) { return !allowlist.has(pkg.name); });
    if (allowed.length) {
        console.warn('> minify: NOTE - package(s) are both bundled and retained on disk ' +
            '(allowlisted as stateless): ' + allowed.map(function (pkg) {
                return pkg.name + '@' + pkg.version;
            }).join(', '));
    }
    if (!blocking.length) {
        return;
    }
    var names = blocking.map(function (pkg) { return pkg.name + '@' + pkg.version; });
    throw new Error('minify: ' + path.basename(outDir) +
        ' would load package(s) both from the bundle and retained node_modules, splitting module state: ' +
        names.join(', ') + '. Add the package as a top-level minify.external entry so every import stays ' +
        'external, align the dependency graph, or allowlist it only when it is genuinely stateless.');
};

var pruneBinDirectory = function (nodeModulesPath, retainedBins) {
    var binPath = path.join(nodeModulesPath, '.bin');
    if (!fs.existsSync(binPath)) {
        return;
    }
    var expected = retainedBins.get(pathKey(nodeModulesPath)) || new Set();
    var expectedEntries = new Set();
    expected.forEach(function (name) {
        expectedEntries.add(name);
        expectedEntries.add(name + '.cmd');
        expectedEntries.add(name + '.ps1');
    });
    fs.readdirSync(binPath).forEach(function (entry) {
        if (!expectedEntries.has(entry)) {
            fs.rmSync(path.join(binPath, entry), { recursive: true, force: true });
        }
    });
    if (fs.readdirSync(binPath).length === 0) {
        fs.rmSync(binPath, { recursive: true, force: true });
    }
};

// Delete every package not present in the retained closure while preserving each
// retained package at its original root. This keeps Node's nested-version lookup
// semantics and package-owned runtime assets intact.
var pruneNodeModules = function (nodeModulesPath, retainedRoots, retainedBins) {
    if (!fs.existsSync(nodeModulesPath)) {
        return;
    }

    fs.readdirSync(nodeModulesPath, { withFileTypes: true }).forEach(function (entry) {
        var entryPath = path.join(nodeModulesPath, entry.name);
        if (entry.name === '.bin') {
            return;
        }
        if (entry.name.startsWith('.')) {
            fs.rmSync(entryPath, { recursive: true, force: true });
            return;
        }

        if (entry.name.startsWith('@')) {
            if (!entry.isDirectory()) {
                fs.rmSync(entryPath, { recursive: true, force: true });
                return;
            }
            fs.readdirSync(entryPath, { withFileTypes: true }).forEach(function (scopedEntry) {
                var packageRoot = path.join(entryPath, scopedEntry.name);
                if (!retainedRoots.has(pathKey(packageRoot))) {
                    fs.rmSync(packageRoot, { recursive: true, force: true });
                    return;
                }
                pruneNodeModules(path.join(packageRoot, 'node_modules'), retainedRoots, retainedBins);
            });
            if (fs.readdirSync(entryPath).length === 0) {
                fs.rmSync(entryPath, { recursive: true, force: true });
            }
            return;
        }

        if (!retainedRoots.has(pathKey(entryPath))) {
            fs.rmSync(entryPath, { recursive: true, force: true });
            return;
        }
        pruneNodeModules(path.join(entryPath, 'node_modules'), retainedRoots, retainedBins);
    });

    pruneBinDirectory(nodeModulesPath, retainedBins);
};
exports.pruneNodeModules = pruneNodeModules;

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
        // External package names (and their subpaths) remain as runtime require()
        // calls. minifyNodeTask preserves their complete installed closures below.
        external: opts.externalPackages,
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
                if (dirent.name === 'node_modules') {
                    return; // retained external packages keep their complete published contents
                }
                walk(full);
            } else if (/\.js\.map$/i.test(dirent.name) && !keepMapAbsPaths.has(full)) {
                rm('-f', full);
            }
        });
    };
    walk(outDir);
};

// Publish an esbuild-emitted source map from the staging dir into outDir. esbuild
// computes each map's "sources" relative to the map file's own directory - which is
// the staging dir (one level below outDir) - so a plain move would leave every source
// carrying a spurious leading "../" (e.g. "../index.ts" instead of "index.ts"). That
// breaks external symbolication tools that resolve "sources" on disk. Rewrite each
// entry relative to the final location before writing the map into place. Runtime
// mapping is unaffected (it reads the embedded sourcesContent, not disk); this only
// corrects the on-disk paths. Left untouched if a sourceRoot is present (we never set
// one, so this is a defensive guard against double-rebasing).
var publishSourceMap = function (tmpMapPath, destMapPath, stagingDir, outDir) {
    var map = JSON.parse(fs.readFileSync(tmpMapPath, 'utf8'));
    if (Array.isArray(map.sources) && !map.sourceRoot) {
        map.sources = map.sources.map(function (src) {
            var abs = path.resolve(stagingDir, src);
            return path.relative(outDir, abs).split(path.sep).join('/');
        });
    }
    fs.writeFileSync(destMapPath, JSON.stringify(map));
    rm('-f', tmpMapPath);
};
exports.publishSourceMap = publishSourceMap;

// Atomically-as-possible publish a set of staged files/directories. Every existing
// destination is first renamed into the staging backup directory. If any later
// rename fails, all destinations processed so far are restored before rethrowing.
var replaceOutputPaths = function (replacements, backupDir) {
    fs.mkdirSync(backupDir, { recursive: true });
    var processed = [];
    try {
        replacements.forEach(function (replacement, index) {
            var backup = path.join(backupDir, String(index));
            var record = {
                destination: replacement.destination,
                backup: backup,
                hadDestination: fs.existsSync(replacement.destination)
            };
            if (record.hadDestination) {
                fs.renameSync(replacement.destination, backup);
            }
            processed.push(record);
            if (replacement.source) {
                fs.renameSync(replacement.source, replacement.destination);
            }
        });
    } catch (err) {
        processed.reverse().forEach(function (record) {
            fs.rmSync(record.destination, { recursive: true, force: true });
            if (record.hadDestination && fs.existsSync(record.backup)) {
                fs.renameSync(record.backup, record.destination);
            }
        });
        throw err;
    }
};
exports.replaceOutputPaths = replaceOutputPaths;

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
//   allowBundledAndRetained - stateless packages allowed to exist both in the
//                       bundle and an external package's retained closure.
//   external          - top-level package names left as runtime requires; their
//                       installed dependency closures are retained in node_modules.
//   failOnDuplicates - when false, a non-allowlisted duplicate warns instead of
//                      failing (the --allow-duplicates escape hatch).
//
// The whole task is built and validated into a staging dir first; outDir is only
// mutated once every entry bundles and the duplicate-package policy passes, so a
// mid-build failure never leaves the task partially rewritten.
//
// Returns { entries, duplicates, externalPackages } for reporting. Async because esbuild's build
// API (used here with metafile output for duplicate detection) is promise-based.
//
var minifyNodeTask = async function (taskPath, outDir, options) {
    options = options || {};
    var withSourceMap = !!options.sourceMap;
    var perTaskAllow = Array.isArray(options.allowDuplicates) ? options.allowDuplicates : [];
    var retainedOverlapAllowlist = new Set(normalizeExternalPackages(options.allowBundledAndRetained));
    var failOnDuplicates = options.failOnDuplicates !== false; // default: fail
    var duplicateAllowlist = new Set(DEFAULT_DUPLICATE_ALLOWLIST.concat(perTaskAllow));
    var externalPackages = normalizeExternalPackages(options.external);

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

    // Resolve the retained closure before esbuild changes any output. In addition
    // to validating the configured root packages, this proves every required
    // runtime dependency is installed and records the exact nested npm layout.
    var externalClosure = collectExternalPackageClosure(outDir, externalPackages);

    // esbuild refuses to overwrite an input file, so every bundle is first written
    // to a unique staging dir. It lives inside outDir so renameSync into place stays
    // on one volume, and it is always removed in finally. Nothing in outDir is
    // touched until all entries build and pass the duplicate-package policy.
    var stagingDir = fs.mkdtempSync(path.join(outDir, '.minify-'));
    var duplicates = [];
    var bundleMapAbsPaths = new Set();
    try {
        var duplicateRoots = new Map();
        var retainedBundleOverlaps = new Map();
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
                nodeTarget: 'node' + entry.nodeMajor,
                externalPackages: externalPackages
            });
            mergeDuplicateRoots(duplicateRoots, metafile);
            findRetainedPackageOverlaps(metafile, outDir, externalClosure.retainedRoots)
                .forEach(function (pkg) { retainedBundleOverlaps.set(pkg.name, pkg); });

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
        enforceRetainedPackagePolicy(
            Array.from(retainedBundleOverlaps.values()),
            retainedOverlapAllowlist,
            outDir);

        // Prepare a pruned dependency tree in staging before publishing anything.
        // If closure copying, pruning, or validation fails, outDir remains unchanged.
        var nodeModulesPath = path.join(outDir, 'node_modules');
        var stagedNodeModules = null;
        if (fs.existsSync(nodeModulesPath)) {
            if (!externalPackages.length) {
                console.log('> minify: removing inlined node_modules');
            } else {
                var stagedDependencyRoot = path.join(stagingDir, 'retained-dependencies');
                stagedNodeModules = path.join(stagedDependencyRoot, 'node_modules');
                fs.mkdirSync(stagedDependencyRoot, { recursive: true });
                fs.cpSync(nodeModulesPath, stagedNodeModules, {
                    recursive: true,
                    dereference: false,
                    preserveTimestamps: true
                });
                var stagedClosure = collectExternalPackageClosure(stagedDependencyRoot, externalPackages);
                pruneNodeModules(
                    stagedClosure.nodeModulesPath,
                    stagedClosure.retainedRoots,
                    stagedClosure.retainedBins);
                collectExternalPackageClosure(stagedDependencyRoot, externalPackages);
                console.log('> minify: retaining external package closure for ' +
                    externalPackages.join(', ') + ' (' + stagedClosure.retainedRoots.size + ' package(s))');
            }
        }

        // Rebase source maps while they are still staged so publication itself is
        // only a set of reversible same-volume renames.
        staged.forEach(function (s) {
            if (s.hasMap) {
                s.publishMap = s.tmpOut + '.publish.map';
                publishSourceMap(s.tmpOut + '.map', s.publishMap, stagingDir, outDir);
            }
        });

        // Phase 2: publish. Everything built, pruned, and validated, so replace
        // bundles and node_modules with rollback if any rename fails.
        // The bundle replaces the entry in place; in sourcemap mode its <entry>.js.map
        // ships alongside and the banner shim maps frames at runtime. No bootstrap is
        // written, so require.main === module is preserved in both modes.
        var replacements = [];
        staged.forEach(function (s) {
            var outPath = path.join(outDir, s.outName);
            replacements.push({ source: s.tmpOut, destination: outPath });
            if (s.hasMap) {
                replacements.push({ source: s.publishMap, destination: outPath + '.map' });
                bundleMapAbsPaths.add(outPath + '.map');
            } else if (fs.existsSync(outPath + '.map')) {
                replacements.push({ source: null, destination: outPath + '.map' });
            }
        });
        if (fs.existsSync(nodeModulesPath)) {
            replacements.push({ source: stagedNodeModules, destination: nodeModulesPath });
        }
        replaceOutputPaths(replacements, path.join(stagingDir, 'publish-backup'));
    } finally {
        rm('-rf', stagingDir);
    }

    removeIntermediateSourceMaps(outDir, bundleMapAbsPaths);

    return {
        entries: entries.map(function (e) { return e.file; }),
        duplicates: duplicates,
        externalPackages: externalPackages
    };
}
exports.minifyNodeTask = minifyNodeTask;
