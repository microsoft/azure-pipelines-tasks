# Node.js task lib changes

## 4.x

## 4.17.0

- Added signal handler for process execution to kill process with proper signal - [#1008](https://github.com/microsoft/azure-pipelines-task-lib/pull/1008)

## 4.15.0

- Disabled debug logs when debug mode is not enabled - [#1046](https://github.com/microsoft/azure-pipelines-task-lib/pull/1046)

## 4.14.0

- Added `isSigPipeError` function to handle Error: write EPIPE errors without causing an infinite loop on Node16+ - [#1051](https://github.com/microsoft/azure-pipelines-task-lib/pull/1051)

## 4.12.1

- Remove deasync from task-lib - [#1038](https://github.com/microsoft/azure-pipelines-task-lib/pull/1038)

### 4.12.0

- Added audit action for task.issue [#1033](https://github.com/microsoft/azure-pipelines-task-lib/pull/1033)

### 4.11.0

- Fix CodeQL fail tests [#1034](https://github.com/microsoft/azure-pipelines-task-lib/pull/1034)

### 4.10.0

- Added `correlation ID` property for logging commands [#1021](https://github.com/microsoft/azure-pipelines-task-lib/pull/1021)

### 4.9.0

- Added internal feature helpers [#1010](https://github.com/microsoft/azure-pipelines-task-lib/pull/1010)

### 4.8.0

- Added `source` property for error/warning [#1009](https://github.com/microsoft/azure-pipelines-task-lib/pull/1009)

### 4.7.0

Replaced mockery - [#989](https://github.com/microsoft/azure-pipelines-task-lib/pull/989)

Note: If you imported mockery directly from the package then you need to replace it with `azure-pipelines-task-lib/lib-mocker`, the rest code may be kept the same.

Example:

  <table>
  <tr>
  <th>Before</th>
  <th>After</th>
  </tr>
  <tr>
  <td>

  ```js
  import * as mockery from 'mockery';
  ``` 
  </td>
  <td>
  
  ```js
  import * as libMocker from 'azure-pipelines-task-lib/lib-mocker';
  ```
  </td>
  </tr>
  </table>

### 4.6.1

- Added `getNodeMajorVersion` [#979](https://github.com/microsoft/azure-pipelines-task-lib/pull/979)

### 4.6.0

- Replaced deprecated "sync-request" lib and Added new Async methods - [#932](https://github.com/microsoft/azure-pipelines-task-lib/pull/932)

### 4.5.0

- Added `execAsync` methods that return native promises. Marked `exec` methods that return promises from the Q library as deprecated [#905](https://github.com/microsoft/azure-pipelines-task-lib/pull/905)

### 4.4.0

- Add `getBoolFeatureFlag` [#936](https://github.com/microsoft/azure-pipelines-task-lib/pull/936)

### 4.3.1

- Resolve CVE-2022-24999 in qs 6.9.4 [#924](https://github.com/microsoft/azure-pipelines-task-lib/pull/924)

### 4.3.0

- Described types for `argIf` - [#920](https://github.com/microsoft/azure-pipelines-task-lib/pull/920)


### 4.2.0

- Added unhandledRejection event - [#912](https://github.com/microsoft/azure-pipelines-task-lib/pull/912)

### 4.1.0

Backported from ver.`3.4.0`:

- Include uncaught exceptions stack trace to the output logs - [#895](https://github.com/microsoft/azure-pipelines-task-lib/pull/895)

### 4.0.2

- Updated mockery because of vulnerabilities - [#878](https://github.com/microsoft/azure-pipelines-task-lib/pull/878)

### 4.0.1-preview

- Added node16 to task.schema.json - [#852](https://github.com/microsoft/azure-pipelines-task-lib/pull/852)
- fix ToolRunner - _getSpawnSyncOptions - [#873](https://github.com/microsoft/azure-pipelines-task-lib/pull/873)

### 4.0.0-preview

- Introduced support for node 16 task handler - [#844](https://github.com/microsoft/azure-pipelines-task-lib/pull/844)

## 3.x

### 3.4.0

- Updated mockery and mocha dependencies - [#875](https://github.com/microsoft/azure-pipelines-task-lib/pull/875)

- Include uncaught exceptions stack trace to the output logs - [#895](https://github.com/microsoft/azure-pipelines-task-lib/pull/895)

### 3.3.1

- Update minimatch to version 3.0.5 to fix vulnerability - [#836](https://github.com/microsoft/azure-pipelines-task-lib/pull/836)