# TwineAuthenticateV1 - End-to-End (L2) Testing Guide

## Overview

L2 tests are **end-to-end tests** that interact with real Azure DevOps services. Unlike L0 (unit) and L1 (integration) tests, L2 tests require:

- ✅ Real Azure DevOps organization
- ✅ Active Azure Artifacts feeds
- ✅ Valid access tokens
- ✅ Python and Twine installed
- ✅ Network connectivity

## Prerequisites

### 1. Install Required Tools

```bash
# Install Python (if not already installed)
python --version  # Should be 3.6+

# Install Twine
pip install twine

# Verify installations
python --version
twine --version
```

### 2. Azure DevOps Setup

1. **Create an Azure DevOps Organization** (if you don't have one)
   - Go to https://dev.azure.com
   - Click "New Organization"

2. **Create an Azure Artifacts Feed**
   - Navigate to Artifacts in your project
   - Click "+ Create Feed"
   - Name it (e.g., "test-feed-twine")
   - Set visibility (Project or Organization)

3. **Generate a Personal Access Token (PAT)**
   - Go to User Settings → Personal Access Tokens
   - Click "+ New Token"
   - Scopes: Select "Packaging (Read, write, & manage)"
   - Copy the token (you won't see it again!)

## Configuration

### Required Environment Variables

```bash
# Windows (PowerShell)
$env:E2E_ORGANIZATION_URL="https://dev.azure.com/your-org/"
$env:E2E_FEED_NAME="your-feed-name"
$env:E2E_ACCESS_TOKEN="your-pat-token-here"

# Linux/macOS (Bash)
export E2E_ORGANIZATION_URL="https://dev.azure.com/your-org/"
export E2E_FEED_NAME="your-feed-name"
export E2E_ACCESS_TOKEN="your-pat-token-here"
```

### Optional Environment Variables

```bash
# For multi-feed tests
$env:E2E_FEED_NAME_2="your-second-feed-name"

# For external PyPI tests
$env:E2E_EXTERNAL_PYPI_URL="https://upload.pypi.org/legacy/"
$env:E2E_EXTERNAL_USERNAME="your-pypi-username"
$env:E2E_EXTERNAL_PASSWORD="your-pypi-password"

# For WIF tests
$env:E2E_WIF_SERVICE_CONNECTION="your-wif-connection-name"
$env:E2E_WIF_FEED_URL="https://pkgs.dev.azure.com/your-org/_packaging/your-feed/pypi/upload"

# Custom test package details
$env:E2E_TEST_PACKAGE_NAME="my-test-package"
$env:E2E_TEST_PACKAGE_VERSION="0.0.1"
```

## Running L2 Tests

### Run All L2 Tests

```bash
# From repository root
node make.js build --task TwineAuthenticateV1 --BypassNpmAudit
node make.js test --task TwineAuthenticateV1 --suite L2
```

### Run Specific Test

```bash
# Build first
node make.js build --task TwineAuthenticateV1 --BypassNpmAudit

# Run specific test
cd _build/Tasks/TwineAuthenticateV1
mocha Tests/L2.js --grep "should authenticate to internal Azure Artifacts feed"
```

## Test Scenarios Covered

| Test | Description | Requirements |
|------|-------------|--------------|
| **Internal Feed Auth** | Authenticates to single Azure Artifacts feed | E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN |
| **Package Publishing** | Creates and publishes test package | Same as above + Python/Twine |
| **Multiple Feeds** | Authenticates to 2+ feeds simultaneously | E2E_FEED_NAME_2 |
| **External PyPI** | Authenticates to external PyPI service | E2E_EXTERNAL_PYPI_URL, credentials |
| **Combined Auth** | Internal + External authentication | All of the above |
| **WIF Authentication** | Uses Workload Identity Federation | E2E_WIF_SERVICE_CONNECTION, E2E_WIF_FEED_URL |
| **Persistence** | Verifies .pypirc reuse across invocations | Basic E2E config |

## Expected Test Output

### Success ✅

```
TwineAuthenticate L2 - End-to-End Tests
  ✅ should authenticate to internal Azure Artifacts feed
  ✅ .pypirc created successfully at C:\...\twineAuthenticate\...\  .pypirc
  ✅ should publish package to Azure Artifacts feed using authenticated .pypirc
  📦 Created test package: test-twine-e2e-package-1709654321 v0.0.1
  🔨 Built package at: C:\...\dist
  ✅ Package published successfully to test-feed-twine
  ✅ should authenticate to multiple internal feeds
  ✅ Multiple feeds authenticated: feed1, feed2
  
  7 passing (45s)
```

### Skipped (Missing Config) ⚠️

```
TwineAuthenticate L2 - End-to-End Tests
  ⚠️  E2E tests skipped: Missing required environment variables
     Required: E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN
  
  0 passing (1ms)
  7 pending
```

## Troubleshooting

### Tests Skip Automatically

**Problem:** Tests show as "pending" or display warning about missing environment variables.

**Solution:** Ensure all required environment variables are set correctly:
```bash
# Verify variables are set
echo $env:E2E_ORGANIZATION_URL    # PowerShell
echo $E2E_ORGANIZATION_URL         # Bash
```

### Authentication Fails

**Problem:** `401 Unauthorized` or `403 Forbidden` errors.

**Solutions:**
1. Verify PAT has "Packaging (Read, write, & manage)" scope
2. Check PAT hasn't expired
3. Ensure feed name is correct (case-sensitive)
4. Verify organization URL format: `https://dev.azure.com/org-name/`

### Twine Upload Fails

**Problem:** `Could not find a distribution to upload` or network errors.

**Solutions:**
1. Verify Python and Twine are installed: `pip install twine`
2. Check network connectivity to Azure DevOps
3. Ensure .pypirc file exists and contains valid credentials
4. Try manual upload: `twine upload --config-file <path-to-pypirc> dist/*`

### Package Already Exists

**Problem:** `File already exists` error when publishing.

**Solution:** Test creates unique package names with timestamps. If this persists:
```bash
# Clean up test packages in your feed
# Or modify E2E_TEST_PACKAGE_NAME to use a different prefix
$env:E2E_TEST_PACKAGE_NAME="different-test-package"
```

## Security Best Practices

⚠️ **NEVER commit PATs or passwords to version control!**

### Secure Token Storage

**Option 1: Environment Variable (Temporary)**
```bash
# Set for current session only
$env:E2E_ACCESS_TOKEN="token-here"  # PowerShell
export E2E_ACCESS_TOKEN="token-here"  # Bash
```

**Option 2: Azure Key Vault (Production)**
```bash
# Retrieve token from Key Vault at test runtime
$token = az keyvault secret show --name "e2e-test-token" --vault-name "my-vault" --query value -o tsv
$env:E2E_ACCESS_TOKEN = $token
```

**Option 3: CI/CD Pipeline Variables**
- Store tokens as secure pipeline variables
- Never echo or log token values
- Use separate tokens for test environments

### Feed Permissions

Create a **dedicated test feed** with:
- Isolated from production feeds
- Limited access (only test accounts)
- Auto-cleanup policy for old test packages

## Running in Azure Pipelines

### Sample Pipeline YAML

```yaml
trigger: none  # Manual trigger only

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: 'TwineAuthenticateV1-E2E-Variables'  # Secure variable group

steps:
- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.x'

- script: pip install twine
  displayName: 'Install Twine'

- script: |
    npm install
    node make.js build --task TwineAuthenticateV1 --BypassNpmAudit
  displayName: 'Build Task'

- script: node make.js test --task TwineAuthenticateV1 --suite L2
  displayName: 'Run L2 E2E Tests'
  env:
    E2E_ORGANIZATION_URL: $(OrganizationUrl)
    E2E_FEED_NAME: $(FeedName)
    E2E_ACCESS_TOKEN: $(AccessToken)  # From secure variable group
    SYSTEM_ACCESSTOKEN: $(AccessToken)
```

## Cleanup

After running tests, you may want to clean up test packages:

1. Navigate to your test feed in Azure Artifacts
2. Search for packages named `test-twine-e2e-package-*`
3. Delete test packages (or configure automatic cleanup policy)

## CI/CD Integration

For automated E2E testing in CI/CD:

1. **Create dedicated test organization/project**
2. **Use service principal with least privilege**
3. **Implement feed retention policies** (auto-delete old test packages)
4. **Run L2 tests on schedule** (nightly, weekly) - not on every commit
5. **Monitor test feed quota usage**

## Contributing

When adding new L2 tests:

1. Ensure tests clean up after themselves
2. Use descriptive test names
3. Add appropriate skip logic if dependencies unavailable
4. Document new environment variables in this README
5. Verify tests pass in both local and CI/CD environments

## Additional Resources

- [Twine Documentation](https://twine.readthedocs.io/)
- [Azure Artifacts Python Packages](https://docs.microsoft.com/azure/devops/artifacts/quickstarts/python-packages)
- [Azure Pipelines Task Development](https://docs.microsoft.com/azure/devops/extend/develop/add-build-task)
