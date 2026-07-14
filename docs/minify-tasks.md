<!-- This guide is also linked from contribute.md -->
# Minifying a task (bundling)

Node-based tasks can optionally be **bundled and minified** at build time. Instead of
shipping the compiled JavaScript plus a full `node_modules` tree (often thousands of
files, tens of MB), each Node execution target is bundled with [esbuild](https://esbuild.github.io/)
into a single minified file and `node_modules` is dropped from the output. This can
reduce a task's deployable size by ~90% or more.

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
    "sourceMap": true
  }
}
```

**Precedence:** a command-line flag always wins (that's what makes experimentation safe -
you can force minification on or off regardless of `make.json`). When no flag is given, the
per-task `make.json` setting decides.

## `make.json` "minify" options

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `enabled` | boolean | `false` | Bundle + minify this task's Node execution targets and drop `node_modules`. |
| `sourceMap` | boolean | `false` | Also emit a TypeScript source map so runtime stack traces resolve back to `.ts` files. Only applied when `enabled` is true. |
| `allowDuplicates` | string[] | `[]` | Package names allowed to be bundled from more than one `node_modules` root (see below). There is no global default - every entry is an explicit per-task decision. |

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

Bundling collapses many files into one and drops `node_modules`, which breaks a few
assumptions that only hold when files stay separate on disk. Always trial a task with
`--minify` (and run its tests against the minified output) **before** adding a permanent
`make.json` opt-in. The two things most likely to bite:

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
3. **Run the task's L0/L2 tests against the minified build** - the most reliable check,
   because an unresolved require only throws when its branch actually executes. Exercise
   optional/rare paths (specific inputs, platform branches, error handling) where dynamic
   loading tends to hide.

**How to fix it:**

- Rewrite the computed require as a static `switch`/map of literal `require()` calls so
  esbuild can see every target.
- Or leave the task un-minified (don't add the `make.json` opt-in) if it relies on dynamic
  loading that can't be made static. Minify is **all-or-nothing** today - see
  [Not currently supported](#not-currently-supported-partial-bundling--external) below.

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

Because you often can't rewrite third-party code, the practical fix for a dependency-side
dynamic require today is to **not opt the task in** (leave it un-minified). Retaining a single
package in `node_modules` while bundling the rest is **not currently supported** - see
[Not currently supported](#not-currently-supported-partial-bundling--external) below. Confirm
the outcome by running the task's L0/L2 tests against the minified build.

### Not currently supported: partial bundling / `external`

Minify is **all-or-nothing**: every declared entry is bundled and the task's entire
`node_modules` is deleted. There is **no** `external` / partial-bundling option, so a task that
depends on something esbuild cannot inline **cannot be minified today** - opt it out instead.
Packages that fall in this bucket:

- **Native addons** (`.node` binaries) - esbuild can't inline a compiled binary.
- **Runtime assets loaded from disk** - a package that reads its own non-JS files relative to
  `__dirname` (templates, `.wasm`, data files, worker scripts).
- **Unavoidable dynamic `require()`/`import()`** in a dependency you can't rewrite.

A future enhancement could add an `external: string[]` field to the `make.json` `minify` block
that (a) marks those packages `external` in the esbuild options and (b) preserves them - **plus
their full transitive dependency tree and assets** - in `node_modules` instead of deleting
them. That transitive-closure retention is the reason it is not implemented yet: keeping only
the top-level package would still fail at runtime the moment it requires one of its own deps.
Until then, treat "can't be bundled" as "don't opt in".

### Third-party license attribution

Bundling deletes `node_modules`, which also removes the standalone `LICENSE`/`NOTICE` files that
ship inside each dependency. esbuild is configured with `legalComments: 'eof'`, so any license or
legal comment embedded **in a dependency's source** (the `/*! … */`, `//! …`, `@license`, or
`@preserve` banners) is preserved and collected at the end of the bundle. Standalone license
*files* are **not** carried over — only in-source legal comments are. If a task (or a compliance
process) depends on shipping the original `LICENSE` files alongside the code, account for this
before opting in.

### Source map / `tsconfig` interactions

The source map produced for minified tasks chains esbuild's bundle map through tsc's
per-file maps. To keep that chain unambiguous the build emits **external** maps and deletes
the now-redundant intermediate tsc `*.js.map` files, keeping only the final `<entry>.js.map`
that ships next to the bundled entry. Avoid configuring a task's `tsconfig.json` with
`inlineSourceMap` when minifying - mixing inline tsc maps with the external bundle map
produces conflicting `sourceMappingURL` directives and frames that resolve to the wrong line
(or not at all). Stick with the default `sourceMap` behavior and let the minify step manage
the maps.

## Future work / deferred

- **Partial bundling / `external` opt-in — deliberately deferred.** We evaluated adding an
  `external: string[]` field to the `make.json` `minify` block (mark listed packages `external`
  in esbuild **and** keep them in `node_modules` instead of deleting them) so a task could bundle
  everything except the one dependency it can't inline. It is **not** implemented for now because
  correctly preserving a package means preserving its **entire transitive dependency tree and
  runtime assets**, not just the top-level folder — otherwise the task still fails at runtime the
  moment the kept package requires one of its own deps. See
  [Not currently supported: partial bundling / `external`](#not-currently-supported-partial-bundling--external)
  for the full rationale. Until a genuine need appears, the guidance stays "if a task can't be
  fully bundled, opt it out." This can be revisited as a TODO if a real task hits a case where
  opting out entirely is unacceptable.
