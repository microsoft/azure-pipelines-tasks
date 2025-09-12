# Azure Pipelines Tasks - Copilot Instructions

This repository contains the in-the-box tasks for Azure Pipelines and Team Foundation Server. These instructions will help you understand how to build, test, and deploy tasks effectively.

## Repository Overview

This repo provides open examples of how Azure Pipelines tasks are written and can help you write custom tasks for upload to your account or server. Tasks are tool runners that know how to execute tools like MSBuild, VSTest, etc., handle return codes, process stdout/stderr, write timeline records, and access credentials for Azure Pipelines integration.

## Prerequisites

### Required Tools
- **Node.js**: Version 20 or higher is required (minimum 20.17.0)
- **NPM**: Version 5.6.0 or higher
- **TypeScript**: 4.0.2 or higher (automatically validated during build)
- **.NET SDK**: 8.0.100 (automatically downloaded during build if needed)

### Verification Commands
```bash
node -v && npm -v  # Should show Node 20+ and NPM 5.6+
```

### Initial Setup
```bash
# Install repository dependencies (required before building any tasks)
npm install
```

## Building Tasks

### Build System Overview
The repository uses a custom build system (`make.js`) that:
- Compiles TypeScript to JavaScript
- Handles task dependencies and external tools
- Generates localization files (`task.loc.json` and strings)
- Validates task definitions
- Copies resources to the `_build` directory

### Build Commands

#### Build a Specific Task (Recommended)
```bash
# From repository root
node make.js build --task <TaskName>

# Example: Build DotNetCoreCLIV2 task
node make.js build --task DotNetCoreCLIV2

# From task directory
cd Tasks/<TaskName>
npm run build
```

#### Build All Tasks (Slow - Can Take 30+ Minutes)
```bash
npm run build
# OR
node make.js build
```

#### Server Build (For CI Environments)
```bash
node make.js serverBuild --task <TaskName>
```

#### Build with Bypassed NPM Audit
```bash
node make.js build --task <TaskName> --BypassNpmAudit
```

#### Debug Build (For Agent Debugging)
```bash
node make.js build --task <TaskName> --debug-agent-dir "<path-to-agent-directory>"
```

### Build Output
Built tasks are located in: `_build/Tasks/<TaskName>/`

The build process creates:
- Compiled JavaScript files from TypeScript source
- `task.json` and `task.loc.json` (localization metadata)
- Resource files (PowerShell scripts, icons, etc.)
- Node modules and dependencies
- External tools and dependencies

## Testing Tasks

### Test Types

#### Unit Tests (L0)
Fast tests that mock external dependencies:
```bash
# Test specific task
node make.js test --task <TaskName> --suite L0

# Test all built tasks
npm test
# OR
node make.js test
```

#### Integration Tests (L1)
Tests that use real external tools but avoid network calls:
```bash
node make.js test --task <TaskName> --suite L1
```

#### End-to-End Tests (L2)
Full integration tests with real services:
```bash
node make.js test --task <TaskName> --suite L2
```

#### Legacy Tests
```bash
# All legacy tests
node make.js testLegacy

# Specific task legacy tests
node make.js testLegacy --task <TaskName>
```

### Test Debugging
Set environment variable for additional logging:
```bash
export TASK_TEST_TRACE=1
node make.js test --task <TaskName>
```

## End-to-End Testing and Deployment

### Prepare Task for E2E Testing

1. **Modify Task GUID** (Critical - Prevents Conflicts)
   ```bash
   # Edit both task.json and task.loc.json
   # Change the "id" field to a unique test GUID
   # Use online GUID generator or: uuidgen (macOS/Linux)
   ```

2. **Optional: Modify Task Name**
   ```bash
   # Edit task.json - change "name" field for easy YAML referencing
   # Example: "DotNetCoreCLI" -> "DotNetCoreCLITest"
   ```

3. **Build the Task**
   ```bash
   node make.js build --task <TaskName>
   ```

### Deploy Task to Azure DevOps

#### Install TFX CLI
```bash
# Linux/macOS
sudo npm install -g tfx-cli

# Windows
npm install -g tfx-cli
```

