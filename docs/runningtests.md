# Running tests

Once you have built the tasks you want to test, just run `npm test` to run all of those tasks' tests.

# Adding tests

Any tests that are added should be added to their appropriate task's folder with the following format: `~/Tasks/<Task name>/Tests/L0.ts` so that they get automatically picked up by this repo's test framework.

Any test dependencies that you need should be declared in the task's root `package.json` (`~/Tasks/<Task name>/package.json`). We use the mocha framework to run all the tests - you should not need to install that as a dev dependency, though, since its already installed at the repo root. See https://github.com/microsoft/azure-pipelines-tasks/tree/master/Tasks/CmdLineV2/Tests for a simple example.

More information on writing tests can be found at https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=azure-devops#step-2-unit-testing-your-task-scripts.

# Legacy tests

There are also some tests in the `~/Tests` and `~/Tests-Legacy` folders of the repo. These will get run with the other tests, but no new tests should be added to these folders.
