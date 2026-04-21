# PipAuthenticateV1 - End-to-End (L2) Testing Guide

## Overview

L2 tests are **end-to-end tests** that interact with real Azure DevOps services. Unlike L0 (unit) tests, L2 tests require:

- ✅ Real Azure DevOps organization
- ✅ Active Azure Artifacts feeds
- ✅ Valid access tokens
- ✅ Python and pip installed
- ✅ Network connectivity

## Prerequisites

### 1. Install Required Tools

```bash
# Install Python (if not already installed)
python --version  # Should be 3.6+

# Verify pip is installed
pip --version

# Verify installations
python --version
pip --version
```

### 2. Azure DevOps Setup

1. **Create an Azure DevOps Organization** (if you don't have one)
   - Go to https://dev.azure.com
   - Click "New Organization"

2. **Create an Azure Artifacts Feed**
   - Navigate to Artifacts in your project
   - Click "+ Create Feed"
   - Name it (e.g., "test-feed-pip")
   - Set upstream sources (optional: enable PyPI upstream)

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
$env:E2E_EXTERNAL_PYPI_URL="https://pypi.org/simple"
$env:E2E_EXTERNAL_USERNAME="your-pypi-username"
$env:E2E_EXTERNAL_PASSWORD="your-pypi-password"

# For WIF tests
$env:E2E_WIF_SERVICE_CONNECTION="your-wif-connection-name"
$env:E2E_WIF_FEED_URL="https://pkgs.dev.azure.com/your-org/_packaging/your-feed/pypi/simple/"

# For package installation tests
$env:E2E_TEST_PACKAGE_TO_INSTALL="your-package-name"  # Must exist in your feed
```

## Running L2 Tests

### Run All L2 Tests

```bash
# From repository root
node make.js build --task PipAuthenticateV1 --BypassNpmAudit
node make.js test --task PipAuthenticateV1 --suite L2
```

### Run Specific Test

```bash
# Build first
node make.js build --task PipAuthenticateV1 --BypassNpmAudit

# Run specific test
cd _build/Tasks/PipAuthenticateV1
mocha Tests/L2.js --grep "should set PIP_INDEX_URL"
```

## Test Scenarios Covered

| Test | Description | Requirements |
|------|-------------|--------------|
| **PIP_INDEX_URL** | Sets PIP_INDEX_URL for internal feed | E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN |
| **PIP_EXTRA_INDEX_URL** | Uses extra index mode with onlyAddExtraIndex | Same as above |
| **Package Installation** | Installs package from authenticated feed | E2E_TEST_PACKAGE_TO_INSTALL + package exists in feed |
| **Multiple Feeds** | Authenticates to 2+ feeds simultaneously | E2E_FEED_NAME_2 |
| **External PyPI** | Authenticates to external PyPI service | E2E_EXTERNAL_PYPI_URL, credentials |
| **Combined Auth** | Internal + External authentication | All of the above |
| **WIF Authentication** | Uses Workload Identity Federation | E2E_WIF_SERVICE_CONNECTION, E2E_WIF_FEED_URL |
| **Environment Persistence** | Verifies env vars across invocations | Basic E2E config |

## Expected Test Output

### Success ✅

```
PipAuthenticate L2 - End-to-End Tests
  ✅ should set PIP_INDEX_URL for internal Azure Artifacts feed
  ✅ PIP_INDEX_URL set: https://build:***@pkgs.dev.azure.com/...
  ✅ should set PIP_EXTRA_INDEX_URL with onlyAddExtraIndex
  ✅ PIP_EXTRA_INDEX_URL set for extra index mode
  ✅ should install package from authenticated Azure Artifacts feed
  ✅ Feed authentication verified (can access feed)
  
  8 passing (35s)
```

### Skipped (Missing Config) ⚠️

```
PipAuthenticate L2 - End-to-End Tests
  ⚠️  E2E tests skipped: Missing required environment variables
     Required: E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN
  
  0 passing (1ms)
  8 pending
```

## How PipAuthenticate Works

The task sets environment variables that pip reads:

- **PIP_INDEX_URL**: Primary package index (default mode)
- **PIP_EXTRA_INDEX_URL**: Additional package indexes (extra index mode)

These URLs include embedded credentials:
```
https://build:ACCESS_TOKEN@pkgs.dev.azure.com/org/_packaging/feed/pypi/simple/
```

When you run `pip install package-name`, pip automatically uses these authenticated URLs.

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

### Package Installation Fails

**Problem:** `Could not find a version that satisfies the requirement` error.

**Solutions:**
1. Ensure the package exists in your Azure Artifacts feed
2. Set E2E_TEST_PACKAGE_TO_INSTALL to an existing package
3. Check your feed has upstream sources enabled if installing public packages
4. Try: `pip install --index-url $env:PIP_INDEX_URL package-name` to test manually

### Credentials Not Working

**Problem:** pip says "403 Forbidden" or doesn't find packages.

**Solutions:**
1. Verify PIP_INDEX_URL was set correctly by the task
2. Check the URL includes credentials: `https://build:TOKEN@pkgs.dev.azure.com/...`
3. Test manually: `pip install --index-url "URL_FROM_TASK" package-name`
4. Ensure your feed permissions allow the PAT to read packages

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
- Auto-cleanup policy for old packages

## Running in Azure Pipelines

### Sample Pipeline YAML

```yaml
trigger: none  # Manual trigger only

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: 'PipAuthenticateV1-E2E-Variables'  # Secure variable group

steps:
- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.x'

- script: |
    npm install
    node make.js build --task PipAuthenticateV1 --BypassNpmAudit
  displayName: 'Build Task'

- script: node make.js test --task PipAuthenticateV1 --suite L2
  displayName: 'Run L2 E2E Tests'
  env:
    E2E_ORGANIZATION_URL: $(OrganizationUrl)
    E2E_FEED_NAME: $(FeedName)
    E2E_ACCESS_TOKEN: $(AccessToken)  # From secure variable group
    SYSTEM_ACCESSTOKEN: $(AccessToken)
```

## Adding Packages to Your Feed

To test package installation, you need packages in your feed:

### Option 1: Publish a Test Package

```bash
# Create a simple test package
mkdir test-package
cd test-package

# Create setup.py
cat > setup.py << EOF
from setuptools import setup
setup(
    name='my-test-package',
    version='1.0.0',
    description='Test package for E2E tests'
)
EOF

# Build and publish
python setup.py sdist
pip install twine
twine upload --repository-url https://pkgs.dev.azure.com/ORG/_packaging/FEED/pypi/upload/ dist/*
```

### Option 2: Enable Upstream PyPI

1. Go to your feed settings in Azure Artifacts
2. Enable "PyPI" as an upstream source
3. Now you can install any public PyPI package through your feed

## Cleanup

After running tests, pip environment variables remain set in your shell:

```bash
# Clear pip environment variables
$env:PIP_INDEX_URL = ""           # PowerShell
$env:PIP_EXTRA_INDEX_URL = ""

unset PIP_INDEX_URL                # Bash
unset PIP_EXTRA_INDEX_URL
```

## CI/CD Integration

For automated E2E testing in CI/CD:

1. **Create dedicated test organization/project**
2. **Use service principal with least privilege**
3. **Implement feed cleanup** (remove old test packages)
4. **Run L2 tests on schedule** (nightly, weekly) - not on every commit
5. **Monitor feed storage quota**

## Contributing

When adding new L2 tests:

1. Ensure tests clean up after themselves
2. Use descriptive test names
3. Add appropriate skip logic if dependencies unavailable
4. Document new environment variables in this README
5. Verify tests pass in both local and CI/CD environments

## Additional Resources

- [pip Configuration](https://pip.pypa.io/en/stable/topics/configuration/)
- [Azure Artifacts Python Packages](https://docs.microsoft.com/azure/devops/artifacts/quickstarts/python-packages)
- [PEP 503 - Simple Repository API](https://www.python.org/dev/peps/pep-0503/)