#### Create Personal Access Token
1. Navigate to Azure DevOps → User Settings → Personal Access Tokens
2. Click "+ New Token"
3. Name your token
4. Choose "Custom Defined" → Select "Environment (Read & Write)" OR "Full Access"
5. Copy and save the token securely

#### Upload Task

**Method 1: Interactive Login**
```bash
# Login to Azure DevOps
tfx login
# Enter Service URL: https://<YOUR_ORGANISATION>.visualstudio.com/defaultcollection
# Enter your Personal Access Token

# Upload task
tfx build tasks upload --task-path _build/Tasks/<TaskName>
```

**Method 2: One Command Upload**
```bash
tfx build tasks upload \
  -u https://<YOUR_ORGANISATION>.visualstudio.com/DefaultCollection \
  -t <YOUR_PERSONAL_ACCESS_TOKEN> \
  --task-path _build/Tasks/<TaskName>
```

#### Important Notes for Local Azure DevOps Server
- Default collections may require old domain format
- Use: `https://<YOUR_ORGANISATION>.vsts.me/DefaultCollection`
- Even if your org is on newer domains like `codedev.ms`

### Testing in Azure Pipelines

After uploading, create a test pipeline:
```yaml
trigger: none

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: YourTestTaskName@1
  inputs:
    # Your task inputs here
```

## Available CLI Commands

```bash
node make.js <command> [options]

Commands:
  build          # Build tasks for development
  serverBuild    # Build with full validation (CI)
  buildandtest   # Build and run tests
  test           # Run tests for built tasks
  testLegacy     # Run legacy tests
  clean          # Clean build directories
  package        # Package tasks for distribution
  bump           # Bump task versions
  gendocs        # Generate documentation
```

## Task Structure

### Key Files
- `task.json` - Task definition and metadata
- `task.loc.json` - Localization template (auto-generated)
- `package.json` - Node dependencies and build scripts
- `tsconfig.json` - TypeScript configuration
- `*.ts` - TypeScript source files
- `Tests/` - Test files and test data
- `Strings/` - Localization files

### Common Dependencies
- `azure-pipelines-task-lib` - Core task library
- `azure-pipelines-tool-lib` - Tool installation library
- Various task-specific common packages

## Development Workflow

1. **Setup Environment**
   ```bash
   npm install
   ```

2. **Make Changes**
   - Edit TypeScript source files
   - Update task.json if needed
   - Add/update tests

3. **Build and Test**
   ```bash
   node make.js build --task <TaskName>
   node make.js test --task <TaskName> --suite L0
   ```

4. **E2E Testing**
   - Modify GUID in task.json and task.loc.json
   - Build and upload to test Azure DevOps org
   - Create test pipeline and validate functionality

5. **Submit Changes**
   - Ensure all tests pass
   - Check in generated files (task.loc.json, strings)
   - Submit pull request

## Troubleshooting

### Common Build Issues
- **Missing dependencies**: Run `npm install` in repository root
- **Node version**: Ensure Node.js 20+ is installed
- **TypeScript errors**: Check tsconfig.json and update code
- **External tool failures**: Check network connectivity

### Common Test Issues
- **Mock failures**: Verify mock data in Tests/ directory
- **Environment variables**: Set TASK_TEST_TRACE=1 for debugging
- **Tool dependencies**: Ensure required tools are available

### Upload Issues
- **Authentication**: Verify PAT has correct permissions
- **URL format**: Use correct collection URL format
- **GUID conflicts**: Ensure unique GUID for test tasks

## Best Practices

1. **Always test locally** before uploading to Azure DevOps
2. **Use unique GUIDs** for test tasks to avoid conflicts
3. **Include comprehensive unit tests** (L0 suite)
4. **Follow existing task patterns** in the repository
5. **Update localization files** when changing task.json
6. **Test cross-platform** if task supports multiple OS
7. **Document task inputs/outputs** in task.json descriptions

## Resources

- [Azure Pipelines Task Documentation](https://docs.microsoft.com/azure/devops/pipelines/tasks/)
- [Writing Custom Tasks](https://docs.microsoft.com/azure/devops/extend/develop/add-build-task)
- [TFS CLI Documentation](https://github.com/Microsoft/tfs-cli)
- [Task Library API](https://github.com/Microsoft/azure-pipelines-task-lib)
