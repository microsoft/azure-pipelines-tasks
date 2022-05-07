# Running tests

Once you have built the tasks you want to test, just run `npm test` to run all of those tasks' tests.

# Adding tests

Any tests that are added should be added to their appropriate task's folder with the following format: `~/Tasks/<Task name>/Tests/L0.ts` so that they get automatically picked up by this repo's test framework.

Any test dependencies that you need should be declared in the task's root `package.json` (`~/Tasks/<Task name>/package.json`). We use the mocha framework to run all the tests - you should not need to install that as a dev dependency, though, since its already installed at the repo root. See https://github.com/microsoft/azure-pipelines-tasks/tree/master/Tasks/CmdLineV2/Tests for a simple example.

More information on writing tests can be found at https://docs.microsoft.com/en-us/azure/devops/extend/develop/add-build-task?view=azure-devops#step-2-unit-testing-your-task-scripts.

## Legacy tests

There are also some tests in the `~/Tests` and `~/Tests-Legacy` folders of the repo. These will get run with the other tests, but no new tests should be added to these folders.

# End to End Testing

To test tasks integration with the agent/service, we recommend uploading the version of the task that you'd like to test to an azure devops test org and setting up builds using that task.

To do this, do the following:

- Modify the task's guid to a test guid in both the task.json and task.loc.json to avoid collisions with the actual task on upload.
- (optional) Modify the task's name for easy referencing in Yaml.
- Build the task https://github.com/microsoft/azure-pipelines-tasks/blob/master/docs/contribute.md#build-and-test
- Navigate to the built task in `~/_build/Task/<Task Name>`
- Upload the built task to your test org using the tfx-cli (see steps at https://github.com/Microsoft/tfs-cli/blob/HEAD/docs/buildtasks.md#upload)
  - Install tfx-cli ([Node CLI for Azure DevOps](https://github.com/microsoft/tfs-cli/))
    ```
    npm install -g tfx-cli
    ```
  - Login to Azure DevOps
    ```
	~$ tfx login
	Copyright Microsoft Corporation

	> Service URL: {service-url}
	> Personal access token: {personal-access-token}
	Logged in successfully
    ```
	service-url: https://[your-azure-devops-account-name].visualstudio.com/DefaultCollection
	personal-access-token: create a personal access token on Azure DevOps, authorize it with Read & manage scope of `Agent Pools`
  - Upload the modified task to Azure DevOps (Current under directory `~/_build/Task`)
    ```
	tfx build tasks upload --task-path ./AzureSpringCloudV0
    ```
  - (Optional) You can also delete the uploaded task
	```
	tfx build tasks delete --task-id {task-id}
	```
	task-id: the test guid you modified in step 2
- Set up a build referencing your newly uploaded test task
