# Fix CG (Component Governance) Bug

This skill helps fix Component Governance security alerts reported as Azure DevOps work items for the azure-pipelines-tasks repository.

## When to Use

Use this skill when asked to fix a CG bug, CG alert, or Component Governance vulnerability. The user will provide either:
- An ADO work item URL (e.g., `https://dev.azure.com/mseng/AzureDevOps/_workitems/edit/XXXXXX`)
- A CG alert URL (e.g., `https://dev.azure.com/mseng/{projectId}/_componentGovernance/{registrationId}?alertId=XXXXX`)
- A package name and target version directly

## Prerequisites

- `az` CLI must be installed and logged in (`az login`)
- `az devops` extension must be installed (`az extension add --name azure-devops`)
- The ADO organization is `mseng` and the project is `AzureDevOps`

## Step-by-Step Process

### Step 1: Authenticate and Get CG Alert Details

**Note**: You must be logged in to Azure CLI first. Check with `az account show` and if needed, run `az login`.

If given an ADO work item URL, extract the work item ID and fetch it:

```bash
# Configure defaults for the org (note: --project is NOT supported by az boards work-item show)
az devops configure --defaults organization=https://dev.azure.com/mseng

# Fetch the work item details and extract description
az boards work-item show --id <WORK_ITEM_ID> --org https://dev.azure.com/mseng --output json | jq -r '.fields."System.Description"'
```

From the work item description (HTML content):
- Look for a link to the CG alert page
- The CG alert link looks like: `https://dev.azure.com/mseng//{projectId}/_componentGovernance/{repositoryId}?alertId={alertId}`
- Extract the `projectId`, `repositoryId`, and `alertId` from that URL

Example from output: `https://dev.azure.com/mseng//b924d696-3eae-4116-8443-9a18392d8544/_componentGovernance/33?alertId=385046`
- projectId: `b924d696-3eae-4116-8443-9a18392d8544`
- repositoryId: `33`
- alertId: `385046`

### Step 2: Get CG Alert Details via API

**Important**: Get the Azure DevOps access token once and reuse it for all subsequent API calls to avoid unnecessary token requests:

```bash
# Get an access token (use the Azure DevOps resource ID)
# Store it in the TOKEN variable for reuse throughout the session
TOKEN=$(az account get-access-token --resource "499b84ac-1321-427f-aa17-267ca6975798" --query accessToken -o tsv)
```

Use the Component Governance API to fetch the alert details:

```bash
# Fetch the CG alert details using the Branches Alerts API endpoint (recommended)
# This endpoint provides more detailed information including action items
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://governance.dev.azure.com/mseng/{projectId}/_apis/ComponentGovernance/GovernedRepositories/{repositoryId}/Branches/master/Alerts/{alertId}?pipelinesTrackingFilter=0" \
  | jq '{component: .component, title: .title, severity: .severity, actionItems: .actionItems}'

# Alternative: Use the direct Alerts endpoint
# curl -s -H "Authorization: Bearer $TOKEN" \
#   "https://governance.dev.azure.com/mseng/{projectId}/_apis/ComponentGovernance/GovernedRepositories/{repositoryId}/Alerts/{alertId}?api-version=7.1-preview.1"
```

**Example with actual values:**
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://governance.dev.azure.com/mseng/b924d696-3eae-4116-8443-9a18392d8544/_apis/ComponentGovernance/GovernedRepositories/33/Branches/master/Alerts/385046?pipelinesTrackingFilter=0" \
  | jq '{component: .component, title: .title, severity: .severity, actionItems: .actionItems}'
