# Table of content

- [Table of content](#table-of-content)
  - [Upgrading Tasks to Node 16](#upgrading-tasks-to-node-16)
  - [Common packages dependent on `azure-pipeline-task-lib` and `azure-pipeline-tool-lib`](#common-packages-dependent-on-azure-pipeline-task-lib-and-azure-pipeline-tool-lib)
  - [Testing the changes](#testing-the-changes)
  - [List of known dependency issues](#list-of-known-dependency-issues)
  - [Feedback](#feedback)

## Upgrading Tasks to Node 16

1. Update @types packages in `package.json` dependencies.

    ```json
      "dependencies": {
        "@types/node": "^16.11.39"
      }
    ```

    > If the task does not use built-in nodejs modules (such as `fs` or `path`) directly, please remove `@types/node` from the task dependencies

2. Upgrade `azure-pipelines-task-lib` to `^4.1.0` and `azure-pipelines-tool-lib` to `^2.0.0-preview` in package.json dependencies, If a task has these packages.

3. If you have common npm packages as the task dependency, make sure the `azure-pipelines-task-lib` and `azure-pipelines-tool-lib` common package dependencies have the same version as in the task.
As a possible solution you also can remove these package versions through the `make.json` file, for example:

    ```json
    {
        "rm": [
            {
                "items": [
                    "node_modules/azure-pipelines-tasks-java-common/node_modules/azure-pipelines-task-lib",
                ],
                "options": "-Rf"
            }
        ]
    }
    ```

1. Add a new Node16 execution handler in task.json

    <table>
    <tr>
    <th>From</th>
    <th>To</th>
    </tr>
    <tr>
    <td>

    ```json
    "execution": {
      "Node10": {
        "target": "bash.js",
        "argumentFormat": ""
      }
    }
    ```

    </td>
    <td>

    ```json
    "execution": {
      "Node10": {
        "target": "bash.js",
        "argumentFormat": ""
      },
      "Node16": {
        "target": "bash.js",
        "argumentFormat": ""
      }
    }
    ```

    </td>
    </tr>
    </table>

5. Also in the `task.json` file, if the `minimumAgentVersion` isn't present or is less than `2.144.0`, change it to `2.144.0`.
    ```json
    "minimumAgentVersion": "2.144.0"
    ```
    > Agent version `2.144.0` is the [first version to support Node10 handlers](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v2.144.0) and the `minimumAgentVersion` will trigger an [automatic upgrade](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/agents?view=azure-devops&tabs=browser#agent-version-and-upgrades) of `2.x.y` agents less than `2.144.0`.

## Common packages dependent on `azure-pipeline-task-lib` and `azure-pipeline-tool-lib`

The task-lib package uses some shared (e.g. global object) resources to operate so it may cause unexpected errors in cases when more than one version of the package is installed for a task. This happens if `task-lib` in child packages has a different version than a task's `task-lib`. Same for `tool-lib`.

## Testing the changes

We need to test that the task works correctly on node 10 and node 16.
How do we need to test the changes:

- Run unit tests (they should pass on node 10 and node 16)
- Run pipeline with the task using node 10 handler
- Run pipeline with the task using node 16 handler

To start a task using node 10, we can set the pipeline variable `AGENT_USE_NODE10` to `true`.

## List of known dependency issues

Major commits between Node 10-16 related to fs/child_process/os modules (gathered from notable notes only):

**[Node 11](https://nodejs.org/ro/blog/release/v11.0.0/)**

fs:

- The fs.read() method now requires a callback.
- The previously deprecated fs.SyncWriteStream utility has been removed.

child_process
The default value of the windowsHide option has been changed to true.


**[Node 12](https://nodejs.org/ro/blog/release/v12.0.0/)**


fs:

- use proper .destroy() implementation for SyncWriteStream
- improve mode validation
- harden validation of start option in createWriteStream()
- make writeFile consistent with readFile wrt fd
- win, fs: detect if symlink target is a directory

child_process:

- remove options.customFds
- harden fork arguments validation
- use non-infinite maxBuffer defaults

os:

- implement os.type() using uv_os_uname()
- remove os.getNetworkInterfaces()

**[Node 13](https://nodejs.org/ro/blog/release/v13.0.0/)**

child_process:

- ChildProcess._channel (DEP0129) is now a Runtime deprecation

fs:

- The undocumented method FSWatcher.prototype.start() was removed
- Calling the open() method on a ReadStream or WriteStream now emits a runtime deprecation warning. The methods are supposed to be internal and should not be called by user code
- fs.read/write, fs.readSync/writeSync and fd.read/write now accept any safe integer as their offset parameter. The value of offset is also no longer coerced, so a valid type must be passed to the functions.

**[Node 14](https://nodejs.org/ro/blog/release/v14.0.0/)**

os:

- (SEMVER-MAJOR) os: move tmpDir() to EOL
fs:
- (SEMVER-MAJOR) fs: deprecate closing FileHandle on garbage collection
- add fs/promises alias module (Gus Caplan)

**[Node 15](https://nodejs.org/ro/blog/release/v15.0.0/)**

fs:

- (SEMVER-MAJOR) fs: deprecation warning on recursive rmdir
- (SEMVER-MAJOR) fs: reimplement read and write streams using stream.construct

**[Node 16](https://nodejs.org/ro/blog/release/v16.0.0/):**

fs:

- (SEMVER-MAJOR) fs: remove permissive rmdir recursive
- (SEMVER-MAJOR) fs: runtime deprecate rmdir recursive option

## Feedback

If you run into some issues while migrating to Node 16, please create a ticket with the label "node-migration: Node16".
