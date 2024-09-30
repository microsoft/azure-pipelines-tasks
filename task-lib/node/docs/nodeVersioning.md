# Node Handler versioning

## Agent Node Handler

The agent currently has 3 different node handlers that it can use to execute node tasks: Node 6, Node 10, Node 16.
The handler used depends on the `execution` property specified in the tasks `task.json`.
If the `execution` property is specified to be `Node`, the task will run on the Node 6 handler, for `Node10` it will run on the Node 10 handler, for `Node16` it will run on the Node 16 handler.

## Mock-test Node Handler

[Unit testing](https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=azure-devops#step-2-unit-testing-your-task-scripts) of tasks can be done using the task-lib's built in mock-task functionality.
To ensure tests are run in the same environment as the agent, this library looks for a `task.json` file in the same directory as the supplied task entry point.
If no `task.json` is found it searches all ancestor directories as well.
If the `task.json` is still not found, the library defaults to Node 16, otherwise it uses the appropriate handler based on the `execution` property.
If this version of node is not found on the path, the library downloads the appropriate version.

### Behavior overrides

To specify a specific version of node to use, set the `nodeVersion` optional parameter in the `run` function of the `MockTestRunner` to the integer major version (e.g. `mtr.run(5)`).
To specify the location of a `task.json` file, set the `taskJsonPath` optional parameter in the `MockTestRunner` constructor to the path of the file (e.g. `let mtr = new mt.MockTaskRunner('<pathToTest>', '<pathToTask.json>'`).