# Introduction

**Creation:** 2023-02-08

This page is prepared for listing and planning possible migration of `npm packages` and `PowerShell script modules` under **Tasks/Common** folder.

Another [migration progress](../../common-npm-packages/MIGRATION_OF_COMMON_PACKAGES.md) is being tracked for **common-npm-packages** folder.

# List of npm packages.

1. [ ] AzureRmDeploy-common
2. [ ] coveragepublisher
3. [ ] packaging-common
4. [ ] utility-common
5. [X] utility-common-v2
6. [ ] webdeployment-common-v2

# List of PowerShell script modules.

These modules can be moved into [PowerShell Gallery](https://www.powershellgallery.com/) central repository.
It is a necessary action to remove direct file references to Tasks/Common folder.
In addition to that, central repository usage will help us to maintain versioning properly.

1. [ ] Deployment\TelemetryHelper
2. [ ] PowershellHelpers
3. [ ] RemoteDeployer
4. [ ] ServiceFabricHelpers
5. [ ] TlsHelper_
6. [ ] VstsAzureHelpers_
7. [ ] VstsAzureRestHelpers_


# Related PRs

| Package                 | Remove package folder                                               | Replace package in tasks                                            |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| utility-common-v2       | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/)      | No replacement, since there is no usage                             |
