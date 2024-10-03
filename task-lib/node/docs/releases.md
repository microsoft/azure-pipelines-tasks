# AZURE-PIPELINES-TASK-LIB RELEASES

## 2.8.0
 * Updated to TypeScript 3.0.
 * Fixed `which` so that it finds executables that can be executed by the current process, not just those that are executable by everyone.
 * Added `setVariable` method to `mock-run` for mocking variables during test.
 * Update `MockToolRunner` to emit stdout.
 * Added support for UNC args in `ToolRunner`.
 * Added additional logging commands to the Node library to obtain parity with PowerShell.
 * Added `getPlatform` convenience function.
 * Updated `vault` to use safer cipheriv encoding (stops npm from warning about encryption).

## 2.7.0
 * Updated `setResult` to expose optional done parameter
 * Updated `ToolRunner` to distinguish between events for process exit and STDIO streams closed

## 2.5.0
 * Updated `FindOptions` to expose `allowBrokenSymbolicLinks`.

## 2.3.0
 * Updated `setVariable` to fail when a secret contains multiple lines.
 * Added `setSecret` to register a secret with the log scrubber, without registering a variable. Multi-line secrets are not supported.

## 2.0.4-preview
 * Updated `ToolRunner` to validate the specified tool can be found and is executable.
 * Updated `which` to validate the file is executable and also on Windows to apply PATHEXT.

## 2.0.2-preview
 * Updated `ToolRunner` to cleanup `execSync` interface, for `execSync` to follow `options.silent`, and removed all fields from the public interface.
 * Updated `TaskResult` to include `SucceededWithIssues`.
 * Updated `rmRF` to remove `continueOnError`.
 * Removed `startsWith`, `endsWith`, and `isEqual` prototype functions for `String`.
 * Added `getSecureFiles`, `getSecureFileName` and `getSecureFileTicket` to help tasks working with secure files.

## 2.0.1-preview
 * Updated `match` to expose optional pattern-root parameter.
 * Updated `find` to normalize the specified path so the results are consistent.
 * Updated `mock-task.filter` and `mock-task.match` to passthru to `task.filter` and `task.match`.
 * Removed `vso-node-api` from package.json. If needed, add to your package.json.
 * Removed `setEnvVar`.
 * Removed `_writeLine`. Use console.log().

## 2.0.0-preview
 * Added `findMatch` that interprets the find root from a glob pattern. Supports interleaved exclude.
 * Updated `find`, `match`, and `filter` to change the default value for the options parameter, when undefined or null.
 * Updated `match` to change the behavior for exclude patterns. Interleaved exclude patterns are now supported, and exclude patterns filter results out now.
 * Removed `glob`, use `findMatch`.

## 1.1.0
 * Added `legacyFindFiles` for tasks porting from the PowerShell or PowerShell3 execution handler.

## 1.0.0
 * Updated `ToolRunner` to provide better arg quoting for .cmd/.bat files on Windows and also enable specifying exact command lines on Windows.

## 0.9.16
 * Fixed bug in `find` in introduced in 0.9.8. On Windows all subdirectories were not always traversed. Loss of precision in inode was interfering with cyclical-symlink detection logic.

## 0.9.8
 * Updated `setVariable` to expose an optional boolean parameter `secret`.
 * Added `getVariables` to get an array of all variables, secret and non-secret.
 * Updated `mkdirP` to improve error messages.
 * Updated `find` to expose options whether to follow symlinks.
 * Updated `match` to provide an overload that accepts an array of patterns.

## 0.9.5
 * API clean up as we approach 1.0 major version
 * Added typings to npm module so typescript and VS Code finds easily 
 * `tl.createToolRunner()` changed to `tl.tool()`;
 * `tr.arg`, `tr.argIf` returns ToolRunner now for easy chaining
 * `tr.argString` changed to `tr.line`
 * `tr.argPath` removed.  It was a compat only useless method.
 * changes above allow easy lines like `await tl.tool('git').arg('--version');`

## 0.8.2
  * Pattern change.  Use async function with code in try/catch.  SetResult to fail in the catch.  See samples.
  * setResult will not halt execution.  Process.exit caused output loss in some scenarios.
  * All GetInput functions will throw if required and not supplied
  * Disk operations will throw if they fail
  * mv and cp take options string as optional arg

## 0.8.x
 * Starting API clean of deprecated method.
 * tl.exit() removed.  Unsafe to exit process.  Script should execute

## 0.7.3
 * Updated `setResult` to log the message as an error issue if the result is Failed.

## 0.7.2
 * Updated `getDelimitedInput` to remove empty entries.

## 0.7.1
 * Updated `ToolRunner` to emit lines.
 * Fixed initialization so that `.taskkey` file is not left in the repo root.

## 0.7.0
 * Updated `ToolRunner.arg` to simply append to the arg array that is passed to `spawn`.
 * Added `ToolRunner.argString` to split additional arguments, which are then appended to the arg array that is passed to `spawn`.
