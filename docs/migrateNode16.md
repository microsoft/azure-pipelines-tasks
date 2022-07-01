# Table of content
- [Table of content](#table-of-content)
  - [Upgrading Tasks to Node 16](#upgrading-tasks-to-node-16)
  - [Common packages dependent on `azure-pipeline-task-lib`](#common-packages-dependent-on-azure-pipeline-task-lib)
  - [List of known dependency issues](#list-of-known-dependency-issues)

## Upgrading Tasks to Node 16
  
1. Update @types packages in `package.json` dependencies.

```json
  "dependencies": {
    "@types/node": "^16.11.39",
    "@types/mocha": "^9.1.1",
    ...
  }
```
2. Upgrade `azure-pipelines-task-lib` to `^4.0.0` in package.json dependencies.

3. Change execution handlers in `task.json` from `Node` to `Node16`
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
    "Node10": {
      "target": "bash.js",
      "argumentFormat": ""
    }
```

</td>
<td>

```json
  "execution": {
    "Node16": {
      "target": "bash.js",
      "argumentFormat": ""
    }
```

</td>
</tr>
</table>

4. Also in the `task.json` file, if the `minimumAgentVersion` isn't present or is less than `2.208.0`, change it to `2.208.0`.
   * Agent version `2.208.0` is the [first version to support Node16 handlers](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v2.208.0) and the `minimumAgentVersion` will trigger an [automatic upgrade](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/agents?view=azure-devops&tabs=browser#agent-version-and-upgrades) of `2.x.y` agents less than `2.208.0`.

```json
  "minimumAgentVersion": "2.208.0"
```

## Common packages dependent on `azure-pipeline-task-lib`

Use the latest major version of a "common package" at `common-npm-packages` folder, which depends on the `azure-pipelines-task-lib` package with `^4.0.0` version.

The task-lib package uses some shared (e.g. global object) resources to operate so it may cause unexpected errors in cases when more than one version of the package is installed for a task. It happens in the case of a child package's task-lib dependency has a different version than a task's `task-lib` has.

If you are planning to move some common package to common-npm-packages directory - please note that you need to update all necessary paths in this package ([example of such path](https://github.com/microsoft/azure-pipelines-tasks/blob/master/common-npm-packages/packaging-common/Tests/MockHelper.ts#L44))

## List of known dependency issues

Major commits between Node 10-18 related to fs/child_process/os modules (gather from notable notes only) - you can use # numbers as PR ids to refer:

**Node 11**
Notable Changes:

fs:
- The fs.read() method now requires a callback. #22146
- The previously deprecated fs.SyncWriteStream utility has been removed.#20735

child_process
The default value of the windowsHide option has been changed to true. #21316

**Node 12**

fs:
- use proper .destroy() implementation for SyncWriteStream (Matteo Collina) #26690
- improve mode validation (Ruben Bridgewater) #26575
- harden validation of start option in createWriteStream() (ZYSzys) #25579
- make writeFile consistent with readFile wrt fd (Sakthipriyan Vairamani (thefourtheye)) #23709
- win, fs: detect if symlink target is a directory (Bartosz Sosnowski) #23724

child_process:
- remove options.customFds (cjihrig) #25279
- harden fork arguments validation (ZYSzys) #27039
- use non-infinite maxBuffer defaults (kohta ito) #23027

os:
- implement os.type() using uv_os_uname() (cjihrig) #25659
- remove os.getNetworkInterfaces() (cjihrig) #25280

**Node 13**
child_process:
- ChildProcess._channel (DEP0129) is now a Runtime deprecation (cjihrig) #27949.

fs:
- The undocumented method FSWatcher.prototype.start() was removed (Lucas Holmquist) #29905.
- Calling the open() method on a ReadStream or WriteStream now emits a runtime deprecation warning. The methods are supposed to be internal and should not be called by user code (Robert Nagy) #29061.
- fs.read/write, fs.readSync/writeSync and fd.read/write now accept any safe integer as their offset parameter. The value of offset is also no longer coerced, so a valid type must be passed to the functions (Zach Bjornson) #26572.

**Node 14**
os: 
- (SEMVER-MAJOR) os: move tmpDir() to EOL (James M Snell) #31169
fs:
- (SEMVER-MAJOR) fs: deprecate closing FileHandle on garbage collection (James M Snell) #28396
- add fs/promises alias module (Gus Caplan) #31553

**Node 15**
fs:
- [2002d90abd] - (SEMVER-MAJOR) fs: deprecation warning on recursive rmdir (Ian Sutherland) #35562
- [54b36e401d] - (SEMVER-MAJOR) fs: reimplement read and write streams using stream.construct (Robert Nagy) #29656

**Node 16:**
fs:
- (SEMVER-MAJOR) fs: remove permissive rmdir recursive (Antoine du Hamel) #37216
- (SEMVER-MAJOR) fs: runtime deprecate rmdir recursive option (Antoine du Hamel) #37302

**Node 17:**
fs:
- [6cd12be347] - (SEMVER-MINOR) fs: add FileHandle.prototype.readableWebStream() (James M Snell) #39331

**Node 18:**
fs
- (SEMVER-MAJOR) fs: runtime deprecate string coercion in fs.write, fs.writeFileSync (Livia Medeiros) #42607
- (SEMVER-MAJOR) child_process: improve argument validation (Rich Trott) #41305
- doc: add RafaelGSS to collaborators (RafaelGSS) #42718