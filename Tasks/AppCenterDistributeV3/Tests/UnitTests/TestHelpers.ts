import * as assert from "assert";

/**
 * Exit code is used to determine whether unit test passed or not.
 * When executing code requires vsts-task-lib somewhere it makes exit code = 0 regardless whether exception was thrown.
 * This helper allows to follow default NodeJS exit code behaviour when exception is thrown.
 */
export const unitTest = {
  equal: (actual, expected) => wrapAssertWithExitCode(assert.equal, actual, expected),
};

function wrapAssertWithExitCode(assert, ...args) {
  try {
    assert.apply(undefined, args);
  } catch (error) {
    process.exit(1);
  }
}
