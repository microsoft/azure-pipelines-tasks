# Table of Contents
- [Table of Contents](#table-of-contents)
- [Contributing](#contributing)
- [PR Submission](#pr-submission)
- [Prerequisites: Node and Npm](#prerequisites-node-and-npm)
- [Install Dependencies](#install-dependencies)
- [Build and Test](#build-and-test)
  - [Build All Tasks (this can take a while):](#build-all-tasks-this-can-take-a-while)
  - [Build a specific task (recommended):](#build-a-specific-task-recommended)
  - [Minifying a task (bundling)](#minifying-a-task-bundling)
  - [Run Tests](#run-tests)
  - [Legacy Tests](#legacy-tests)
  - [Remote debugging node tasks](#remote-debugging-node-tasks)

# Contributing

This repo contains the in-the-box tasks for Azure Pipelines build. Tasks in this repo get deployed every three weeks to Azure Pipelines and appear in TFS quarterly updates.

If you are creating tasks that you believe the community can benefit from consider [creating an extension](https://www.visualstudio.com/integrate/extensions/develop/add-build-task).

# PR Submission

We welcome contributions to the project!  To help us get your PR through the review process and give it the attention it deserves please follow these steps during submission:
- There are many different teams working in this repository each of whom may be responsible for one or more tasks.  You can help them respond to your PR by assigning a the label to your PR that matches the `category` in your changed task's `task.json`.  Notice the `category` in the snippet from a `task.json` below:
```json
{
    "id": "333b11bd-d341-40d9-afcf-b32d5ce6f23b",
    "name": "NuGetCommand",
    "friendlyName": "NuGet",
    "description": "Restore, pack, or push NuGet packages, or run a NuGet command. Supports NuGet.org and authenticated feeds like Azure Artifacts and MyGet. Uses NuGet.exe and works with .NET Framework apps. For .NET Core and .NET Standard apps, use the .NET Core task.",
    "helpMarkDown": "[More Information](https://go.microsoft.com/fwlink/?LinkID=613747)",
    "category": "Package",
    "author": "Microsoft Corporation",
    "version": {
        "Major": 2,
        "Minor": 0,
        "Patch": 21
    },
```
- Assign a reviewer.  Look in GIT history for your file and find either the creator or the most prolific contributor and assign them as a reviewer.  If that person can not assist they should be able to redirect to someone who can.
- Link an issue. Create an issue and link it to your PR.  This will get the attention of the folks triaging the backlog.


# Prerequisites: Node and Npm

**Windows and Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

From a terminal ensure at least node 4.2 and npm 5:

```bash
$ node -v && npm -v
v4.2.0
5.6.0
```

**Note:** to recent Node versions will not work with all of the tooling in this
repository. Before we improve it to support latest versions, consider using
Node 10. You can use [Volta](https://volta.sh) to manage multiple Node versions
on your system.

To install npm separately:

```
[sudo] npm install npm@5 -g
npm -v
5.6.0
```

Note: On windows if it's still returning npm 2.x run `where npm`. Notice hits in program files. Rename those two npm files and the 5.6.0 in AppData will win.

# Install Dependencies

Once:

```bash
npm install
```

# Build and Test

The instructions below demonstrate how to build and test either all or a specific task.  The output will be sent to
the `_build` directory.  You can then use the tfx client to upload this to your server for testing.

The build will also generate a `tasks.loc.json` and an english strings file under `Strings` in your source tree. You should check these back in. Another localization process will create the other strings files.

Note: if you see some issues with externals downloading - you may probably need to downgrade NodeJS version to 8 to build task.
You can use [nvm](https://github.com/nvm-sh/nvm) to install and use several NodeJS versions on your environment.

## Build All Tasks (this can take a while):

``` bash
# build and test
npm run build
```

## Build a specific task (recommended):

```bash
node make.js build --task ShellScript
```

## Build task with the bypassed auditing step

```bash
node make.js build --task ShellScript --BypassNpmAudit
```

## Minifying a task (bundling)

Node-based tasks can optionally be **bundled and minified** at build time. Instead of
shipping the compiled JavaScript plus a full `node_modules` tree (often thousands of
files, tens of MB), each Node execution target is bundled with [esbuild](https://esbuild.github.io/)
into a single minified file and `node_modules` is dropped from the output. This can
reduce a task's deployable size by ~90% or more.

Minification is **off by default** and **opt-in per task**. Nothing is minified unless
the task opts in via `make.json`. The command-line flags exist only for **experimentation** -
to try minification on a task and inspect the result before you commit to opting in.

### Try it first (command line, experimentation only)

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

### Opt in (make.json - the real switch)

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

### `make.json` "minify" options

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `enabled` | boolean | `false` | Bundle + minify this task's Node execution targets and drop `node_modules`. |
| `sourceMap` | boolean | `false` | Also emit a TypeScript source map so runtime stack traces resolve back to `.ts` files. Only applied when `enabled` is true. |
| `allowDuplicates` | string[] | `[]` | Package names that are allowed to be bundled from more than one `node_modules` root (see below). Merged with the built-in stateless allowlist. |

### Source maps and debugging

Without a source map, minified stack traces point at the single-line bundle and are hard
to read. With `"sourceMap": true` (or `--sourcemap`) the task's own TypeScript frames
resolve back to the original `.ts` file and line number. The task entry point becomes a
tiny bootstrap that enables source-map support before loading the bundle, so no agent
configuration or extra Node flags are required.

Only the task's TypeScript maps back to source; dependency frames stay at the bundled JS
(their maps are not shipped, to keep size down).

### Duplicate packages (split module state)

If the same npm package is installed in more than one `node_modules` folder, esbuild would
otherwise bundle two separate copies. For a package that keeps **module-level state**, that
state splits across the copies and can silently break (for example the internal secret
`_vault` in `azure-pipelines-task-lib`). To prevent this:

- A dedupe resolver forces `azure-pipelines-*` packages to a single canonical copy.
- After bundling, any package still resolved from more than one root **fails the build**,
  with a message listing the offending package(s) and how to fix it.

When the build fails on a duplicate, first decide **whether the package holds module-level
state** (caches, singletons, registries, secrets, config set once at load), then pick a fix:

- **Stateful** -> **merge to a single copy** (correctness). Two copies would split state.
- **Stateless** (pure functions, e.g. `uuid`, `semver`) -> **keep both** (convenience). Two
  copies just cost a little size.

If you are unsure, treat it as stateful and merge.

#### Fixing a duplicate: merge to one copy (stateful)

Pick whichever is easiest for the package in question:

1. **Deduplicate the install** so only one copy exists on disk, then esbuild can only bundle
   one. Run `npm dedupe` in the task folder, or align the versions so the nested dependency
   uses the same version as the top-level one:

   ```bash
   cd Tasks/<Task>
   npm dedupe
   ```

2. **Remove the nested copy via `make.json`** - the repo's existing pattern. Many tasks
   already delete a redundant nested `node_modules/.../azure-pipelines-task-lib` this way.
   The `rm` runs after install, so only the top-level copy remains for the bundler:

   ```jsonc
   {
     "minify": { "enabled": true },
     "rm": [
       {
         "items": ["node_modules/some-common/node_modules/some-stateful-lib"],
         "options": "-Rf"
       }
     ]
   }
   ```

3. **Extend the dedupe resolver** (in `make-util.js`) when you cannot change the install and
   need the bundler to collapse the copies. The plugin already forces `azure-pipelines-*` to
   the task's top-level copy; widen its `onResolve` filter to also match your package:

   ```js
   // make-util.js - dedupePlugin
   build.onResolve({ filter: /^(azure-pipelines-|some-stateful-lib$)/ }, function (args) { ... });
   ```

> Caveat: two copies usually exist because they are *different versions*. Merging makes one
> importer run against a version it was not built against. That is fine for compatible
> versions - verify behavior if the versions differ significantly.

After any of these, rebuild; the package drops out of the duplicate report and the build passes.

#### Keeping both copies (stateless)

If you have confirmed the package is stateless, tell the build both copies are acceptable.
Known-stateless packages are exempt from the failure; the built-in allowlist covers `uuid`.
Add more per task in `make.json` (exact names only - each entry exempts just that package):

```jsonc
{
  "minify": {
    "enabled": true,
    "allowDuplicates": ["some-stateless-package"]
  }
}
```

If you allowlist a package that isn't actually duplicated (a typo or a stale entry left
after a dependency was deduplicated), the build prints a note so you can clean it up.

As a last-resort escape hatch, `--allow-duplicates` downgrades the failure to a warning for
the whole build - prefer merging the duplication or allowlisting the specific package instead.

### Known caveats (validate before opting in)

Bundling collapses many files into one and drops `node_modules`, which breaks a few
assumptions that only hold when files stay separate on disk. Always trial a task with
`--minify` (and run its tests against the minified output) **before** adding a permanent
`make.json` opt-in. The two things most likely to bite:

#### Dynamic `require()`

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
- Or mark the offending module as **external** in the esbuild options (so it isn't bundled)
  and ship just that one package in `node_modules` - a hybrid that minifies everything else.
- Or leave the task un-minified (don't add the `make.json` opt-in) if it relies heavily on
  dynamic loading.

#### Source map / `tsconfig` interactions

The source map produced for minified tasks chains esbuild's bundle map through tsc's
per-file maps. To keep that chain unambiguous the build emits **external** maps and deletes
the now-redundant intermediate tsc `*.js.map` files, keeping only the final `.bundle.js.map`.
Avoid configuring a task's `tsconfig.json` with `inlineSourceMap` when minifying - mixing
inline tsc maps with the external bundle map produces conflicting `sourceMappingURL`
directives and frames that resolve to the wrong line (or not at all). Stick with the default
`sourceMap` behavior and let the minify step manage the maps.

## Run Tests

Tests for each task are located in Tests folder for each task.  To get additional debugging when you are running your tests, set the environment variable TASK_TEST_TRACE to 1.  This will cause additional logging to be printed to STDOUT.

[Types of tests discussed here](runningtests.md)

Run tests for all tasks that have been built (i.e. those that exist in the `_build` directory)
```bash
npm test

# which is alias for
node make.js test
```

Run tests for the task that you are intersted in:
```bash
node make.js test --task ShellScript --suite L0
```

Tests should be run with changes. Ideally, new tests are added for your change.
[Read here](runningtests.md)

## Legacy Tests

Legacy tests are located in a Tests-Legacy folder which is a sibling to Tasks.
```bash
node make.js testLegacy
```

For a specific task
```bash
node make.js testLegacy --task Xcode
```

## Remote debugging node tasks

The newer versions of Azure DevOps Pipeline Agent (3.242.0+) support remote debugging node-based pipeline tasks.
If you wish to debug through the task code being executed on the actual agent machine you need to:
1. [Configure the agent](https://github.com/microsoft/azure-pipelines-agent/blob/master/docs/contribute.md)
2. Build and upload the version of the task that supports remote debugging

To build the task in debug mode run:
```bash
node make.js build --task AzureCLIV2 --debug-agent-dir "<path to the local agent run directory>"
```

This command will also create the necessary launch configurations for Visual Studio Code.
Once you run the pipeline and the agent pauses the execution awaiting for the debugger to attach, run the configuration which corresponds to the version of the task (pay attention to the version of the patch).


You can also build all tasks at once in this mode:
```bash
node make.js build --debug-agent-dir "<path to the local agent root directory>"
```

Note that the agent must be run with the `--debug` parameter and that the `VSTSAGENT_DEBUG_TASK` environment variable must be defined on the VM.
