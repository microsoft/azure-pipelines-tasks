# Package migration

Common npm packages will be migrated to a new [repository](https://github.com/microsoft/azure-pipelines-tasks-common-packages)

New ci pipeline is created in PipelineTools project: [microsoft.azure-pipelines-tasks-common-packages](https://dev.azure.com/mseng/PipelineTools/_build?definitionId=14116)

List of already migrated packages:

1. [x] artifacts-common
2. [x] codeanalysis-common
3. [x] ios-signing-common
4. [x] java-common
5. [x] msbuildhelpers
6. [x] packaging-common
7. [x] securefiles-common
8. [x] AzureRmDeploy-common-v3
9. [x] webdeployment-common-v4
10. [x] utility-common-v2
11. [x] kubernetes-common-v2
12. [x] docker-common
13. [x] az-blobstorage-provider-v2
14. [x] azure-arm-rest
15. [x] docker-common-v2


TODO:

1.  [ ] azure-arm-rest-v2

# Getting rid of -v2, -v3 folders

We are going to get rid of -v2, v3 folders and packages. Some of them were created due to the fact that we lost access to the original packages.
We recently restored access and can now re-publish them.

We got access `msbuildhelpers`, `packaging-common`, `azurermdeploycommon`, `webdeployment-common` npm packages back.
Missed versions were re-published to the original packages. 

- [x] Replaced `msbuildhelpers-v3` with `msbuildhelpers` in task dependencies.
- [x] Replaced `packaging-common-v3` with `packaging-common` in task dependencies.
- [x] Replaced `azurermdeploycommon-v3` with `azurermdeploycommon` in task dependencies.
- [x] Replaced `webdeployment-common-v4` with `webdeployment-common` in task dependencies.


# Related PRs

| Package                    | Remove package folder                                               | Replace package in tasks                                            |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| artifacts-common           | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17273) |                                                                     |
| codeanalysis-common        | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17268) |                                                                     |
| ios-signing-common         | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17272) |                                                                     |
| java-common                | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17269) |                                                                     |
| MSBuildHelpers-v3          | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17274) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17250) |
| packaging-common-v3        | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17271) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17266) |
| securefiles-common         | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17270) |                                                                     |
| AzureRmDeploy-common-v3    | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17444) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17435) |
| webdeployment-common-v4    | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17430) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17379) |
| utility-common-v2          | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17445) |                                                                     |
| kubernetes-common-v2       | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17559) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17557) |
| docker-common              | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17597) |                                                                     |
| azure-arm-rest             | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17562) |                                                                     |
| az-blobstorage-provider-v2 | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17447) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17540) |
| docker-common-v2           | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17748) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17746) |