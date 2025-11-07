# PublishSymbolV2

## Overview

The task is used to publish symbols. 

## Contact Information

Please report any issues at [Github Repo Issues.](https://github.com/microsoft/azure-pipelines-tasks/issues).  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Prerequisite for the task

**PowerShell**

The task requires Powershell version 3.0 or greater.

**TypeScript**

The task requires either Node v16 or Node v20 to run. The task does not support Node v10 starting 07/31/2024.

### Parameters of the task:

* **SymbolsFolder**: The path to the folder that is searched for symbol files.  The default is $(Build.SourcesDirectory).  Otherwise specify a rooted path, for example: $(Build.BinariesDirectory)/MyProject

* **SearchPattern**: The pattern used to discover the pdb files to publish. 

* **Manifest**: The path to a file containing more symbol client keys to publish. 

* **IndexSources**: Indicates whether to inject source server information into the PDB files. This option is only supported on Windows agents.

* **PublishSymbols**: Indicates whether to publish the symbol files.

  * **SymbolServerType**: Choose where to publish symbols. Symbols published to the Azure Artifacts symbol server are accessible by any user with access to the organization/collection. Azure DevOps Server only supports the \"File share\" option. Follow [these instructions](https://go.microsoft.com/fwlink/?linkid=846265) to use Symbol Server in Azure Artifacts. Effective when "PublishSymbols = true"

    * **SymbolsPath**: The file share that hosts your symbols. This value will be used in the call to `symstore.exe add` as the `/s` parameter.. Effective when "PublishSymbols = true && SymbolServerType = FileShare"

    * **CompressSymbols**: Compress symbols when publishing to file share. Effective when "SymbolServerType = FileShare"

    * **SymbolExpirationInDays**: The number of days that symbols should be retained. Effective when "PublishSymbols = true && SymbolServerType = TeamServices"

    * **IndexableFileFormats**: Which debug formats to publish to the symbol server. Effective when "PublishSymbols = true && SymbolServerType = TeamServices"

* **DetailedLog**: Use verbose logging. 

* **TreatNotIndexedAsWarning**: Indicates whether to warn if sources are not indexed for a PDB file. Otherwise the messages are logged as normal output.

* **UseNetCoreClientTool**: Indicates whether to use version of the symbol upload tool that supports DWARF and ELF files. This option only matters on Windows agents. On non-Windows agents, the version of the symbol upload tool that supports DWARF and ELF files will always be used. 

* **SymbolsMaximumWaitTime**: The number of minutes to wait before failing this task.

* **SymbolsProduct**: Specify the product parameter to symstore.exe.  The default is $(Build.DefinitionName)

* **SymbolsVersion**: Specify the version parameter to symstore.exe.  The default is $(Build.BuildNumber)

* **SymbolsArtifactName**: Specify the artifact name to use for the Symbols artifact.  The default is Symbols_$(BuildConfiguration)

## How to build task locally:

1) Create new branch from master
2) Use Node v10.24.1 and npm v6.14.12 when building the task (you can use 'nvm' to quickly and easily switch between different Node versions)
3) Update your changes
4) Update "package.json" and "_buildConfigs/Node20/package.json" in ".\Tasks\PublishSymbolsV2\"
5) Run command "npm i" at folder ".\Tasks\PublishSymbolsV2\
6) Run command at root "npm i"
7) Run command at root "node make.js build --task PublishSymbolsV2"
8) Refer files generated at "_build" to test locally
9) Check-in files changed from ".\Tasks\PublishSymbolsV2\" and files generated from "_generated". Do not checkin files from "_build"


```yaml

Using PAT
- task: PublishSymbols@2
  inputs:
    DetailedLog: true
    SearchPattern: '**/bin/**/*.pdb'
    SymbolServerType: 'TeamServices'
    SymbolExpirationInDays: '365'
    IndexSources: false
  name: PublishSymbols

 Using Service Connection
- task: PublishSymbols@2
  inputs:
    ConnectedServiceName: 'TestServiceConnection'
    DetailedLog: true
    SearchPattern: '**/bin/**/*.pdb'
    SymbolServerType: 'TeamServices'
    IndexSources: false
    SymbolExpirationInDays: '365'
  name: PublishSymbols

```

## Known Limitations :

* The task does not support Node v10 starting 07/31/2024.

## Earlier Versions

If you want to work with earlier version of this task, please refer README.md present at https://github.com/microsoft/azure-pipelines-tasks/tree/releases/m195/Tasks/PublishSymbolsV2 .
