# Table of content
- [Upgrading Tasks to Node 10](#upgrading-tasks-to-node-10)
  - [Common packages dependent on `azure-pipeline-task-lib`](#common-packages-dependent-on-azure-pipeline-task-lib)
- [List of known dependency issues](#list-of-known-dependency-issues)
  - [`fs` module](#fs-module)
- [How to disable warnings for Node 6 deprecation](#how-to-disable-warnings-for-node-6-deprecation)

# Upgrading Tasks to Node 10

1. Upgrade `typescript` to `4.0.2` version and fix type errors. Add the following snippet to the `package.json`:

```json
  "devDependencies": {
    "typescript": "^4.0.0"
  }
```
  
2. Replace typings with @types
   * Delete `typings` folders and `typings.json` files
   * Add @types packages to `package.json` dependencies.

```json
  "dependencies": {
    "@types/node": "^10.17.0",
    "@types/mocha": "^5.2.7",
    "@types/uuid": "^8.3.0"
    ...
  }
```
3. Upgrade `azure-pipelines-task-lib` to `^3.1.7` in package.json dependencies.

4. Change execution handlers in `task.json` from `Node` to `Node10`
   * **Note**: _the `target` property should be the main file targetted for the task to execute._

<table>
<tr>
<th>From</th>
<th>To</th>
</tr>
<tr>
<td>

```json
  "execution": {
    "Node": {
      "target": "bash.js",
      "argumentFormat": ""
    }
```

</td>
<td>

```json
  "execution": {
    "Node10": {
      "target": "bash.js",
      "argumentFormat": ""
    }
```

</td>
</tr>
</table>

5. Also in the `task.json` file, if the `minimumAgentVersion` isn't present or is less than `2.144.0`, change it to `2.144.0`.
   * Agent version `2.144.0` is the [first version to support Node10 handlers](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v2.144.0) and the `minimumAgentVersion` will trigger an [automatic upgrade](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/agents?view=azure-devops&tabs=browser#agent-version-and-upgrades) of `2.x.y` agents less than `2.144.0`.

```json
  "minimumAgentVersion": "2.144.0"
```

6. Upgrade any additional dependencies that may be incompatible with Node 10.
An example is the `sync-request` package, which needs to be upgraded to the latest version from v3.0.1
See some additional [dependency issues](#list-of-known-dependency-issues) below.

7. Thoroughly test tasks with unit tests and on an actual agent. The build agent now supports Node 10, so testing can be done on live versions of Azure DevOps.

8. Bumping the minimum agent version is not required, as the server will enforce a minimum version for pipelines containing Node 10 tasks.

## Common packages dependent on `azure-pipeline-task-lib`

Use the latest major version of a "common package" at `common-npm-packages` folder, which depends on the `azure-pipelines-task-lib` package with `^3.1.7` version.

The task-lib package uses some shared (e.g. global object) resources to operate so it may cause unexpected errors in cases when more than one version of the package is installed for a task. It happens in the case of a child package's task-lib dependency has a different version than a task's `task-lib` has.

If you are planning to move some common package to common-npm-packages directory - please note that you need to update all necessary paths in this package ([example of such path](https://github.com/microsoft/azure-pipelines-tasks/blob/master/common-npm-packages/packaging-common/Tests/MockHelper.ts#L44))

# List of known dependency issues

## `fs` module

The following `fs` functions all have incompatibilities. In addition, any other `fs` usage should probably face extra strict scrutiny.
- fs.appendFile
- fs.chmod
- fs.chown
- fs.close
- fs.fchmod
- fs.fchown
- fs.fdatasync
- fs.fstat
- fs.fsync
- fs.ftruncate
- fs.futimes
- fs.lchmod
- fs.lchown
- fs.link
- fs.lstat
- fs.mkdir
- fs.mkdtemp
- fs.readdir
- fs.readFile
- fs.readlink
- fs.realpath
- fs.rename
- fs.rmdir
- fs.stat
- fs.truncate
- fs.unlink
- fs.utimes
- fs.write
- fs.writeFile

# How to disable warnings for Node 6 deprecation
To avoid noise in pipeline logs - you can disable Node 6 deprecation warnings by setting up DISABLE_NODE6_DEPRECATION_WARNING agent knob in one of 2 ways:
- Set up `DISABLE_NODE6_DEPRECATION_WARNING` pipeline variable as `true`
- For self-hosted agents - set up environment variable `DISABLE_NODE6_DEPRECATION_WARNING` as `true` 
