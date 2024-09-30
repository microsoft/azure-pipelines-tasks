# Node Handler Versioning

As of agent version 2.144.0, Azure Pipelines supports running tasks in a Node 10 environment in addition to the previously supported Node 6 environment.

To leverage this capability, simply add `Node10` as an execution target:

```
"execution": {
    "Node10": {
        "target": "path/to/entry"
    }
},
```

With agent version 2.206.1 Node 16 can be used.

```
"execution": {
    "Node16": {
        "target": "path/to/entry"
    }
},
```

Existing `Node` execution targets will still resolve to a Node 6 environment for now to maintain back-compat.

### Testing your task

If you use the task-lib for testing, it will automatically use the appropriate version of Node to test your tasks, downloading it if necessary.