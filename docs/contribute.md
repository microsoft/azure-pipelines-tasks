# Table of Contents
- [Contributing](#contributing)
- [PR Submission](#pr-submission)
- [Prerequisites: Node and Npm](#prerequisites-node-and-npm)
- [Install Dependencies](#install-dependencies)
- [Build and Test](#build-and-test)
  * [Build All Tasks (this can take a while):](#build-all-tasks-this-can-take-a-while)
  * [Build a specific task (recommended):](#build-a-specific-task-recommended)
  * [Run Tests](#run-tests)
  * [Legacy Tests](#legacy-tests)

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