```

From the alert JSON response, extract:
- **Vulnerable package name**: `.component.displayName` (e.g., "minimatch")
- **Current vulnerable version**: `.component.displayVersion` (e.g., "4.2.3")
- **Recommended/fixed version**: `.actionItems` field describes the fix (e.g., "Upgrade minimatch from 4.2.3 to 4.2.5")
- **Severity**: `.severity` (e.g., "high")
- **CVE identifier**: `.title` (e.g., "CVE-2026-27903")
- **Description**: `.description` contains detailed vulnerability information
- **Package type**: `.component.type` (e.g., "npm")
- **Advisory links**: `.resources` contains links to GitHub advisories and CVE details

### Step 2a: Get All Affected Locations (Optional but Recommended)

To programmatically find all tasks/locations where the vulnerable component is used, retrieve a production snapshot ID from the Component Governance API. Note that CG alerts are not tied to a specific snapshot - they represent vulnerabilities detected across production snapshots.

```bash
# Get the most recent production snapshot type ID dynamically
SNAPSHOT_TYPE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://governance.dev.azure.com/mseng/{projectId}/_apis/ComponentGovernance/GovernedRepositories/{repositoryId}/Branches/master" \
  | jq -r '.snapshotTypes[] | select(.externalTrackingState == "production") | "\(.latestScanDate) \(.typeId)"' \
  | sort -r | head -1 | awk '{print $2}')

echo "Using snapshot type ID: $SNAPSHOT_TYPE_ID"

# Get all component locations from Component Governance
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://governance.dev.azure.com/mseng/{projectId}/_apis/ComponentGovernance/GovernedRepositories/{repositoryId}/ComponentLocations?snapshotTypeId=${SNAPSHOT_TYPE_ID}" \
  > /tmp/locations.json

# Extract affected task names for the vulnerable package
# Replace <PACKAGE_NAME> and <VERSION> with actual values (e.g., "minimatch" and "4.2.3")
cat /tmp/locations.json | jq -r '.value["<PACKAGE_NAME> <VERSION> -Npm"][]' \
  | grep -E 'Tasks/[^/]+/' \
  | sed 's|.*/Tasks/\([^/]*\)/.*|\1|' \
  | sort | uniq
```

**Example with actual values:**
```bash
# Get the latest production snapshot ID
SNAPSHOT_TYPE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://governance.dev.azure.com/mseng/b924d696-3eae-4116-8443-9a18392d8544/_apis/ComponentGovernance/GovernedRepositories/33/Branches/master" \
  | jq -r '.snapshotTypes[] | select(.externalTrackingState == "production") | "\(.latestScanDate) \(.typeId)"' \
  | sort -r | head -1 | awk '{print $2}')

echo "Using snapshot type ID: $SNAPSHOT_TYPE_ID"

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://governance.dev.azure.com/mseng/b924d696-3eae-4116-8443-9a18392d8544/_apis/ComponentGovernance/GovernedRepositories/33/ComponentLocations?snapshotTypeId=${SNAPSHOT_TYPE_ID}" \
  > /tmp/locations.json

# Find all tasks using minimatch 4.2.3
cat /tmp/locations.json | jq -r '.value["minimatch 4.2.3 -Npm"][]' \
  | grep -E 'Tasks/[^/]+/' \
  | sed 's|.*/Tasks/\([^/]*\)/.*|\1|' \
  | sort | uniq
```

**Note**: The snapshot type ID changes over time as new builds are scanned. Always retrieve it dynamically from the `/Branches/master` endpoint rather than hardcoding it. The command above selects the most recent production snapshot by sorting by `latestScanDate`.

**Important Considerations:**
- **Alerts vs. Snapshots**: Component Governance alerts are not tied to a specific snapshot. An alert represents a vulnerability that exists in your codebase, and CG scans multiple snapshots (from different build phases) to detect it.
- **Multiple Production Snapshots**: Multiple production snapshots may exist from different build phases (e.g., "Build all tasks (Windows)", "Create GitHub Release", "Courtesy Push"). All production snapshots from the same date typically contain the same dependency information.
- **Using Latest Snapshot**: Using the most recent production snapshot is usually sufficient because it reflects the current state of the master branch. The component locations will show all places where the vulnerable package is used.
- **Comprehensive Coverage**: If you need to be extra thorough or if the latest snapshot seems incomplete, you can query component locations for all production snapshots:
  ```bash
  # Get all production snapshot IDs and check each one
  curl -s -H "Authorization: Bearer $TOKEN" \
    "https://governance.dev.azure.com/mseng/{projectId}/_apis/ComponentGovernance/GovernedRepositories/{repositoryId}/Branches/master" \
    | jq -r '.snapshotTypes[] | select(.externalTrackingState == "production") | .typeId'
  ```

This will give you a definitive list of all task directories that use the vulnerable package, saving you from manual searching.

### Step 3: Find Affected Tasks in the Repository

Search for which tasks depend on the vulnerable package:

```bash
# Search for direct dependencies in task package.json files
grep -r '"<PACKAGE_NAME>"' Tasks/*/package.json

# Search in package-lock.json files for transitive dependencies
grep -r '"<PACKAGE_NAME>"' Tasks/*/package-lock.json

