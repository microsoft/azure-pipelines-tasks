# Validation Errors in the pipeline

## findNonUniqueTaskLib section
The check is looking for duplicate usage of [azure-pipelines-task-lib](https://www.npmjs.com/package/azure-pipelines-task-lib).\
The `azure-pipelines-task-lib` was designed as a singleton and there might be errors if the task uses different package versions.

If you have common npm packages as the task dependency, make sure the all dependencies have same version of `azure-pipelines-task-lib` in the task.\
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

## findIncompatibleAgentBase section
The checks will throws error if the [agent-base](https://www.npmjs.com/package/agent-base) package with version below 6.0.2 was found. \
Usually this package comes with `azure-pipelines-tasks-azure-arm-rest` package.

The `agent-base` package below 6.0.2 does not work with node 10+ and the task will fail if the cx will try to use it with proxy. \
To fix the check you need to upgrade it on 6.0.2 at least, for it, please, upgrade your common packages for a new version(if avaiable). \
Another option is to install agent-base v6+ in the task and remove existing one using the `make.json` file using path from the error.

```json
  {
    "rm": [
      {
        "items": [
          "node_modules/https-proxy-agent/node_modules/agent-base",
          "node_modules/azure-pipelines-tasks-azure-arm-rest/node_modules/agent-base"
        ],
        "options": "-Rf"
      }
    ]
  }
```
