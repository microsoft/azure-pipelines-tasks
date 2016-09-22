# Contributing

This repo contains the in-the-box tasks for Team Services build.  Tasks in this repo get deployed every three weeks to Team Services and appear in TFS quarterly updates.

If you are creating tasks that you believe the community can benefit from consider creating an extension.
[create an extension](https://www.visualstudio.com/integrate/extensions/develop/add-build-task)

## Node and Npm:
**Windows and Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

From a terminal ensure at least node 4.2 and npm 3:
```bash
$ node -v && npm -v
v4.2.0
3.5.0
```

To install npm separately:
```
[sudo] npm install npm@3 -g
npm -v
3.5.0
```

Note: on windows if it's still returning npm 2.x run where npm.  Notice hits in program files. Rename those two npm files and the 3.5.0 in AppData will win.

## Make Dependencies

Once:
```bash
npm install
```

## Short Version

ALL:

``` bash
# once
npm install

# build and test
npm run build
npm test
```

Task:

```bash
# once
npm install

#build and test
node make.js build --task ShellScript
node make.js test --task ShellScript --suite LO
```

## Build with Make

From the root of the repo ...

Build all tasks

```bash
npm run build

# which is alias for
node make.js build
```

Build a single task

```bash
node make.js build --task ShellScript
```

Tasks will be created in the _build directory.  It will also generate a tasks.loc.json and an english strings file under Strings in your source tree.  You can check these back in.  Another localization process will create the other strings files.

## Run Tests

Tests for each task are located in Tests folder for each task

Set the environment variable TASK_TEST_TRACE to 1 for STDOUT to be printed from the test.

[Types of tests discussed here](runningtests.md)

Run tests for tasks built

```bash
npm test

# which is alias for
node make.js test
```

Just run tests for a given task and/or suite type

```bash
node make.js test --task ShellScript --suite L0
```

## Legacy Tests

Legacy tests are located in a Tests folder which is a sibling to Tasks.

```bash
node make.js testLegacy
node make.js testLegacy --suite L0/XCode
```

For a specific suite and/or task

```bash
node make.js testLegacy
node make.js testLegacy --suite L0/XCode
```

## Package
This must be done on a windows machine with nuget.exe in the path
From the root of the repo (replace version with appropriate version)
```bash
gulp package --version 1.0.29
```

Tasks will be create a nuget package in the _package directory.  This is only used for TFS internal engineering.
