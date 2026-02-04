import assert = require("assert");
import path = require("path");
import * as ttm from "azure-pipelines-task-lib/mock-test";

// Enable to improve traces while testing
// beforeEach(() => {
//   process.env.TASK_TEST_TRACE = '1';
// });

// Helper function to validate expected errors in test results
function assertHasErrors(tr: ttm.MockTestRunner, expectedErrors: string[], testName: string, expectedCount?: number) {
  assert(tr.failed === true, "task should have failed");

  assert(tr.errorIssues.length === expectedCount, `${testName}: should have exactly ${expectedCount} error message(s), but got ${tr.errorIssues.length}`);
  expectedErrors.forEach(expectedError => {
    const hasError = tr.errorIssues.some(e => e.includes(expectedError));
    assert(hasError, `${testName}: should have error containing '${expectedError}'`);
  });
}

// Helper function to validate successful test results
function assertSucceeded(tr: ttm.MockTestRunner, testName: string) {
  assert(tr.failed === false, `${testName}: task should not have failed`);
  assert(tr.errorIssues.length === 0, `${testName}: should have no error issues`);
  assert(tr.stdout.includes("OperationSucceeded"), `${testName}: should have success message`);
}

describe("run error handling tests", function() {
  this.timeout(20000);
  it("sets the failed result using a string error", async function() {
    let tp: string = path.join(__dirname, "runStringError.js");
    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertHasErrors(tr, ["This is an error!"], this.test!.title, 1);
  });

  it("sets the failed result using an Error", async function() {
    let tp: string = path.join(__dirname, "runErrorObject.js");
    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertHasErrors(tr, ["This is an error!"], this.test!.title, 1);
  });
});

describe("deployments tests", function() {
  // Set timeout for all tests in this suite (needed for Bicep installation)
  this.timeout(90000);

  it("runs validation", async function() {
    let tp: string = path.join(__dirname, "deploymentsValidation.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertSucceeded(tr, this.test!.title);
  });

  it("runs create and handles failures", async function() {
    let tp: string = path.join(__dirname, "deploymentsCreateFailures.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertHasErrors(tr, [
      "RequestFailedCorrelation",
      "DeploymentFailed",
      "ResourceNotFound",
      "CreateFailed"
    ], this.test!.title, 3);
  });

  it("handles deployment failures", async function() {
    let tp: string = path.join(__dirname, "deploymentsFailures.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertHasErrors(tr, [
      "RequestFailedCorrelation",
      "InvalidTemplateDeployment",
      "StorageAccountAlreadyTaken",
      "ValidationFailed"
    ], this.test!.title, 3);
  });

  it("runs what-if", async function() {
    let tp: string = path.join(__dirname, "deploymentsWhatIf.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertSucceeded(tr, this.test!.title);
  });

  it("handles inline yaml parameters", async function() {
    let tp: string = path.join(__dirname, "deploymentsInlineYamlParams.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertSucceeded(tr, this.test!.title);
  });
});

describe("stacks tests", function() {
  // Set timeout for all tests in this suite (needed for Bicep installation)
  this.timeout(90000);

  it("runs validation", async function() {
    let tp: string = path.join(__dirname, "stacksValidation.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertSucceeded(tr, this.test!.title);
  });

  it("runs create and handles failures", async function() {
    let tp: string = path.join(__dirname, "stacksCreateFailures.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertHasErrors(tr, [
      "RequestFailedCorrelation",
      "DeploymentStackDeploymentFailed",
      "DeploymentFailed",
      "CreateFailed"
    ], this.test!.title, 3);
  });

  it("handles deployment failures", async function() {
    let tp: string = path.join(__dirname, "stacksFailures.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertHasErrors(tr, [
      "RequestFailedCorrelation",
      "InvalidTemplateDeployment",
      "StorageAccountAlreadyTaken",
      "ValidationFailed"
    ], this.test!.title, 3);
  });

  it("handles inline yaml parameters", async function() {
    let tp: string = path.join(__dirname, "stacksInlineYamlParams.js");

    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    await tr.runAsync();

    assertSucceeded(tr, this.test!.title);
  });
});