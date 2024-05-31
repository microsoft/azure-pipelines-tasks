import fs = require("fs");
import assert = require("assert");
import path = require("path");
import * as tl from "azure-pipelines-task-lib/task";
import * as ttm from "azure-pipelines-task-lib/mock-test";

describe('Azure Test Plan Task Suite', function () {
  this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

  var env;

  this.beforeAll(() => {
    env = Object.assign({}, process.env);
});

beforeEach(() => {
  process.env["ENDPOINT_AUTH_SYSTEMVSSCONNECTION"] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
  process.env["ENDPOINT_URL_SYSTEMVSSCONNECTION"] = "https://example.visualstudio.com/defaultcollection";
})

this.afterAll(() => {
    process.env = env;
})

afterEach(() => {

});

  it('Simple test', (done: Mocha.Done) => {
    this.timeout(1000);

    let tp: string = path.join(__dirname, 'L0SimpleTest.js');
    let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

    tr.run();

    assert(tr.stdOutContained(`Test Selector selected`),
      `Should have looked Test Selector`);

    //assert.strictEqual(tr.stdout, "Hello World", `Actual value: ${tr.stdout}`);
    
    assert(tr.stdOutContained(`Test Plan Id:`),
      `Should have looked for Test Plan Id`);
    
    assert(tr.stdOutContained(`Test Plan Configuration Id:`),
      `Should have looked for Test Plan Configuration Id`);

    assert(tr.stdOutContained(`Test Suite Ids:`),
      `Should have looked for Test Suite Ids`);

    //assert(tr.succeeded, 'task should have succeeded');

    done();
  });
});