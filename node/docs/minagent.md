# Minimum Agent Version

## Property in task.json

The `minimumAgentVersion` property in the task.json is used for routing build/release jobs to agents that satisfy the minimum version demand.

## Branching within your code

You can use the variable `agent.version` to check the agent version and branch within your code.

## Agent features relevant to task authors

Use the details below to determine when specific agent features were added:

### Commands

* `task.settaskvariable`
  - Added in 2.115.0 (related to `prejobexecution` and `postjobexecution` handler sections)
* `task.prependpath`
  - Added in 2.115.0

### Task execution handler

* General
  - `prejobexecution` and `postjobexecution` handler sections were added in 2.115.0
* `node` handler
  - Added in 1.95.1. Used node v5.10.1.
  - Updated in 2.117.0 to use node v6.10.3.
* `node10` handler
  - Added in 2.144.0. Used node v10.x
* `node16` handler
  - Added in 2.206.1. Used node v16.x
* `powershell3` handler
  - Added in 1.95.1
  - Updated in 1.97 to propagate `Data` property for endpoints

### Variables

* `Agent.TempDirectory`
  - Added in 2.115.0
* `Agent.ToolsDirectory`
  - Added in 2.115.0
* `Agent.Version`
  - Added in 2.104.1

## Agent version to TFS mapping

The following chart details the agent versions that shipped with each on-premises TFS release:

### 2.x agent

| Agent   | TFS               |
|---------|-------------------|
| 2.122.1 | TFS 2017 Update 3 |
| 2.117.x | TFS 2017 Update 2 |
| 2.112.0 | TFS 2017 Update 1 |
| 2.105.7 | TFS 2017 RTM      |


### Legacy 1.x Windows agent

| Agent   | TFS               |
|---------|-------------------|
| 1.105.7 | TFS 2017 RTM      |
| 1.95.4  | TFS 2015 Update 4 |
| 1.95.3  | TFS 2015 Update 3 |
| 1.95.1  | TFS 2015 Update 2 |
| 1.89.1  | TFS 2015 Update 1 |
| 1.83.2  | TFS 2015 RTM      |
