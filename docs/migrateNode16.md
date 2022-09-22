# Table of content

- [Table of content](#table-of-content)
  - [Upgrading Tasks to Node 16](#upgrading-tasks-to-node-16)
  - [Common packages dependent on `azure-pipeline-task-lib` and `azure-pipeline-tool-lib`](#common-packages-dependent-on-azure-pipeline-task-lib-and-azure-pipeline-tool-lib)
  - [List of known dependency issues](#list-of-known-dependency-issues)
  - [Feedback](#feedback)

## Upgrading Tasks to Node 16

1. Update @types packages in `package.json` dependencies.

```json
  "dependencies": {
    "@types/node": "^16.11.39",
    ...
  }
```

> If in task nodejs not used directly, please remove @types/node from the task dependencies

1. Upgrade `azure-pipelines-task-lib` to `^4.0.0-preview`, `azure-pipelines-tool-lib` to `^2.0.0-preview` in package.json dependencies, If a task has these packages.

2. Add the new execution handler in `task.json` as `Node16`
   - **Note**: _the `target` property should be the main file targetted for the task to execute._

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
```

</td>
</tr>
</table>

## Common packages dependent on `azure-pipeline-task-lib` and `azure-pipeline-tool-lib`

Use the latest major version of a "common package" at `common-npm-packages` folder, which depends on the `azure-pipelines-task-lib` package with `^4.0.0-preview` version. For "common package" dependent on `azure-pipeline-tool-lib`, this is `^2.0.0-preview` version.

The task-lib package uses some shared (e.g. global object) resources to operate so it may cause unexpected errors in cases when more than one version of the package is installed for a task. It happens in the case of a child package's task-lib dependency has a different version than a task's `task-lib` has. Same for `tool-lib`.

If you are planning to move some common package to common-npm-packages directory - please note that you need to update all necessary paths in this package

## List of known dependency issues

Major commits between Node 10-16 related to fs/child_process/os modules (gather from notable notes only) - you can use # numbers as PR ids to refer:

**Node 11**
Notable Changes:

fs:

- The fs.read() method now requires a callback.
- The previously deprecated fs.SyncWriteStream utility has been removed.

child_process
The default value of the windowsHide option has been changed to true.

**Node 12**

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

**Node 13**
child_process:

- ChildProcess._channel (DEP0129) is now a Runtime deprecation

fs:

- The undocumented method FSWatcher.prototype.start() was removed
- Calling the open() method on a ReadStream or WriteStream now emits a runtime deprecation warning. The methods are supposed to be internal and should not be called by user code
- fs.read/write, fs.readSync/writeSync and fd.read/write now accept any safe integer as their offset parameter. The value of offset is also no longer coerced, so a valid type must be passed to the functions.

**Node 14**
os:

- (SEMVER-MAJOR) os: move tmpDir() to EOL
fs:
- (SEMVER-MAJOR) fs: deprecate closing FileHandle on garbage collection
- add fs/promises alias module (Gus Caplan)

**Node 15**
fs:

- (SEMVER-MAJOR) fs: deprecation warning on recursive rmdir
- (SEMVER-MAJOR) fs: reimplement read and write streams using stream.construct

**Node 16:**
fs:

- (SEMVER-MAJOR) fs: remove permissive rmdir recursive
- (SEMVER-MAJOR) fs: runtime deprecate rmdir recursive option

## Feedback

If you run into some issues while migrating to Node 16, please create a ticket with the label "node-migration: Node16".