# Also check if it's already in overrides
grep -r '"<PACKAGE_NAME>"' Tasks/*/package.json | grep -i override
```

For each affected task, determine:
1. **Is it a direct dependency?** → Listed in the `dependencies` section of the task's `package.json`
2. **Is it a transitive dependency?** → Only appears in `package-lock.json` or `node_modules/`
   - If transitive, identify which direct dependency pulls it in:
     ```bash
     # In the task directory, check the dependency tree
     cd Tasks/<TaskName>
     npm ls <PACKAGE_NAME>
     ```

### Step 4: Create a Feature Branch

**Important**: Never commit directly to master/main. Always create a feature branch for CG fixes.

Create a new branch following the naming convention `CopilotSkill/CGFix/<WorkItemID>`:

```bash
# Create and checkout a new branch for the CG fix
git checkout -b CopilotSkill/CGFix/<WORK_ITEM_ID>
```

**Example:**
```bash
# For work item 2362243
git checkout -b CopilotSkill/CGFix/2362243
```

This ensures your changes are isolated and can be reviewed via pull request before merging to the main branch.

### Step 5: Determine the Fix Strategy

Based on the dependency type, apply the appropriate fix:

#### Case A: Direct Dependency
If the vulnerable package is a direct dependency in the task's `package.json`:

1. Update the version in `package.json`:
   ```json
   "dependencies": {
     "<PACKAGE_NAME>": "^<SAFE_VERSION>"
   }
   ```
2. Run `npm install` in the task directory to update `package-lock.json`

#### Case B: Transitive Dependency via an Owned Common Package
If the vulnerable package comes through one of our owned packages listed below, the fix must happen in the source repo first.

**How to identify owned packages:** Match the dependency name against these patterns. Some packages have been renamed over time, so both old and new names must be recognized.

**Owned packages from `azure-pipelines-tasks-common-packages` repo** (https://github.com/microsoft/azure-pipelines-tasks-common-packages):

| Pattern | Known names | Source folder |
|---|---|---|
| `*artifacts-common*` | `azure-pipelines-tasks-artifacts-common` | `artifacts-common` |
| `*az-blobstorage-provider*` | `azp-tasks-az-blobstorage-provider` | `az-blobstorage-provider` |
| `*azure-arm-rest*` | `azure-pipelines-tasks-azure-arm-rest` | `azure-arm-rest` |
| `*azurermdeploycommon*` | `azure-pipelines-tasks-azurermdeploycommon` | `azurermdeploycommon` |
| `*codeanalysis-common*` | `azure-pipelines-tasks-codeanalysis-common` | `codeanalysis-common` |
| `*codecoverage-tools*` | `azure-pipelines-tasks-codecoverage-tools` | `codecoverage-tools` |
| `*docker-common*` | `azure-pipelines-tasks-docker-common` | `docker-common` |
| `*ios-signing-common*` | `azure-pipelines-tasks-ios-signing-common` | `ios-signing-common` |
| `*java-common*` | `azure-pipelines-tasks-java-common` | `java-common` |
| `*k8s-common*` or `*kubernetes-common*` | `azure-pipelines-tasks-k8s-common` (current npm name), `azure-pipelines-tasks-kubernetes-common` (old name, still used in some tasks) | `kubernetes-common` |
| `*msbuildhelpers*` | `azure-pipelines-tasks-msbuildhelpers` | `msbuildhelpers` |
| `*packaging-common*` | `azure-pipelines-tasks-packaging-common`, `azure-pipelines-tasks-packaging-common-v3` (legacy variant) | `packaging-common` |
| `*securefiles-common*` | `azure-pipelines-tasks-securefiles-common` | `securefiles-common` |
| `*utility-common*` | `azure-pipelines-tasks-utility-common` | `utility-common` |
| `*webdeployment-common*` | `azure-pipelines-tasks-webdeployment-common` | `webdeployment-common` |

**Owned packages from `azure-pipelines-task-lib` repo** (https://github.com/microsoft/azure-pipelines-task-lib):

| Pattern | Known names |
|---|---|
| `azure-pipelines-task-lib` | `azure-pipelines-task-lib` |

**Owned packages from `azure-pipelines-tool-lib` repo** (https://github.com/microsoft/azure-pipelines-tool-lib):

| Pattern | Known names |
|---|---|
| `azure-pipelines-tool-lib` | `azure-pipelines-tool-lib` |

**Matching logic:** When checking if a dependency is an owned package, use pattern/substring matching rather than exact name matching. For example, if `npm ls` shows the vulnerable package comes through a package containing `k8s-common` OR `kubernetes-common`, treat it as an owned package.

If the vulnerable package is a transitive dependency brought in by any of the above:

**STOP and inform the user:**
> The vulnerable package `<PACKAGE_NAME>` is a transitive dependency brought in by `<COMMON_PACKAGE_NAME>`. This common package is maintained in the separate repository: https://github.com/microsoft/azure-pipelines-tasks-common-packages
>
> To fix this:
> 1. First, fix the vulnerability in the common package repo by updating `<PACKAGE_NAME>` there
> 2. Publish a new version of the common package
> 3. Then come back here and update the common package version in the affected tasks

If the user confirms the common package has already been fixed and a new version published, update the common package version in the affected tasks' `package.json` files.

#### Case C: Transitive Dependency via a Third-Party Package (not owned by us)
If the vulnerable package is a transitive dependency through a third-party npm package:

1. Add an `overrides` entry in the task's `package.json`:
   ```json
   "overrides": {
     "<PACKAGE_NAME>": "^<SAFE_VERSION>"
   }
   ```
   If the `overrides` section already exists, add the new entry to it. Do NOT replace existing overrides.

2. **Run `npm install`** in each task directory to regenerate `package-lock.json`:
   ```bash
   cd Tasks/<TaskName>
   npm install
   cd ../..
   ```
   
   This updates the lock file to reflect the fixed dependency versions. **You must commit the updated `package-lock.json` files.**
   
   **Note**: `npm install` may fail locally due to authentication issues with the private Azure DevOps npm registry. This is expected and acceptable - the CI/CD pipeline will properly authenticate and validate the changes. If you cannot run `npm install` locally, you can skip this step and let CI handle it, but still include `package-lock.json` files in your commit if they were updated.

### Step 6: Verify the Fix

For each affected task:

```bash
cd Tasks/<TaskName>

# Install dependencies with the fix
npm install

# Verify the vulnerable version is gone
npm ls <PACKAGE_NAME>

# The output should show the safe version, not the vulnerable one
```

### Step 7: Bump Task Version

**Critical**: After fixing dependencies, you **MUST** bump the task version in both `task.json` and `task.loc.json`.

#### Automated Approach (Recommended)

**Option 1: Use Copilot (Simplest)**

This repository has a Copilot hook (`.github/hooks/bump-task-version.sh`) that automatically provides version bumping guidance when you edit task files. Simply ask Copilot to bump the task version, and it will:

1. Fetch the current sprint information from `https://whatsprintis.it/?json`
2. Calculate the target Minor version based on sprint rules
3. Update both `task.json` and `task.loc.json` accordingly

**Example prompt:**
```
Bump the task version for ExtractFilesV1
```

**Option 2: Use make.js bump Command**

The build system can automatically bump versions for all modified tasks:

```bash
# Bump versions for all tasks that have changed since the last commit
node make.js bump

# You can also specify a sprint number manually (optional)
node make.js bump --sprint 271
```

This command will:
- Detect which tasks have been modified
- Fetch the current sprint information
- Apply the sprint-based versioning rules automatically
- Update both `task.json` and `task.loc.json` for each affected task

#### Manual Approach

If you need to bump the version manually, follow these sprint-based rules:

1. **Fetch current sprint information:**
   ```bash
   curl -s 'https://whatsprintis.it/?json' | jq '{sprint: .sprint, week: .week}'
   ```

2. **Determine target Minor version:**
   - If past Tuesday of week 3 (i.e., week > 3, or week == 3 and today is after Tuesday): `Minor = sprint + 1`
   - Otherwise: `Minor = sprint` (current)

3. **Apply versioning rules:**
   - If the task's current `Minor` already equals the target: **increment `Patch` by 1**
   - If the task's current `Minor` differs from the target: **set `Minor` to target and reset `Patch` to 0**

4. **Update BOTH files with the same version:**
   - `Tasks/<TaskName>/task.json`
   - `Tasks/<TaskName>/task.loc.json`

**Example:**
```json
"version": {
  "Major": 1,
  "Minor": 271,  // Target sprint
  "Patch": 0     // Reset to 0 if Minor changed, or increment if Minor stayed same
}
```

**Important Notes:**
- **Never increment Major** — major version changes require creating a new task directory (e.g., TaskV3 → TaskV4)
- Always update **both** `task.json` and `task.loc.json` with identical versions
- See [task version bumping guide](https://github.com/microsoft/azure-pipelines-tasks/tree/master/docs/taskversionbumping.md) for more details


### Step 8: Build and Test

Build the affected task to ensure the dependency update doesn't break anything:

```bash
# Build the base task
node make.js build --task <TaskName>

# If the task has build configs (e.g., Node24, Wif), build those too
# Check _generated/_buildConfigs/<TaskName>/ to see available configs
# Note: LocalPackages configs can be skipped for CG fixes
node make.js build --task <TaskName> --configs <ConfigName>

# Run unit tests
node make.js test --task <TaskName> --suite L0
```

**Example for tasks with Node24 configs:**
```bash
# Build base ExtractFilesV1
node make.js build --task ExtractFilesV1

# Build Node24 config if it exists (check _generated/_buildConfigs/ExtractFilesV1/)
# Note: ExtractFilesV1 only has LocalPackages config which can be skipped

# Run tests
node make.js test --task ExtractFilesV1 --suite L0
```

**Note**: The CI/CD pipeline will build all configs with proper authentication. Local builds may fail due to private npm registry authentication, but that's expected.

### Step 9: Create a Commit and Push

Create a commit with a clear message on your feature branch:

```bash
# Stage the changes (include package-lock.json)
git add Tasks/<TaskName>/package.json Tasks/<TaskName>/package-lock.json Tasks/<TaskName>/task.json Tasks/<TaskName>/task.loc.json

# Commit with a descriptive message
git commit -m "Fix CG alert: update <PACKAGE_NAME> to <SAFE_VERSION> in <TaskName>

- Updated <dependency-type> dependency to address <CVE/vulnerability>
- ADO Work Item: #<WORK_ITEM_ID>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

# Push the branch to the remote repository
git push origin CopilotSkill/CGFix/<WORK_ITEM_ID>
```

**Example:**
```bash
git add Tasks/ExtractFilesV1/package.json Tasks/ExtractFilesV1/package-lock.json Tasks/ExtractFilesV1/task.json Tasks/ExtractFilesV1/task.loc.json
git commit -m "Fix CG alert: update minimatch to 4.2.5 in ExtractFilesV1

- Updated direct dependency to address CVE-2026-27903
- ADO Work Item: #2362243

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

git push origin CopilotSkill/CGFix/2362243
```

## Step 10: Create Pull Request

After pushing the branch, create a pull request to merge your changes. The PR must follow the repository's pull request template.

### Option A: Using GitHub MCP Tools (Automated)

Use the `mcp_github_create_pull_request` tool to create a PR programmatically:

```bash
# The tool will automatically populate the PR template with:
# - Context: ADO work item link and CVE details
# - Task names
# - Description of changes
# - Risk assessment (typically Low for dependency updates)
# - Documentation/testing requirements
# - Checklist items
```

**Key PR Details to Include:**
- **Title**: `Fix CG alert: update <package> to <version> in <TaskNames>`
- **Context Section**: Use `AB#<WORK_ITEM_ID>` format (e.g., `AB#2362243`) for automatic Azure Boards linking, include CVE ID, severity, vulnerability type
- **Risk Assessment**: Low for minor dependency updates
- **Change Behind Feature Flag**: No (dependency updates don't use feature flags)
- **Documentation Changes**: No (for internal dependency updates)
- **Unit Tests**: No new tests needed (existing tests validate functionality)
- **Rollback**: Yes (revert PR if issues found)
- **Dependency Impact**: Yes (CG identified affected tasks, regression tests will validate)

### Option B: Manual PR Creation

1. Push the branch: `git push origin CopilotSkill/CGFix/<WORK_ITEM_ID>`
2. GitHub will output a PR creation URL
3. Visit the URL or go to: `https://github.com/microsoft/azure-pipelines-tasks/pull/new/CopilotSkill/CGFix/<WORK_ITEM_ID>`
4. Fill out the PR template with vulnerability details (use `AB#<WORK_ITEM_ID>` for automatic Azure Boards linking)
5. Complete all checklist items

**Example PR Title:**
```
Fix CG alert: update minimatch to 4.2.5 in ExtractFilesV1 and XamarinTestCloudV1
```

**Example Context Section:**
```markdown
This PR fixes a Component Governance security alert identified in AB#2362243.

**Vulnerability Details:**
- **CVE ID**: CVE-2026-27903
- **Severity**: High (7.5 CVSS)
- **Type**: ReDoS (Regular Expression Denial of Service)
- **Affected Package**: minimatch 4.2.3
- **Fix Version**: minimatch 4.2.5
```

**Note**: Use the `AB#<WORK_ITEM_ID>` format (e.g., `AB#2362243`) to automatically link Azure DevOps work items to GitHub PRs. This is the [Azure Boards linking syntax](https://learn.microsoft.com/en-us/azure/devops/boards/github/link-to-from-github?view=azure-devops) that creates bidirectional references between GitHub and ADO.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Common Package Override Patterns

The repository already uses `overrides` in many task `package.json` files. Here's the established pattern:

```json
{
  "dependencies": {
    "azure-pipelines-task-lib": "^5.2.4",
    "some-other-package": "^1.0.0"
  },
  "overrides": {
    "form-data": "^4.0.4",
    "<new-vulnerable-package>": "^<safe-version>"
  }
}
```

## Notes

- The ADO org for this repo is `mseng`, project is `AzureDevOps`
- Common packages (`azure-pipelines-tasks-*-common`) are maintained at: https://github.com/microsoft/azure-pipelines-tasks-common-packages
- The script `scripts/Set-TasksNpmDependency.ps1` can help with bulk dependency updates across multiple tasks if needed
- Always run `npm install` after modifying `package.json` to regenerate `package-lock.json`
- Multiple tasks may be affected by the same CG alert — fix all of them
- The `pnpm-workspace.yaml` defines workspace packages under `Tasks/*`
