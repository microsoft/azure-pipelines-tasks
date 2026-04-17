# MavenAuthenticateV0 - End-to-End (L2) Testing Guide

## Overview

L2 tests are **end-to-end tests** that interact with real Azure DevOps services. Unlike L0 (unit) tests, L2 tests require:

- ✅ Real Azure DevOps organization
- ✅ Active Azure Artifacts feeds
- ✅ Valid access tokens
- ✅ Maven installed  
- ✅ Network connectivity

## Prerequisites

### 1. Install Required Tools

```bash
# Install Maven (if not already installed)
# Download from: https://maven.apache.org/download.cgi

# Verify installation
mvn --version
# Should show Maven 3.x+
```

### 2. Azure DevOps Setup

1. **Create an Azure DevOps Organization** (if you don't have one)
   - Go to https://dev.azure.com
   - Click "New Organization"

2. **Create an Azure Artifacts Feed**
   - Navigate to Artifacts in your project
   - Click "+ Create Feed"
   - Name it (e.g., "test-feed-maven")
   - Set upstream sources (optional: enable Maven Central upstream)

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

# For external Maven repository tests
$env:E2E_EXTERNAL_MAVEN_URL="https://repo.maven.apache.org/maven2"
$env:E2E_EXTERNAL_USERNAME="your-maven-username"
$env:E2E_EXTERNAL_PASSWORD="your-maven-password"

# For WIF tests
$env:E2E_WIF_SERVICE_CONNECTION="your-wif-connection-name"
$env:E2E_WIF_FEED_NAME="your-wif-feed-name"

# For artifact download tests (must exist in your feed)
$env:E2E_TEST_GROUP_ID="com.example"
$env:E2E_TEST_ARTIFACT_ID="my-test-artifact"
$env:E2E_TEST_VERSION="1.0.0"
```

## Running L2 Tests

### Run All L2 Tests

```bash
# From repository root
node make.js build --task MavenAuthenticateV0 --BypassNpmAudit
node make.js test --task MavenAuthenticateV0 --suite L2
```

### Run Specific Test

```bash
# Build first
node make.js build --task MavenAuthenticateV0 --BypassNpmAudit

# Run specific test
cd _build/Tasks/MavenAuthenticateV0
mocha Tests/L2.js --grep "should create settings.xml"
```

## Test Scenarios Covered

| Test | Description | Requirements |
|------|-------------|--------------|
| **Create settings.xml** | Creates settings.xml with feed authentication | E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN |
| **Multiple Feeds** | Authenticates to 2+ feeds simultaneously | E2E_FEED_NAME_2 |
| **Artifact Download** | Downloads artifact using authenticated feed | E2E_TEST_GROUP_ID, E2E_TEST_ARTIFACT_ID, E2E_TEST_VERSION |
| **Preserve Existing** | Preserves existing settings.xml entries | None (uses custom settings) |
| **Backup Creation** | Creates backup of original settings.xml | None |
| **WIF Authentication** | Uses Workload Identity Federation | E2E_WIF_SERVICE_CONNECTION, E2E_WIF_FEED_NAME |
| **External Repos** | Authenticates to external Maven repositories | E2E_EXTERNAL_MAVEN_URL, credentials |
| **Multiple Runs** | Updates settings.xml on subsequent runs | E2E_FEED_NAME_2 |

## Expected Test Output

### Success ✅

```
MavenAuthenticate L2 - End-to-End Tests
  📝 Backed up existing settings.xml
  ✅ should create settings.xml with Azure Artifacts feed authentication
  ✅ settings.xml created with authentication for feed: test-feed-maven
  ✅ should add authentication for multiple feeds
  ✅ Multiple feeds authenticated: feed1, feed2
  ✅ should download artifact from authenticated Azure Artifacts feed
  ✅ Feed authentication verified (can access feed)
  ♻️  Restored original settings.xml
  
  8 passing (92s)
```

### Skipped (Missing Config) ⚠️

```
MavenAuthenticate L2 - End-to-End Tests
  ⚠️  E2E tests skipped: Missing required environment variables
     Required: E2E_ORGANIZATION_URL, E2E_FEED_NAME, E2E_ACCESS_TOKEN
  
  0 passing (1ms)
  8 pending
```

## How MavenAuthenticate Works

The task creates or modifies `settings.xml` in your `.m2` directory:

### Windows Location
```
C:\Users\<username>\.m2\settings.xml
```

### Linux/macOS Location
```
/home/<username>/.m2/settings.xml
```

### Generated settings.xml Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0">
    <servers>
        <server>
            <id>your-feed-name</id>
            <username>build</username>
            <password>YOUR_ACCESS_TOKEN</password>
        </server>
    </servers>
</settings>
```

### Using in pom.xml

Reference the feed in your `pom.xml`:

```xml
<repositories>
    <repository>
        <id>your-feed-name</id>
        <url>https://pkgs.dev.azure.com/org/_packaging/your-feed-name/maven/v1</url>
    </repository>
</repositories>
```

The `<id>` must match the server ID in settings.xml for authentication to work.

## Troubleshooting

### Tests Skip Automatically

**Problem:** Tests show as "pending" or display warning about missing environment variables.

**Solution:** Ensure all required environment variables are set correctly:
```bash
# Verify variables are set
echo $env:E2E_ORGANIZATION_URL    # PowerShell
echo $E2E_ORGANIZATION_URL         # Bash
```

### Maven Not Found

**Problem:** "Maven not installed" message.

**Solutions:**
1. Download Maven from https://maven.apache.org/download.cgi
2. Extract to a directory (e.g., C:\Maven or /opt/maven)
3. Add to PATH:
   ```bash
   # Windows
   $env:PATH += ";C:\Maven\bin"
   
   # Linux/macOS
   export PATH=$PATH:/opt/maven/bin
   ```
4. Verify: `mvn --version`

### Authentication Fails

**Problem:** `401 Unauthorized` or `403 Forbidden` errors.

**Solutions:**
1. Verify PAT has "Packaging (Read, write, & manage)" scope
2. Check PAT hasn't expired
3. Ensure feed name is correct (case-sensitive)
4. Verify organization URL format: `https://dev.azure.com/org-name/`
5. Check server `<id>` in settings.xml matches repository `<id>` in pom.xml

### Artifact Download Fails

**Problem:** `Could not find artifact` error.

**Solutions:**
1. Ensure the artifact exists in your Azure Artifacts feed
2. Set E2E_TEST_GROUP_ID, E2E_TEST_ARTIFACT_ID, E2E_TEST_VERSION correctly
3. Check feed has upstream sources enabled if downloading public artifacts
4. Try manual download to verify credentials:
   ```bash
   mvn dependency:get \
     -DgroupId=com.example \
     -DartifactId=my-artifact \
     -Dversion=1.0.0 \
     -s ~/.m2/settings.xml
   ```

### settings.xml Corrupted

**Problem:** Tests fail with XML parsing errors.

**Solutions:**
1. The task creates a backup at `~/.m2/_settings.xml`
2. Restore backup: `cp ~/.m2/_settings.xml ~/.m2/settings.xml`
3. Or delete settings.xml to start fresh: `rm ~/.m2/settings.xml`

### Permission Denied on .m2 Directory

**Problem:** Cannot write to .m2 directory.

**Solutions:**
```bash
# Create directory if it doesn't exist
mkdir -p ~/.m2

# Set proper permissions (Linux/macOS)
chmod 755 ~/.m2
```

## Security Best Practices

⚠️ **NEVER commit PATs or settings.xml with credentials to version control!**

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
- Auto-cleanup policy for old artifacts

## Running in Azure Pipelines

### Sample Pipeline YAML

```yaml
trigger: none  # Manual trigger only

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: 'MavenAuthenticateV0-E2E-Variables'  # Secure variable group

steps:
- task: Maven@3
  inputs:
    mavenPomFile: 'pom.xml'
    goals: '--version'
  displayName: 'Verify Maven'

- script: |
    npm install
    node make.js build --task MavenAuthenticateV0 --BypassNpmAudit
  displayName: 'Build Task'

- script: node make.js test --task MavenAuthenticateV0 --suite L2
  displayName: 'Run L2 E2E Tests'
  env:
    E2E_ORGANIZATION_URL: $(OrganizationUrl)
    E2E_FEED_NAME: $(FeedName)
    E2E_ACCESS_TOKEN: $(AccessToken)  # From secure variable group
    SYSTEM_ACCESSTOKEN: $(AccessToken)
```

## Adding Artifacts to Your Feed

To test artifact downloads, you need artifacts in your feed:

### Option 1: Publish a Test Artifact

```bash
# Create a simple Maven project
mvn archetype:generate \
  -DgroupId=com.test \
  -DartifactId=my-test-artifact \
  -DarchetypeArtifactId=maven-archetype-quickstart \
  -DinteractiveMode=false

cd my-test-artifact

# Configure Azure Artifacts in pom.xml
# Add <distributionManagement> section with your feed URL

# Deploy to Azure Artifacts
mvn deploy \
  -DaltDeploymentRepository=AzureArtifacts::default::https://pkgs.dev.azure.com/ORG/_packaging/FEED/maven/v1
```

### Option 2: Enable Upstream Maven Central

1. Go to your feed settings in Azure Artifacts
2. Enable "Maven Central" as an upstream source
3. Now you can download any public Maven artifact through your feed

## Cleanup

After running tests, the task creates/modifies:

- `~/.m2/settings.xml` - Modified with feed credentials
- `~/.m2/_settings.xml` - Backup of original settings (first run only)

Tests automatically restore original settings.xml, but you can manually restore:

```bash
# Restore from backup
cp ~/.m2/_settings.xml ~/.m2/settings.xml

# Or start fresh
rm ~/.m2/settings.xml
```

## CI/CD Integration

For automated E2E testing in CI/CD:

1. **Create dedicated test organization/project**
2. **Use service principal with least privilege**
3. **Implement feed cleanup** (remove old test artifacts)
4. **Run L2 tests on schedule** (nightly, weekly) - not on every commit
5. **Monitor feed storage quota**
6. **Use Maven local repository caching** in pipelines for faster tests

## Contributing

When adding new L2 tests:

1. Ensure tests restore original settings.xml
2. Use descriptive test names
3. Add appropriate skip logic if dependencies unavailable
4. Document new environment variables in this README
5. Verify tests pass in both local and CI/CD environments
6. Test on Windows, Linux, and macOS if possible

## Additional Resources

- [Maven Settings Reference](https://maven.apache.org/settings.html)
- [Azure Artifacts Maven Packages](https://docs.microsoft.com/azure/devops/artifacts/get-started-maven)
- [Maven Repository Guide](https://maven.apache.org/guides/introduction/introduction-to-repositories.html)
- [Azure Pipelines Maven Task](https://docs.microsoft.com/azure/devops/pipelines/tasks/build/maven)
