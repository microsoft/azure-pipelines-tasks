# Minified task dependency audit and architecture

## Status

This document records a cross-repository audit of the runtime dependencies used by Node-based
Azure Pipelines tasks. It evaluates whether task entry points can be bundled with esbuild and
shipped without `node_modules`, identifies compatibility gaps, and recommends an architecture
for resources, runtime assets, validation, and rollout.

The audit was performed in July 2026 against local checkouts of:

- `microsoft/azure-pipelines-tasks`
- `microsoft/azure-pipelines-task-lib`
- `microsoft/azure-pipelines-tool-lib`
- `microsoft/azure-pipelines-tasks-common-packages`
- `microsoft/azure-devops-node-api`
- `microsoft/typed-rest-client`

It is a point-in-time assessment. Dependency, lockfile, entry-point, or build-system changes
must trigger the checks described in [Required CI preflight](#required-ci-preflight).

## Executive summary

Bundling Azure Pipelines tasks is feasible, but deleting `node_modules` safely requires more
than successful esbuild output.

The recommended architecture is:

1. Make libraries publish statically importable resource bundles rather than loading their own
   localization files relative to `__dirname`.
2. Add a package-owned resource registry and asset resolver to task-lib.
3. Add package metadata that declares resource bundles and runtime assets.
4. Use a two-pass esbuild process. The first pass discovers the exact reachable package graph;
   the second injects reachable resource bundles and copies explicitly declared assets.
5. Use `minify.external` as an explicit fallback for packages that cannot be bundled. Retain their
   complete installed runtime closures and original nested layout while deleting unrelated modules.
6. Generate third-party notices from the actual esbuild metafile and resolved package roots.
7. Test mock-based L0 output separately from the exact production bundle.

The main conclusions are:

- **BashV3 is not safe as a fully inlined bundle yet.** Inlining task-lib loses its localization
  resources. The compatibility trial externalizes only task-lib, bundles utility-common and uuid,
  and runs L0 against a preserved pre-bundle artifact with temporary lockfile dependencies.
- **task-lib production code is otherwise bundleable.** Its package-relative localization is the
  required production fix. Its mock loader cannot intercept an inlined task-lib.
- **tool-lib core download/cache/tar/zip behavior is bundleable on Node 16/20/24.** Full API
  parity also needs localization, task-lib deduplication, and explicit 7-Zip assets. Node 10 has
  a separate non-Windows re-cache defect caused by `fs.rmSync`.
- **azure-devops-node-api is bundleable on Node 16+.** Its default user-agent loses the package
  version unless version metadata is statically embedded or explicitly supplied.
- **typed-rest-client v3 is mechanically bundleable.** Production rollout still requires
  auditing the v1/v2 versions resolved by current tasks and fixing third-party notice generation.
- **common packages are mixed.** Nine packages load package-relative localization at runtime,
  four rely on manually duplicated task messages, and seven have non-localization runtime assets
  or layout assumptions.
- **some tasks remain hard blockers or require externalization.** Computed task-local requires still
  need rewrites. Dependency-contained dynamic loading, child scripts, native/install-time packages,
  and package-relative assets may use retained external closures, but require platform coverage and
  can substantially reduce the size benefit.

## Current minification model

The task build currently:

1. Compiles the task.
2. Installs and copies production dependencies.
3. Finds Node execution targets in `execution`, `prejobexecution`, and `postjobexecution`.
4. Bundles each target as minified CommonJS for its oldest declared Node handler.
5. Rejects reachable packages resolved from multiple physical roots unless explicitly allowed.
6. Replaces the task entry in place.
7. Deletes the complete output `node_modules` directory unless configured external packages require
   a retained runtime closure.

This model already provides important guarantees:

- Missing declared Node entries fail the build.
- Duplicate-package analysis is based on esbuild reachability rather than lockfile presence.
- Node built-ins remain runtime built-ins.
- Source-map mode preserves task and dependency sources in the final map.
- The task entry remains the directly launched main module.

The model does not currently:

- Infer a smaller asset-only subset from an external package closure.
- Discover package-relative runtime assets.
- Detect all computed or aliased runtime loading.
- Copy child-process scripts or native binaries.
- Register dependency-owned localized resources.
- Generate complete third-party notices after deleting package license files.
- Provide a minification-aware mock-test strategy.

## Audit methodology

Repository audits used:

- Source and compiled-package layout inspection.
- `package.json` and npm v3 lockfile analysis.
- esbuild metafiles to distinguish reachable code from installed-tree false positives.
- Disposable isolated bundles run without `node_modules`.
- Searches for dynamic `require`/`import`, `module.require`, `require.resolve`, `eval`,
  `new Function`, `__dirname`, package metadata reads, native modules, install scripts,
  child-process scripts, and runtime assets.
- Localization source, registration, culture fallback, and collision analysis.
- Representative task and platform scenario analysis.

The repository-wide scan covered all 225 task directories, applied the repository's deprecated-task
exclusions, and identified 127 non-deprecated tasks with Node execution handlers.

Lockfile presence is not treated as proof that code enters a bundle. Conversely, metafile absence
is not proof of runtime safety when code constructs paths or module names dynamically.

## Dependency usage

The following counts are direct declarations across task `package.json` files:

| Package | Tasks |
| --- | ---: |
| `azure-pipelines-task-lib` | 170 across all task versions; 126 non-deprecated Node tasks |
| `azure-pipelines-tasks-utility-common` | 56 |
| `azure-pipelines-tasks-azure-arm-rest` | 48 |
| `azure-pipelines-tool-lib` | 35 |
| `azure-pipelines-tasks-packaging-common` | 25 |
| `typed-rest-client` | 20 |
| `azure-pipelines-tasks-artifacts-common` | 18 |
| `azure-pipelines-tasks-docker-common` | 18 |
| `azure-devops-node-api` | 17 |
| `azure-pipelines-tasks-webdeployment-common` | 15 |
| `azure-pipelines-tasks-kubernetes-common` | 11 |
| `azure-pipelines-tasks-java-common` | 8 |
| `azure-pipelines-tasks-securefiles-common` | 8 |
| `azure-pipelines-tasks-codecoverage-tools` | 7 |
| `azure-pipelines-tasks-codeanalysis-common` | 6 |
| `azure-pipelines-tasks-msbuildhelpers` | 4 |
| `azure-pipelines-tasks-ios-signing-common` | 3 |

Counts vary when restricted to non-deprecated tasks or when transitive installations are included.
The final bundle metafile remains the authority for a specific task entry.

## Repository findings

### azure-pipelines-task-lib

**Verdict:** production `azure-pipelines-task-lib/task` is bundleable after one required resource
change.

#### Required resource fix

task-lib lazily resolves its own `lib.json` using:

```text
path.join(__dirname, "lib.json")
```

It then loads culture files below its sibling `Strings` directory. Once task-lib is inlined,
`__dirname` becomes the task root and `node_modules` is deleted. The lookup fails, warns, and
latches the missing resource state for the process lifetime.

The package should generate a CommonJS module containing all task-lib-owned defaults and cultures:

```js
module.exports = {
    defaultLocale: "en-US",
    messages: { /* LIB_* defaults */ },
    locales: {
        "de-DE": { /* translated keys */ },
        "en-US": { /* translated keys */ }
    }
};
```

`internal.ts` should use a literal import for this data and should no longer infer task-lib
resources from the bundle directory. Existing `lib.json` and `Strings` should remain in the npm
package as compatibility/reference files.

Public `setResourcePath(path)` should remain unchanged for task-owned `task.json` and task-owned
translations. Its computed JSON load is intentional because those files remain in the task
output.

#### Other findings

- The production entry reaches a small pure-JavaScript CommonJS graph.
- No native addons, package-relative child scripts, or additional package assets are required.
- Exactly one task-lib copy must enter a bundle. Multiple copies split vault, variable,
  localization, stream, and listener state. The first copy can consume and remove secret
  environment variables before another copy initializes.
- Mock loader APIs replace the literal module request for `azure-pipelines-task-lib/task`.
  They cannot intercept task-lib after it has been inlined.
- `mock-test` and its shell/download dependency graph are not production-reachable and must not be
  included in production bundles.
- Third-party notices should be generated from the production metafile rather than the full
  developer/test installation.

### azure-pipelines-tool-lib

**Verdict:** core flows are bundleable on Node 16/20/24. Full feature parity is not a single-JS
deployment today.

Verified isolated flows include download, UUID naming, cache file/directory behavior, local cache
lookup, tar extraction, and zip extraction.

| Risk | Impact | Required action |
| --- | --- | --- |
| Generic package-relative `lib.json` | Tool-lib and task-lib resolve the same bundle-root filename, so copying either original file breaks the other package's messages. | Use package-owned static resources or a registry. |
| Multiple task-lib versions | Splits secrets, variables, process listeners, and localization state. | Align dependencies and fail the build unless exactly one reachable task-lib root exists. |
| Default Windows 7-Zip implementation | Uses `Invoke-7zdec.ps1`, `externals/7zip/7z.exe`, `7z.dll`, and its license. | Declare and copy the complete asset set, or require an explicit task-owned 7-Zip path. |
| Node 10 non-Windows cache replacement | Current task-lib deletion uses `fs.rmSync`, unavailable on Node 10. A first cache may pass while replacing the same version fails. | Use a Node-10-compatible deletion implementation, polyfill explicitly, or remove the Node 10 handler. |
| Platform/system tools | `tar`, `unzip`, PowerShell, and Windows helpers are selected at runtime. | Do not fold `process.platform`; test final bundles on each supported OS. |

Current first-party uses commonly pass their own 7-Zip executable and therefore do not cover
tool-lib's default package-owned asset branch. A synthetic Windows test is required.

### azure-devops-node-api

**Verdict:** fully bundleable for supported Node 16+ handlers.

An isolated root bundle included 309 modules and retained only Node built-in requires. Client and
interface selection is static; generated location metadata uses literal values. PAT, client
creation, proxy tunnel creation, CA-file loading, NTLM generation, and representative deep imports
were exercised without `node_modules`.

The default user-agent reads the package version relative to `__dirname`. After bundling it becomes
`unknown`. The package should statically import or generate a version constant, or the task must
supply an explicit complete user-agent.

Other considerations:

- The root API statically imports all generated clients and produces a relatively large bundle.
- Deep client imports reduce size but are de facto APIs because there is no `exports` map.
- The supported runtime floor is Node 16; transpiling syntax does not restore unsupported Node 10
  semantics.
- Caller-provided CA, certificate, key, and task-lib secret files are runtime contract inputs, not
  package assets.

### typed-rest-client

**Verdict:** v3 production surfaces are mechanically bundleable as Node/CommonJS with all npm
packages inlined.

No nonliteral module loading, package-relative runtime assets, native modules, or production child
processes were found in the v3 runtime closure. Proxy and caller-provided CA paths work after
deleting `node_modules`.

Rollout constraints:

- Current tasks resolve mixed 1.8.x and 2.x versions. Each actual lockfile version must be tested;
  a v3 audit does not prove those closures.
- The package's current third-party notice does not cover the complete production closure.
- Aggregate `Handlers` imports NTLM and its dependency graph even when only Basic, Bearer, or PAT
  auth is needed. Direct handler imports are smaller.
- HTTPS NTLM currently selects an HTTP agent due to a pre-existing package defect. This is not
  caused by bundling but must be treated as an expected failure until fixed.
- Legacy NTLM hashes can fail on modern Node/OpenSSL combinations in older resolved versions.

### azure-pipelines-tasks-common-packages

Fifteen common packages contain localization catalogs. Their runtime behavior is not uniform.

#### Localization behavior

Nine packages currently self-register package-relative resources and will break when `__dirname`
changes and `node_modules` is deleted:

- `artifacts-common`
- `az-blobstorage-provider`
- `azure-arm-rest`
- `codecoverage-tools`
- `docker-common`
- `ios-signing-common`
- `java-common`
- `kubernetes-common`
- `packaging-common` for paths that import its registration module

Four packages own messages but do not self-register them. Consuming tasks currently rely on
manually duplicated keys in task resources:

- `azurermdeploycommon`
- `msbuildhelpers`
- `utility-common`
- `webdeployment-common`

`codeanalysis-common` has empty package catalogs and uses task-owned keys. `securefiles-common`
has no meaningful localized runtime content.

Resource registrations currently merge into one flat cache. Later registrations overwrite earlier
keys. Across package defaults, 157 keys are duplicated and three have conflicting English values.
Import order must not remain the collision policy.

#### Runtime asset and loading risks

| Package | Runtime concern |
| --- | --- |
| `artifacts-common` | Derives the task root from package depth to find credential provider assets. |
| `azure-arm-rest` | Computed MSAL require, conditional identity loading, and package-relative OpenSSL assets. |
| `azurermdeploycommon` | Vendored package copies, OpenSSL, web configuration templates, and relative package layout assumptions. |
| `codeanalysis-common` | Gradle/XML scripts loaded relative to the package. |
| `msbuildhelpers` | PowerShell scripts, downloaded tools, logger, and vswhere assets when consumed by tasks. |
| `packaging-common` | Derives task root/package depth to find NuGet and credential provider assets. |
| `utility-common` | Package-relative 7-Zip 24/25 tools selected by feature flag. |
| `webdeployment-common` | 7-Zip, `ctt.exe`, MSDeploy payloads, and web configuration templates. |

These concerns require an asset contract. Localization changes alone are insufficient.

## Repository-wide task blockers

The following patterns exist in current non-deprecated tasks and require source changes,
external-package retention, or an explicit no-minify decision.

### Computed module loading

Computed dispatch requires were found in:

- `DockerComposeV1`
- `DockerV1`
- `DockerV2`
- `HelmDeployV0`
- `HelmDeployV1`
- `KubernetesV1`

Replace computed module names with literal imports in an explicit map or switch. Do not allow these
tasks to minify while unresolved runtime modules would be deleted.

### Package-relative resources

Tasks with direct `node_modules/.../module.json` resource paths include:

- `AzureAppServiceSettingsV1`
- `AzureMysqlDeploymentV2`
- `AzureResourceGroupDeploymentV2`
- `AzureResourceManagerTemplateDeploymentV3`
- `AzureRmWebAppDeploymentV4`
- `AzureRmWebAppDeploymentV5`
- `AzureSpringCloudV0`
- `FileTransformV2`
- `HelmDeployV0`
- `HelmDeployV1`
- `IISWebAppDeploymentOnMachineGroupV0`
- `KubernetesV1`
- `TwineAuthenticateV1`
- `UseDotNetV2`

These must migrate to static resources/registration or an explicit copied asset path.

### Child-process package scripts

`GruntV0`, `GulpV0`, and `GulpV1` execute JavaScript/configuration under `node_modules`.
Inlining the parent entry does not preserve those physical child files.

### Native and install-time packages

`CopyFilesOverSSHV0` and `SshV0` use `ssh2`, whose optional acceleration dependencies can produce
native artifacts. Installed trees must be examined on every supported OS before minification.

`VsTestV2` and `VsTestV3` use Windows-specific optional dependencies and require a Windows
production-bundle canary.

### Conditional archive paths

Archive/extraction packages and runtime-version branches require targeted coverage in:

- `DownloadBuildArtifactsV0`
- `DownloadPackageV1`
- `JenkinsDownloadArtifactsV1`
- `JenkinsDownloadArtifactsV2`
- `PackerBuildV1`

Literal conditional imports can bundle successfully, but success must cover both executed branches
and any package sidecars.

## Recommended target architecture

### 1. Package-owned resource bundles

Localized libraries should generate a JavaScript resource bundle during their normal package build.
The generated file should contain:

- Package/owner identity.
- Default locale.
- Default messages.
- Canonically named locale maps.
- Optional aliases retained for backward compatibility.

This keeps package resources statically visible to esbuild and works with bundlers other than the
Azure Pipelines task build.

Packages should continue publishing existing JSON/resource files during migration, but runtime code
should stop locating package-owned resources via `__dirname`.

### 2. task-lib resource registry

Add an API conceptually equivalent to:

```ts
registerResourceBundle(owner: string, bundle: ResourceBundle): void;
locFrom(owner: string, key: string, ...args: unknown[]): string;
```

Legacy `tl.loc(key)` remains available while tasks migrate.

Registry rules:

- Internal identity is `(owner, key)`, not a global key alone.
- Task-owned values override dependency values for legacy flat lookup.
- Identical dependency definitions deduplicate.
- Conflicting dependency definitions fail the task build unless an explicit reviewed alias or
  override is declared.
- Import order never decides the winner.

Locale fallback should be:

1. Exact canonical locale, case-insensitive.
2. Explicit neutral-language catalog, when present.
3. Package default locale.
4. Default message.

Do not map one regional culture to another implicitly.

### 3. Runtime asset manifests

Packages with binaries, scripts, templates, workers, or other runtime files should declare logical
assets in package metadata, for example:

```json
{
  "azurePipelinesTask": {
    "resources": "./resources.bundle.js",
    "assets": {
      "sevenZipExecutable": {
        "path": "./externals/7zip/7z.exe",
        "platform": "win32"
      },
      "sevenZipLibrary": {
        "path": "./externals/7zip/7z.dll",
        "platform": "win32"
      }
    }
  }
}
```

The contract must preserve:

- Complete related asset groups.
- Platform and architecture selectors.
- Executable permissions.
- Stable logical names independent of package depth.
- Associated license/notice files.
- Content hashes for validation.

task-lib should expose task-root and asset resolution APIs rather than requiring packages to derive
paths from `__dirname` depth.

### 4. Two-pass esbuild integration

Use two passes for opted-in tasks:

#### Discovery pass

- Bundle every declared Node entry into staging.
- Capture warnings and metafiles.
- Identify exact reachable package roots.
- Reject unsupported dynamic loading.
- Read package resource/asset metadata.
- Detect multiple reachable roots for stateful packages.
- Build the license inventory.

#### Final pass

- Generate an injected resource registration module containing only reachable package resources.
- Copy declared asset groups into owner-scoped output paths.
- Provide generated asset mappings to runtime code.
- Bundle entries again with the injected registry.
- Verify that only Node built-ins remain unresolved.
- Verify copied assets and notices.
- Delete `node_modules`.

The second pass is an automation layer over package-owned resource and asset contracts. It should
not infer arbitrary package internals from conventional filenames forever.

### 5. Production and test artifacts

Maintain separate build surfaces:

- **L0/mock artifact:** plain TypeScript output, or a dedicated esbuild artifact that externalizes
  `azure-pipelines-task-lib` and its deep imports so `TaskMockRunner` can intercept them.
- **Production artifact:** fully inlined bundle with no runtime package modules.
- **Final-artifact integration tests:** execute the exact production artifact in a child process
  after removing `node_modules`.

A test-only externalized artifact is intentionally not byte-identical to production and must not be
treated as final bundle validation.

## Architecture options

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Package-generated static resources | Bundler-neutral; preserves package ownership; no runtime filesystem dependency; supports all locales. | Requires package releases and migration work. | **Required foundation.** |
| Merge dependency messages into task `task.json`/`Strings` | Fast transitional path; works with existing task-lib task-resource loader; supports packages that do not self-register. | Flattens ownership; duplicates translations per task; mutates task resources; needs collision policy; does not solve binaries/templates or legacy package self-registration by itself. | Transitional only. |
| Two-pass metafile-driven injected registry | Includes only reachable packages; handles direct subpath imports; centralizes collision and policy checks. | More build complexity; needs deterministic caching; metafiles do not reveal dynamically constructed asset paths. | **Recommended automation layer.** |
| Copy package assets beside bundle | Preserves binaries/templates and can unblock selected packages. | Requires explicit complete closures/layouts/licenses; naive copying causes resource collisions. | Use only through declared asset manifests. |
| Partial externalization and retained packages | Implemented fallback; preserves package code, nested dependency layout, assets, and package licenses while unrelated modules are removed. | Retains the full declared transitive closure, including manifest bloat; requires duplicate-root and bundled/retained-state checks plus OS coverage. | Use for reviewed packages that cannot yet adopt static resources/assets. |
| Keep full `node_modules` | Lowest compatibility risk. | No deployment-size/file-count benefit. | Correct fallback for unsupported tasks. |
| Task-specific esbuild plugins/aliases | Can quickly unblock known package versions. | Couples task build to package internals and does not help other bundlers; difficult to maintain across versions. | Short-term experiments only. |
| English-only embedding | Smallest resource payload. | Regresses supported localization. | Reject. |

## Licensing and notices

Deleting `node_modules` removes standalone `LICENSE` and `NOTICE` files. esbuild
`legalComments: "eof"` preserves only qualifying source comments and is not a complete attribution
strategy.

For each final bundle:

1. Read the package set and exact inputs from the esbuild metafile.
2. Resolve each input to its package root and lockfile version.
3. Collect package license metadata and required license/notice texts.
4. Preserve first-party package licenses and special vendored notices.
5. Include licenses associated with copied binaries.
6. Generate an SBOM/third-party notice artifact.
7. Fail CI when a reachable package lacks a reviewed license disposition.

typed-rest-client and task-lib both have current notice-generation gaps. The solution should be
implemented centrally for task bundles rather than trusting each dependency notice to describe a
different final artifact.

## Required CI preflight

Every minified task must pass the following checks.

### Build and reachability

- Normal-build the task first.
- Bundle all Node execution, pre-job, and post-job entries.
- Fail on missing declared entries.
- Capture esbuild warnings and metafiles.
- Fail when any non-Node-built-in bare module remains unresolved.
- Fail when more than one reachable task-lib root exists.
- Retain the existing reachable duplicate-package policy.

### Dynamic loading

AST-scan task entries and metafile-reachable JavaScript for:

- Nonliteral and aliased `require`.
- `module.require`.
- Dynamic `import`.
- `require.resolve`.
- `eval` and `new Function`.
- Spawn/fork/exec of package JavaScript or package bins.

Regex scans remain a secondary diagnostic, not the primary enforcement mechanism.

### Runtime files

- Scan reachable package roots for native modules, wasm, `binding.gyp`, install scripts,
  optional dependencies, OS/CPU restrictions, workers, templates, data, and package metadata
  reads.
- Scan source for `__dirname`, `__filename`, `node_modules` path literals, and package-depth
  arithmetic.
- Require a reviewed disposition for every discovered runtime file.
- Verify every declared copied asset exists after bundling.
- Verify bundles contain no references to deleted `node_modules` paths.

### Tests

- Run existing mock L0 tests against the mock-compatible artifact.
- Run subprocess tests against the exact production bundle without `node_modules`.
- Exercise optional, error, auth, proxy, certificate, platform, and fallback branches.
- Run supported Node handler versions and operating systems.
- Run both source-map modes when the task opts to ship source maps.
- Use real pipeline canaries before broad rollout.

### Compliance

- Generate notices and SBOM data from the final reachable graph.
- Ensure copied binary licenses are included.
- Fail on unreviewed or missing license information.

### Change invalidation

Re-run the full preflight whenever any of these change:

- Task entry point or execution handler.
- Task/package source.
- `package.json` or lockfile.
- Shared/common module definitions.
- Minifier/esbuild version or options.
- Package resource/asset metadata.

## Recommended implementation phases

### Phase 0: strengthen safety gates

- Add residual bare-require verification.
- Add reachable-root runtime asset/native/install-script scanning.
- Add task-lib single-root enforcement.
- Add third-party notice generation.
- Add final-bundle subprocess smoke infrastructure.

### Phase 1: make task-lib bundle-safe

- Generate a static all-culture resource module.
- Load task-lib-owned messages from embedded data.
- Preserve task-owned `setResourcePath`.
- Add isolated no-`node_modules` localization tests.
- Separate mock L0 and production-bundle validation.

This phase unblocks BashV3's fully inlined production runtime behavior. BashV3 can use external
task-lib closure retention as a compatibility-first bridge.

### Phase 2: add shared resource and asset contracts

- Add task-lib resource registration and owner-scoped lookup.
- Add task-root and logical asset resolution.
- Define package metadata schemas.
- Add shared deterministic generators for resource modules and asset manifests.

### Phase 3: migrate common packages

Convert the nine self-registering localized packages first, starting with:

1. `java-common`
2. `azure-arm-rest`
3. `artifacts-common`
4. `packaging-common`
5. Remaining self-registering packages

Then register resources for packages that currently depend on manual task duplication.

### Phase 4: handle runtime assets and dynamic dispatch

- Make azure-arm-rest MSAL selection statically discoverable.
- Add OpenSSL, credential provider, NuGet, 7-Zip, MSDeploy, script, and template manifests.
- Replace package-depth path arithmetic.
- Rewrite computed task dispatch requires as literal maps.
- Keep child-script/native tasks un-minified until complete asset/closure support exists.

### Phase 5: canary rollout

Recommended sequence:

1. **BashV3** as the low-risk baseline using external closure retention, followed by a fully
   bundled variant after the task-lib fix.
2. **AzureCLIV3 Node24 generated variant** for ARM, MSAL, tool-lib, Node API, and common packages.
3. **UniversalPackagesV1** for packaging, artifacts, Node API, and REST client behavior.
4. **UseNodeV1** for downloads, cache replacement, proxy/certificate handling, and archives.

Keep the following as expected-negative preflight fixtures until their blockers are addressed:

- `KubernetesV1`
- `UseDotNetV2`
- `GulpV1`

Additional focused canaries:

- `CopyFilesOverSSHV0` for native/install-time SSH dependencies.
- `JenkinsDownloadArtifactsV2` for conditional archive branches.
- A synthetic Windows tool-lib default 7-Zip harness.
- `AzureTestPlanV0` as a separate browser/Node20 scenario.

## BashV3 recommendation

The BashV3 trial produced the following local output:

| Artifact | Approximate size | Files |
| --- | ---: | ---: |
| Normal task | 22.9 MB | 1,919 |
| Minified without source map | 308 KB | 40 |
| Minified with source map | 852 KB | 41 |
| Minified with task-lib external | 3.9 MB | 601 |

The fully inlined minifier completed without a duplicate-package failure, and the happy-path bundle
could execute without `node_modules`. It still warned `LIB_ResourceFile does not exist` on every
run. Task-lib error paths degraded to resource keys such as `LIB_InputRequired workingDirectory`.
Existing L0 mocks also could not intercept the inlined task-lib instance.

The compatibility branch retained task-lib's resolved closure of 55 packages while bundling
utility-common and uuid. Semver and uuid are explicitly reviewed as stateless bundled/retained
overlaps. Its happy path completed and task-lib errors remained localized with no missing-resource
warning.

The build also preserved a 196 KB pre-bundle test artifact. `make.js test` restored the committed
lockfile dependencies into temporary test-only storage, ran the existing 45 BashV3 L0 tests, and
deleted that dependency tree afterward. This keeps loader-based mocks out of the production
packaging decision; separate black-box smokes still validate the final bundle.

BashV3 is a strong first canary because its production bundle is small and reaches only 19 esbuild
inputs in the current trial. It has:

- No task-owned computed requires.
- No native modules.
- A verified reachable `utility-common/telemetry` subpath, but no reachable utility-common
  localization or 7-Zip asset branch.
- No reachable package runtime assets other than task-lib localization.
- No duplicate-package build failure.
- One reachable task-lib physical root in the trial metafile.
- A large deployable-size reduction.

For a fully inlined BashV3, it should not permanently opt in until:

1. A task-lib version with static internal resources is published and adopted.
2. The minified runtime emits no resource warnings and preserves translated task-lib errors.
3. The test pipeline separates loader-mock L0 tests from exact production-bundle tests.
4. Third-party notices are generated for the final reachable graph.
5. Node10/16/20/24 handlers and supported operating systems receive final-artifact coverage.
   BashV3 does not reach tool-lib's known Node10 re-cache defect, but that does not substitute for
   running BashV3's exact production bundle on Node10.
6. A canary pipeline validates inline, file, stderr, arguments, `BASH_ENV`, Windows path
   translation, signal handling, and error paths.

For the compatibility-first externalized configuration, items 1-3 are replaced by closure and
artifact validation: retain task-lib as the only external root, run loader-based L0 against the
pre-bundle artifact with temporary dependencies, and run production-entry tests on
Windows/Linux/macOS.

A generated `BashV3_Minified` build configuration produces and validates the minified artifact
without changing the base BashV3 build. Build configuration alone does not make two artifacts
independently selectable.
If the minified artifact keeps the Bash task ID and publishes a higher version in major 3,
unversioned `Bash@3` references resolve to it; this is a version-based replacement, not a
side-by-side canary.

Use a deployment ring/server-side canary when retaining the existing task identity. If pipelines
must explicitly select normal and minified artifacts in the same collection, the minified artifact
needs a distinct task ID and name, or a separate opt-in major version. Existing generated variant
mechanics can provide build separation, but not install-time selection by themselves.

## Open decisions

Before implementation, owners should decide:

- Whether owner-qualified localization becomes public API or remains an internal build/runtime
  contract.
- Whether task-owned message overrides are allowed for dependency keys and how they are declared.
- Whether neutral-language fallback is required.
- Whether source maps are shipped in production.
- Which packages should use external closure retention temporarily versus migrate immediately to
  static resources and asset manifests.
- How asset paths are exposed to package code without coupling packages to task output layout.
- Whether Node10 support is retained for newly minified variants.
- Where generated SBOM/notices are stored in packaged task artifacts.

## Final recommendation

Adopt a **hybrid package contract plus two-pass bundler**:

- Package-side static resources make libraries inherently bundleable.
- task-lib supplies deterministic owner-scoped localization and asset resolution.
- Package metadata declares resources and non-code runtime assets.
- The first esbuild pass discovers exact reachability.
- The second pass injects resources, copies declared assets, verifies closure, and deletes
  `node_modules`.

Do not solve this by globally flattening every dependency catalog into task resources or by copying
arbitrary package directories. Those approaches reproduce import-order collisions and package
layout assumptions in a different place.

Tasks that cannot satisfy the closure and asset checks should remain un-minified. Minification is an
opt-in packaging property, not a correctness requirement.
