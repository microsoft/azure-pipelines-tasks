# Migrate Tasks to Node24

## Table of content

[Update `typescript`](#update-typescript)

[Update `@types/node`](#update-typesnode)

[Update `task-lib` and `tool-lib`](#update-task-lib-and-tool-lib)

[Add `Node24` handler](#add-node24_1-handler)

[Specify `minimumAgentVersion`](#specify-minimumagentversion)

[Test the changes](#test-the-changes)

[Feedback](#feedback)

## Update `typescript`

Update `typescript` to the `^5.7.2` version in `devDependencies` in the `package.json` file and fix type errors.

```json
"devDependencies": {
    "typescript": "^5.7.2"
}
```

## Update `@types/node`

Update `@types/node` to the `^24.10.0` version in `dependencies` in the `package.json` file.

```json
"dependencies": {
    "@types/node": "^24.10.0"
}
```

If the task does not use built-in Node.JS modules (such as `fs` or `path`) directly, remove `@types/node` from the task dependencies.

## Update `task-lib` and `tool-lib`

Update `azure-pipelines-task-lib` to `^5.2.2` and `azure-pipelines-tool-lib` to `^2.0.10` in `package.json` dependencies, if a task has these packages.

`task-lib` package uses some shared (e.g. global object) resources to operate so it may cause unexpected errors in cases when more than one version of the package is installed for a task. This happens if `task-lib` in subdependencies of the task (e.g. in some common npm packages used by the task) has a different version than in dependencies of the task itself. Same for `tool-lib`.

If the task uses `task-lib`, `tool-lib`, and some common npm packages that use `task-lib` and `tool-lib` as well, make sure `task-lib` and `tool-lib` have the same version in common npm packages as in the task itself.
As a possible solution you also can remove these package versions via the `make.json` file, for example:

```json
{
    "rm": [
        {
            "items": [
                "node_modules/any-common-npm-package/node_modules/azure-pipelines-task-lib",
                "node_modules/any-common-npm-package/node_modules/azure-pipelines-tool-lib"
            ],
            "options": "-Rf"
        }
    ]
}
```

Here is [the repo with different common npm packages](https://github.com/microsoft/azure-pipelines-tasks-common-packages) that can be used in the task.

## Add `Node24` handler

Add a new `Node24` execution handler in the `task.json` file.

<table>
<tr>
<th>From</th>
<th>To</th>
</tr>
<tr>
<td>

```json
"execution": {
    "Node16": {
        "target": "main.js",
        "argumentFormat": ""
    },
    "Node20_1": {
        "target": "main.js",
        "argumentFormat": ""
    }
}
```

</td>
<td>

```json
"execution": {
    "Node16": {
        "target": "main.js",
        "argumentFormat": ""
    },
    "Node20_1": {
        "target": "main.js",
        "argumentFormat": ""
    },
    "Node24": {
        "target": "main.js",
        "argumentFormat": ""
    }
}
```

</td>
</tr>
</table>

## Specify `minimumAgentVersion`

If several handlers are specified in the `task.json` file, the highest one will be selected from handlers that are available on the certain agent. For example, if `Node16`, `Node20_1`, and `Node24` handlers are specified in the `task.json` file, and an old version of the agent (that is going to execute the task) has `Node` (version 6), `Node10`, `Node16`, and `Node20_1` handlers, then the `Node20_1` handler will be used. At the same time, the same agent will fail to execute the task if the `Node24` handler only is specified in the `task.json` file. Therefore you should specify `minimumAgentVersion`.

`minimumAgentVersion` specified in the `task.json` file will trigger [an automatic upgrade](https://docs.microsoft.com/en-us/azure/devops/pipelines/agents/agents?view=azure-devops&tabs=browser#agent-version-and-upgrades) for agents less than the specified version.

* [Agent version `2.144.0`](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v2.144.0) is the first version that supports `Node10` handler. So set `minimumAgentVersion` at least to `2.144.0`.

```json
"minimumAgentVersion": "2.144.0"
```

* [Agent version `2.209.0`](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v2.209.0) is the first version that supports `Node16` handler. If you want to run the task using at least `Node16` handler, set `minimumAgentVersion` to `2.209.0`.

```json
"minimumAgentVersion": "2.209.0"
```

* [Agent version `3.232.1`](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v3.232.1) is the first version that supports `Node20_1` handler. If you want to run the task using `Node20_1` handler for sure, set `minimumAgentVersion` to `3.232.1`.

```json
"minimumAgentVersion": "3.232.1"
```

* [Agent version `4.265.1`](https://github.com/microsoft/azure-pipelines-agent/releases/tag/v3.250.0) is the first version that supports `Node24_1` handler. If you want to run the task using `Node24` handler for sure, set `minimumAgentVersion` to `4.265.1`.

```json
"minimumAgentVersion": "4.265.1"
```

## Test the changes

Test that the task works correctly on each execution handler specified in the `task.json` file.

How to test the changes:
* Run unit tests (they should pass on each handler specified in the `task.json` file).
* Run pipeline with the task using `Node10` handler (if it is specified in the `task.json` file).
* Run pipeline with the task using `Node16` handler (if it is specified in the `task.json` file).
* Run pipeline with the task using `Node20_1` handler (if it is specified in the `task.json` file).
* Run pipeline with the task using `Node24` handler.

To force the agent to use Node 10 handler for all Node-based tasks, set the pipeline variable / the agent environment variable `AGENT_USE_NODE10` to `true`.

To force the agent to use Node 24 handler for all Node-based tasks, set the pipeline variable / the agent environment variable `AGENT_USE_NODE24` to `true`.

### Advanced Node24 Handler Configuration

For more granular control over Node24 handler selection, you can use the `AGENT_USE_NODE24_WITH_HANDLER_DATA` feature flag. This feature flag enables conditional Node24 usage based on whether the task defines a Node24 handler in its execution configuration.

#### AGENT_USE_NODE24_WITH_HANDLER_DATA Feature Flag

This feature flag forces the agent to use Node24 **only** if the task has handler data for it (i.e., the task's `task.json` includes a `Node24` execution handler). Unlike `AGENT_USE_NODE24` which forces Node24 for all Node-based tasks regardless of their handler configuration, `AGENT_USE_NODE24_WITH_HANDLER_DATA` provides intelligent selection:

- **If enabled and task has Node24 handler**: Uses Node24
- **If enabled but task doesn't have Node24 handler**: Falls back to the next available handler (typically Node20_1)
- **If disabled**: Uses standard handler selection logic

#### Configuration Methods

The feature flag can be configured through multiple sources (in order of precedence):

1. **Pipeline Feature Flag** (YAML):
   ```yaml
   variables:
     system.pipelineFeatures: 'UseNode24withHandlerData'
   ```

2. **Agent Runtime Variable**:
   ```yaml
   variables:
     AGENT_USE_NODE24_WITH_HANDLER_DATA: 'true'
   ```

3. **Agent Environment Variable**:
   Set `AGENT_USE_NODE24_WITH_HANDLER_DATA=true` in the agent's environment variables.

#### Use Cases

- **Gradual Migration**: Test Node24 compatibility only for tasks that explicitly support it
- **Mixed Environments**: Run newer tasks on Node24 while keeping older tasks on their preferred handlers
- **Compatibility Testing**: Validate Node24 behavior without forcing all tasks to use it

#### Agent Version Requirements

- **Minimum Agent Version**: `4.265.1` (first version supporting Node24 handler)
- **Feature Flag Support**: Available in agent versions that include the `UseNode24withHandlerData` knob configuration

#### Example Usage

```yaml
# Pipeline that uses conditional Node24 for compatible tasks
variables:
  AGENT_USE_NODE24_WITH_HANDLER_DATA: 'true'

steps:
- task: TaskWithNode24Handler@1  # Will use Node24
- task: OlderTaskWithoutNode24@1  # Will use Node20_1 or highest available
```

## Feedback

If you run into some issues while migrating to Node 24, please create a ticket with the label `node-migration: Node24`.
