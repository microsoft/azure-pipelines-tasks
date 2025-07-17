# Azure Pipelines Tool-Lib Testing Documentation

## Overview
This document provides a comprehensive guide for testing local modifications to the `azure-pipelines-tool-lib` package with Azure Pipeline tasks.

## Pipeline Testing
We have a pipeline to test the unit tests with `npm test` commands for all images. This pipeline was tested and validated with the local tool-lib modifications.

**Pipeline Results**: [Build #30230775](https://dev.azure.com/mseng/PipelineTools/_build/results?buildId=30230775&view=results)

## Testing using pipeline task

### Task testing with the updated tool-lib:
Once 7zip modification are made I have build that package:
```bash
npm run build
```

Then inside the `_build/` folder, `npm pack` will create `azure-pipelines-tool-lib-2.0.9.tgz`. Now this tar is usable in task repo locally to build the task locally and test in internal org in future.

### Task repo modifications:
To use the local tool-lib package in tasks, you need to:

1. **Update package.json** in the task directory to reference the local tarball:
```json
{
  "dependencies": {
    "azure-pipelines-tool-lib": "file:../../../../../../../Users/dassayantan/repo/azure-pipelines-tool-lib/_build/azure-pipelines-tool-lib-2.0.9.tgz"
  }
}
```

2. **Update task.json version** to avoid conflicts with existing versions:
```json
{
  "version": {
    "Major": 2,
    "Minor": 259,
    "Patch": 3
  }
}
```

3. **Install dependencies** for the task:
```bash
cd Tasks/UseDotNetV2
npm install
```

4. **Build the task**:
```bash
# Build specific task
node make.js build --task UseDotNetV2

# Or build multiple tasks
node make.js build --task UseDotNetV2,NodeToolV0,UseNodeV1
```

## Recommended Tasks for Testing
- **UseDotNetV2** - Use .NET Core version
- **NodeToolV0** - Node.js tool installer  
- **UseNodeV1** - Use Node.js version

These tasks are commonly used and have minimal dependencies.

## Upload Commands
```bash
# Upload tasks to Azure DevOps
tfx build tasks upload --task-path ./_build/Tasks/UseDotNetV2
tfx build tasks upload --task-path ./_build/Tasks/NodeToolV0
tfx build tasks upload --task-path ./_build/Tasks/UseNodeV1
```

## Cleanup Process
When testing is complete:
1. Revert package.json changes to original tool-lib versions
2. Run `npm install` to restore production dependencies
3. Revert task.json version increments if needed
4. Remove any debug logging from local tool-lib
