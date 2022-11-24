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

TODO:

8. [ ] AzureRmDeploy-common-v3
9. [ ] az-blobstorage-provider-v2
10. [ ] azure-arm-rest-v2
11. [ ] azure-arm-rest
12. [ ] docker-common-v2
13. [ ] docker-common
14. [ ] kubernetes-common-v2
15. [ ] packaging-common-v3
16. [ ] utility-common-v2
17. [ ] webdeployment-common-v4

# Getting rid of -v2, -v3 folders

We are going to get rid of -v2, v3 folders and packages. Some of them were created due to the fact that we lost access to the original packages.
We recently restored access and can now re-publish them.

We got access `msbuildhelpers`, `packaging-common` npm packages back.
Missed versions were re-published to the original packages. 

- [x] Replaced `msbuildhelpers-v3` with `msbuildhelpers` in task dependencies.
- [ ] Replaced `packaging-common-v3` with `packaging-common` in task dependencies.

# Related PRs

| Package             | Remove package folder                                               | Replace package in tasks                                            |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| artifacts-common    | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17273) |                                                                     |
| codeanalysis-common | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17268) |                                                                     |
| ios-signing-common  | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17272) |                                                                     |
| java-common         | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17269) |                                                                     |
| MSBuildHelpers-v3   | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17274) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17250) |
| packaging-common-v3 | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17271) | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17266) |
| securefiles-common  | [PR](https://github.com/microsoft/azure-pipelines-tasks/pull/17270) |                                                                     |
