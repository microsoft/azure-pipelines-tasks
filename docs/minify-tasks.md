<!-- This guide is also linked from contribute.md -->
# Minifying a task (bundling)

Node-based tasks can optionally be **bundled and minified** at build time. Instead of
shipping the compiled JavaScript plus a full `node_modules` tree (often thousands of
files, tens of MB), each Node execution target is bundled with [esbuild](https://esbuild.github.io/)
into a single minified file and bundled dependencies are dropped from `node_modules`. Packages
listed under `minify.external` keep their runtime closures on disk. Fully bundled tasks can reduce
their deployable size by ~90% or more; external closures reduce that saving.

Minification is **off by default** and **opt-in per task**. Nothing is minified unless
the task opts in via `make.json`. The command-line flags exist only for **experimentation** -
to try minification on a task and inspect the result before you commit to opting in.

## Contents

- [Try it first (command line, experimentation only)](#try-it-first-command-line-experimentation-only)
- [Opt in (make.json - the real switch)](#opt-in-makejson---the-real-switch)
- [make.json "minify" options](#makejson-minify-options)
- [Source maps and debugging](#source-maps-and-debugging)
- [Duplicate packages (split module state)](#duplicate-packages-split-module-state)
- [Known caveats (validate before opting in)](#known-caveats-validate-before-opting-in)
- [Partial bundling with external packages](#partial-bundling-with-external-packages)
- [Test and canary coverage (required before opting in)](#test-and-canary-coverage-required-before-opting-in)
- [Dependency hygiene best practices](#dependency-hygiene-best-practices)
- [Future work / deferred](#future-work--deferred)

## Try it first (command line, experimentation only)

Before opting a task in, use the build flags to try minification and check that the task
still builds, bundles cleanly (no blocking duplicate packages), and shrinks as expected.
These flags are **not** meant to be a permanent way to build a task - they apply to the
current build only and override whatever `make.json` says:

```bash
# bundle + minify (smallest output, no source map)
node make.js build --task ShellScript --minify --BypassNpmAudit

# bundle + minify + TypeScript source map (debuggable stack traces)
node make.js build --task ShellScript --minify --sourcemap --BypassNpmAudit

# force minification OFF even if the task opts in via make.json
node make.js build --task ShellScript --no-minify --BypassNpmAudit
```

Inspect `_build/Tasks/<Task>` afterward: confirm the bundle is present, `node_modules` is
gone, stack traces resolve (with `--sourcemap`), and the build didn't fail on a duplicate
package. Once you're happy, opt the task in permanently.

## Opt in (make.json - the real switch)

To make minification a permanent property of the task, add a `minify` block to the task's
`make.json`. The setting then travels with the task and is applied automatically on every
build (including generated tasks) - no flag required:

```jsonc
{
  "minify": {
    "enabled": true,
    "sourceMap": true,
    "external": ["package-with-runtime-assets"]
  }
}
```

**Precedence:** a command-line flag always wins (that's what makes experimentation safe -
you can force minification on or off regardless of `make.json`). When no flag is given, the
per-task `make.json` setting decides.

## `make.json` "minify" options

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `enabled` | boolean | `false` | Bundle + minify this task's Node execution targets and drop bundled packages from `node_modules`. |
| `sourceMap` | boolean | `false` | Also emit a TypeScript source map so runtime stack traces resolve back to `.ts` files. Only applied when `enabled` is true. |
| `allowDuplicates` | string[] | `[]` | Package names allowed to be bundled from more than one `node_modules` root (see below). There is no global default - every entry is an explicit per-task decision. |
| `allowBundledAndRetained` | string[] | `[]` | Reviewed stateless packages allowed to be inlined while the same installed package is also retained as part of an external package's closure. Stateful packages must instead be listed under `external`. |
| `external` | string[] | `[]` | Top-level package names esbuild must leave as runtime `require()` calls. Their complete installed runtime dependency closures and assets are retained in `node_modules`; unrelated packages are deleted. |

## Source maps and debugging

Without a source map, minified stack traces point at the single-line bundle and are hard
to read. With `"sourceMap": true` (or `--sourcemap`) the task's own TypeScript frames
resolve back to the original `.ts` file and line number.

The bundle replaces the task entry **in place** (there is no separate `*.bundle.js` and no
bootstrap wrapper), so `require.main === module` and any other main-module semantics behave
exactly as they do without a source map. Alongside the bundle we ship a `<entry>.js.map`, and
the bundle is prefixed with a tiny dependency-free ES5 shim that installs a lazy
`Error.prepareStackTrace` hook. When something reads a stack trace, the shim uses Node's
built-in source-map decoder (`require('module').SourceMap`) to rewrite the task's own frames
back to `.ts` — **no `--enable-source-maps` flag, `NODE_OPTIONS`, or agent configuration is
required**.

Runtime behavior by handler runtime:

- **Node 16 / 20 / 24** (built-in `module.SourceMap` present): task frames auto-map to `.ts`
  in live pipeline logs, no flags.
- **Node 10** (no built-in decoder): the shim cleanly no-ops — traces stay at the bundled JS
  but function/class names are preserved (`keepNames`), and the shipped `.js.map` can still be
  decoded offline or by tooling.

Both task frames and dependency frames are mapped, not just task code. Task frames resolve to
the original `.ts` (through the chained tsc maps); dependency frames resolve to their original
`node_modules` JavaScript source. The map is emitted with `sourcesContent`, so every source it
references — task `.ts` and dependency `.js` alike — is embedded **inside** the `<entry>.js.map`
and keeps resolving after `node_modules` is deleted (nothing is read from disk at trace time).
One consequence: because it inlines every bundled source, the `<entry>.js.map` can be large
(often several MB) — it is a debug artifact shipped next to the bundle, not loaded unless a
stack trace is formatted.

## Duplicate packages (split module state)

If the same npm package is installed in more than one `node_modules` folder, esbuild
bundles a separate copy for each root. For a package that keeps **module-level state**, that
state splits across the copies and can silently break (for example the internal secret
`_vault` in `azure-pipelines-task-lib`, which is a module-level `var`). Bundling does not
create this hazard - two physical copies already load as two independent instances at
runtime today - but collapsing everything into one file freezes it in place, so the build
surfaces it at build time instead of letting it ship silently.

There is **no automatic deduplication**. After bundling, any package resolved from more than
one `node_modules` root **fails the build**, listing each offending package with the resolved
version at every root so you know exactly what to align:

```
> minify: MavenAuthenticateV0 bundles the following package(s) from more than one node_modules root ...:
    semver
      - node_modules/semver (5.7.2)
      - node_modules/azure-pipelines-tasks-artifacts-common/node_modules/semver (6.3.1)
```

Duplicate tolerance is **opt-in per task only** - there is no global allowlist, so every
duplicate is a deliberate, reviewable decision by the task owner.

When the build fails on a duplicate, first decide **whether the package holds module-level
state** (caches, singletons, registries, secrets, config set once at load):

- **Stateful** -> **converge to a single copy** (correctness). Two copies split state.
- **Stateless** (pure functions, e.g. `uuid`, `semver`) -> you *may* keep both, but prefer
  converging anyway so the tree stays clean.

If you are unsure, treat it as stateful and converge.

### Preferred fix: align versions by upgrading your direct dependencies

Duplicates almost always exist because two dependencies require **different versions** of the
same transitive package, so npm cannot hoist them to a single copy. The durable fix is to
**align the versions at their source** - bump the *direct* dependencies in the task's
`package.json` so their transitive requirements converge on one version. This matters most
for the first-party `azure-pipelines-*` packages we own (`azure-pipelines-task-lib`,
`azure-pipelines-tool-lib`, the Node API packages, and anything under `~/Repos`): once every
importer asks for the same version, npm keeps one copy and the state-splitting hazard
disappears for good.

1. Read the failure - each root is annotated with its resolved version (see above).
2. Find which direct dependency drags in the divergent copy:

   ```bash
   cd Tasks/<Task>
   npm ls semver          # prints the dependency chain to each installed version
   ```

3. Upgrade the direct dependency (or the package that owns the nested copy) so a single
   version satisfies every importer, then reinstall and dedupe:

   ```bash
   npm install <direct-dep>@<newer-version>
   npm dedupe
   ```

4. Rebuild. When one version satisfies every importer, npm keeps a single copy and the
   package drops out of the duplicate report.

### Fallback: remove the nested copy via `make.json`

When you cannot change the versions (for example a transitive package you do not own), the
repo's existing pattern deletes the redundant nested copy after install so only the top-level
copy remains for the bundler:

```jsonc
{
  "minify": { "enabled": true },
  "rm": [
    { "items": ["node_modules/some-common/node_modules/some-stateful-lib"], "options": "-Rf" }
  ]
}
```

> Caveat: two copies usually exist because they are *different versions*. Deleting one makes
> its importer run against a version it was not built against - safe only for compatible
> versions. Prefer aligning versions (above) so the single copy that remains is one every
> importer actually supports; verify behavior if the versions differ across a major.

### Keeping both copies (stateless, per-task opt-in)

If you have confirmed the package is genuinely stateless and cannot easily converge the
versions, tell the build both copies are acceptable. There is **no built-in allowlist** - you
must list the package explicitly in the task's `make.json` (exact names only; each entry
exempts just that one package):

```jsonc
{
  "minify": {
    "enabled": true,
    "allowDuplicates": ["some-stateless-package"]
  }
}
```

If you allowlist a package that isn't actually duplicated (a typo or a stale entry left after
a dependency was deduplicated), the build prints a note so you can clean it up.

As a last-resort escape hatch for experimentation, `--allow-duplicates` downgrades the failure
to a warning for the whole build - prefer aligning versions or allowlisting the specific
package instead.

## Known caveats (validate before opting in)

Bundling collapses many files into one and drops all non-external packages from `node_modules`,
which breaks assumptions that only hold when files stay separate on disk. Always trial a task with
`--minify`, run its loader-based suites through `make.js test`, and separately launch the production
bundle in black-box tests **before** adding a permanent `make.json` opt-in. The two things most
likely to bite:

### Dynamic `require()`

esbuild bundles by statically following `require()`/`import` calls whose argument is a
**literal string**. A **dynamic** require - one whose argument is a variable, a concatenated
string, or a template literal - cannot be resolved at build time:

```js
require('azure-pipelines-task-lib/task');   // OK  - static, gets bundled
require(someVariable);                       // BAD - value only known at runtime
require('./handlers/' + provider);           // BAD - computed path
require(`./locales/${locale}.js`);           // BAD - template with a variable
```

For a dynamic require, esbuild leaves the call in the output instead of inlining the target.
At runtime Node then tries to resolve it from `node_modules` on disk - but minify **deleted**
`node_modules`, so it throws `Cannot find module 'X'`. This fails **only** in minified mode,
**only** on the code path that hits the dynamic require (often a rare branch - a specific auth
type, a platform check, an error handler), so it can pass a quick smoke test and fail later.

**How to detect it:**

1. **Read the esbuild build warnings** during a `--minify` trial build. esbuild warns about
   requires it cannot statically resolve. (Note: some patterns, e.g. aliasing `require` to a
   variable, produce no warning - don't rely on this alone.)
2. **Grep the task and its dependencies** for non-literal requires:

   ```bash
   grep -rnE "require\(([^'\"]|[^)]*\+)" Tasks/<Task> --include=*.js --include=*.ts
   ```

   Look for `require(` followed by a variable, `+` concatenation, or a `` ` `` template.
3. **Run black-box tests against `_build/Tasks/<Task>`** - the most reliable check, because an
   unresolved require only throws when its branch actually executes. `make.js test` uses the
   pre-bundle mock artifact and cannot prove final packaging closure. Exercise optional/rare paths
   (specific inputs, platform branches, error handling) where dynamic loading tends to hide.

**How to fix it:**

- Rewrite the computed require as a static `switch`/map of literal `require()` calls so
  esbuild can see every target.
- If the dynamic loading is contained inside a top-level dependency, list that package under
  [`minify.external`](#partial-bundling-with-external-packages). Its runtime closure remains
  on disk.
- Leave the task un-minified if the dynamic loading crosses package boundaries or cannot be
  covered and tested safely by an external package closure.

### Manually finding hard-to-detect dynamic requires

esbuild's warnings and a simple `require(` grep catch the obvious cases, but several patterns
slip through because they don't literally read `require("...")`. Search for these by hand:

| Pattern | Example | Why it hides |
| ------- | ------- | ------------ |
| Computed argument | `require('./x/' + name)`, `` require(`./${x}`) `` | Not a literal string |
| Aliased `require` | `const r = require; r('mod')` | The call site isn't `require(` |
| Indirect via `module` | `module.require(name)` | Different callee |
| Webpack/ncc escape hatch | `__non_webpack_require__(name)` | Deliberately hidden from bundlers |
| Dynamic `import()` | `await import(name)` | ESM dynamic import, same problem |
| Runtime eval | `eval('require')('mod')`, `new Function('return require')()` | Invisible to any static tool |
| Resolve-then-require | `require(require.resolve(name))` | Path computed at runtime |

A reasonably broad ripgrep sweep (run it on the task **and its dependencies**):

```bash
# From repo root, targeting one task's build output (see note below about node_modules)
rg -n --no-ignore \
  "require\(\s*[^'\")]|require\([^)]*\+|=\s*require\b|module\.require|__non_webpack_require__|\bimport\(|\beval\(|new Function\(" \
  _build/Tasks/<Task>
```

Notes on this command:

- **Use `-n`, not `-E`.** ripgrep uses extended regex by default; `-E` is its `--encoding`
  flag and will consume the pattern by mistake. (Plain `grep` users would use `grep -rnE`.)
- **`--no-ignore` is required.** By default ripgrep honors `.gitignore`, and `node_modules`
  is git-ignored - so a plain search **silently skips every dependency**, which is exactly
  where most dynamic requires live. `--no-ignore` forces it to descend into `node_modules`.
- The pattern flags `require(` whose first non-space character is not a quote (a variable or
  template), `require(... + ...)` concatenations, an aliased/`module.require`, the
  `__non_webpack_require__` escape hatch, dynamic `import()`, and `eval`/`new Function`.
  Expect some false positives (e.g. `require("a" + "b")` of two literals, or `require()` with
  no args); skim the hits rather than trusting a count.
- Multi-line and heavily minified dependency code can defeat line-based regex entirely; the
  table patterns are a triage aid, not a guarantee.

### Do I need to search the dependencies too?

**Yes - the dependencies are the main risk, not your task code.** Task authors usually know
their own `require`s, but a bundled task also inlines its entire transitive dependency tree,
and a dynamic require **anywhere** in that tree breaks the same way once `node_modules` is
removed. Real offenders tend to be low-level libraries (encoding/`iconv`-style codec loaders,
`agent-base`/proxy libraries, gRPC/protobuf loaders, optional native-addon shims that pick a
build at runtime).

Where to search the dependencies:

- Search the **build output** `_build/Tasks/<Task>` *after* a normal (non-minified) build -
  its `node_modules` is the exact set of files that would be bundled.
- Or search the task's source `node_modules` after `npm install` in the task folder.
- Searching the compiled JS (not just `.ts`) matters, because some deps ship only JS and the
  dynamic pattern may be introduced by a package's own build step.

Because you often can't rewrite third-party code, use `minify.external` when the unsupported
behavior is contained in a top-level package and its runtime closure can remain on disk. Confirm
the task logic through `make.js test`, then confirm the retained closure by launching the final
production entry in black-box tests.

### Partial bundling with external packages

List top-level package names under `minify.external` when they cannot safely be inlined:

- **Native addons** (`.node` binaries) - esbuild can't inline a compiled binary.
- **Runtime assets loaded from disk** - a package that reads its own non-JS files relative to
  `__dirname` (templates, `.wasm`, data files, worker scripts).
- **Unavoidable dynamic `require()`/`import()`** in a dependency you can't rewrite.

```jsonc
{
  "minify": {
    "enabled": true,
    "external": [
      "azure-pipelines-task-lib",
      "@scope/package-with-assets"
    ]
  }
}
```

The minifier:

1. Requires every configured name to be installed directly under the task's root
   `node_modules`. Package subpaths are not accepted.
2. Fails when an external package name is installed at multiple physical roots. esbuild's
   external matching is name-based, so nested versions must be aligned first.
3. Traverses installed `dependencies`, `optionalDependencies`, peer dependencies, and bundled
   dependencies from each external root.
4. Preserves every resolved package at its existing root, including nested versions, package
   assets, and matching `.bin` launchers.
5. Deletes every package and launcher outside the retained closure.
6. Traverses the pruned closure again and fails if a required dependency no longer resolves.
7. Rejects symlinked package roots or symlinked retained `node_modules` trees. Task builds must
   materialize packages with npm so pruning cannot follow a link outside the task output.

Pruning and closure validation occur in staging. Bundles and the prepared `node_modules` tree are
published with backups and rollback so a failed prune or replacement does not leave a partially
rewritten task output.

Externalization is not tree shaking. If an external package declares build-only or unused modules
under runtime `dependencies`, they are retained because the minifier cannot safely prove they are
unneeded. Fix the package manifest to reduce that closure.

Do not externalize only a wrapper while bundling another stateful package from its retained
closure. Loading one physical package both from disk and from the bundle creates two module
singletons. The build detects that overlap and fails unless the package is explicitly listed in
`allowBundledAndRetained` as a reviewed stateless exception. Prefer adding the shared stateful
package to `external` so every import remains a runtime import.

### Testing a minified task

The build preserves compiled pre-bundle code under `_build/TestArtifacts/<Task>` without copying
its `node_modules`. This artifact exists only for loader-based L0 tests; it is not shipped.

When `node make.js test` sees dependencies missing from that artifact, it:

1. Copies the task package into an isolated `_build/TestDependencies/<Task>` scratch directory,
   excluding any existing `node_modules`, and runs `npm ci --omit=dev` there. The source task's
   dependency tree is never renamed or modified.
2. When `Tests/package.json` and `Tests/package-lock.json` exist, creates a second scratch package
   and runs `npm ci` there including test development dependencies.
3. Moves only the resulting modules into the pre-bundle artifact's normal
   `<Task>/node_modules` and `<Task>/Tests/node_modules` locations.
4. Removes duplicate copies of configured external packages so tests use the production
   artifact's retained singleton.
5. Runs Mocha with normal nested Node resolution; `NODE_PATH` contains only the production
   `node_modules` needed for configured external packages.
6. Deletes the temporary test dependency tree.

This permits production dependencies such as utility-common and uuid to remain bundled while
existing L0 loader mocks operate on pre-bundle JavaScript. L0 therefore validates task logic and
mock contracts, not the final bundle. Every opted-in task still needs black-box tests that launch
the production entry from `_build/Tasks/<Task>`.

The complete retained closure must be tested on every supported platform. Optional dependencies,
native binaries, install-time outputs, and package-owned scripts can differ by OS and architecture.

### Third-party license attribution

For bundled dependencies, minification deletes their package directories and therefore their
standalone `LICENSE`/`NOTICE` files. esbuild is configured with `legalComments: 'eof'`, so legal
comments embedded **in dependency source** (the `/*! … */`, `//! …`, `@license`, or `@preserve`
banners) are preserved and collected at the end of the bundle. Standalone license files are not.

External package closures preserve their original package license files. A mixed bundle still needs
complete attribution for the dependencies that were inlined and removed.

### Source map / `tsconfig` interactions

The source map produced for minified tasks chains esbuild's bundle map through tsc's
per-file maps. To keep that chain unambiguous the build emits **external** maps and deletes
the now-redundant intermediate task tsc `*.js.map` files outside retained `node_modules`, keeping
only the final `<entry>.js.map` that ships next to the bundled entry. Avoid configuring a task's
`tsconfig.json` with
`inlineSourceMap` when minifying - mixing inline tsc maps with the external bundle map
produces conflicting `sourceMappingURL` directives and frames that resolve to the wrong line
(or not at all). Stick with the default `sourceMap` behavior and let the minify step manage
the maps.

## Test and canary coverage (required before opting in)

Minification changes how a task is assembled at runtime, and the failure modes in
[Known caveats](#known-caveats-validate-before-opting-in) — dynamic `require()`, child
processes, runtime-loaded assets, native addons — do **not** surface at build time. A task
can build, bundle, shrink, and pass a smoke test, then throw `Cannot find module` later on a
rare code path (a specific auth type, a platform branch, an error handler) that only runs in
production. Minification is therefore only as safe as the task's test coverage. **Do not opt
a task in unless it has strong automated coverage and you have validated that coverage against
the minified build.**

Before adding a `make.json` `minify` block:

- **Run both test surfaces.** `make.js test` runs `L0`, `L1`, and `L2` suites against the preserved
  pre-bundle artifact so loader mocks remain valid. That proves task logic but not packaging.
  Separately launch `_build/Tasks/<Task>` in black-box tests for both `--minify` and
  `--minify --sourcemap`; a green pre-bundle suite alone proves nothing about bundle closure.
- **Exercise every runtime code path, not just the happy path.** The caveats bite on branches —
  each authentication type, each platform (Windows / Linux / macOS), each optional feature, each
  error/fallback handler, and any dynamically selected provider or handler. If a path isn't
  covered by a test, it isn't validated for minification.
- **Prefer real end-to-end / canary coverage.** Unit tests that mock `require()` or the file
  system can hide exactly the failures minification introduces. Run the minified task in a real
  pipeline (a canary / dogfood definition) that hits its major scenarios before rolling it out
  broadly.
- **Roll out gradually and watch.** Opt in one task at a time, ship it to a canary ring or a
  small set of pipelines first, and monitor task failure rates and error telemetry before
  widening. Keep the change trivially revertible (remove the `minify` block) if a regression
  appears.
- **Re-validate after dependency or code changes.** A new dependency, a refactor, or a bumped
  version can introduce a dynamic `require()`, a duplicate package, or a new on-disk asset. Treat
  any change to a minified task's dependencies or entry points as a trigger to re-run the
  minified test + canary pass.

Rule of thumb: if you cannot confidently say the task's risky paths are covered by tests **and**
exercised in a canary against the minified build, leave it un-minified.

## Dependency hygiene best practices

Independent of minification, a lean dependency tree makes tasks smaller, faster to install, and
cheaper to audit — and it makes minification cleaner (fewer duplicates, fewer surprises). Good
habits for task authors:

- **Remove unused dependencies.** Audit periodically with `npx depcheck` and `npm ls <pkg>`;
  refactors routinely leave orphaned packages behind. Delete anything the task no longer imports.
- **Keep build-only tools in `devDependencies`.** TypeScript, type definitions, and test/lint
  tooling must not ship in the task's runtime `dependencies`.
- **Align versions to avoid duplicate copies.** Run `npm dedupe` and share a single version of
  `azure-pipelines-task-lib` and common packages so module state stays single-instance. This is
  also what prevents the duplicate-package build failure described above.
- **Don't pull a whole library for one helper.** Prefer the standard library or a small, focused
  package over a heavy transitive tree.
- **Mind transitive bloat.** One new direct dependency can drag in dozens of transitive ones —
  check what a package brings with it before committing.
- **Re-audit after every dependency change.** Make dependency review part of the normal change
  process, not a one-time cleanup.

## Future work / deferred

- **Package-level runtime manifests.** External closure retention trusts npm dependency metadata
  and preserves complete package directories. Explicit package manifests for runtime assets,
  platform selectors, and generated third-party notices would permit narrower retained outputs
  without guessing which declared files are safe to remove.
