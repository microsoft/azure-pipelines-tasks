# Upgrading Tasks to Node 10

1. Upgrade to typescript 4.0.2 and fix type errors
Add the following to the package.json
```
  "devDependencies": {
    "typescript": "^4.0.0"
  }
``` 
2. Replace typings with @types
Delete `typings` folders and `typings.json` files
Add @types packages to package.json dependencies.

```
  "dependencies": {
    "@types/node": "^10.17.0",
    "@types/mocha": "^5.2.7",
    "@types/uuid": "^8.3.0"
    ...
  }
```
3. Upgrade `azure-pipelines-task-lib` to `^3.1.0` in package.json dependencies.

4. Change execution handlers in task.json from "Node" to "Node10"
_Note: the "target" property should be the main file targetted for the task to execute._
```
  "execution": {
    "Node": {
      "target": "bash.js",
      "argumentFormat": ""
    }
```
to
```
  "execution": {
    "Node10": {
      "target": "bash.js",
      "argumentFormat": ""
    }
```

5. Upgrade any additional dependencies that may be incompatible with Node 10.
An example is the `sync-request` package, which needs to be upgraded to the latest version from v3.0.1
See some additional dependency issues below.

6. Delete or migrate any tests in the Tests-Legacy folder for the task. These tests are no longer supported on Node 10. Add unit tests if they don't already exist :)

7. Thoroughly test tasks with unit tests and on an actual agent. The build agent now supports Node 10, so testing can be done on live versions of Azure DevOps.
- Ensure tests have good L0 coverage
- Add build canary tests if they are missing

8. Bumping the minimum agent version is not required, as the server will enforce a minimum version for pipelines containing Node 10 tasks.

## Common packages dependent on azure-pipeline-task-lib

- use the latest major version of a "common package" at `common-npm-packages` folder) which depends on the `azure-pipelines-task-lib` package with `^3.1.0` version.

The task-lib package uses some shared (e.g. global object) resources to operate so it may cause unexpected errors in cases when more than one version of the package is installed for a task. It happens in the case of a child package's task-lib dependency has a different version than a task's `task-lib` has.

If you are planning to move some common package to common-npm-packages directory - please note that you need to update all necessary paths in this package ([example of such path](https://github.com/microsoft/azure-pipelines-tasks/blob/master/common-npm-packages/packaging-common/Tests/MockHelper.ts#L44))

# List of known dependency issues

### fs module

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