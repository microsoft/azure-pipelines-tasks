#  **.NET Core Installer Task V1**

The task installs user specified version of .NET Core SDK/Runtime. This can be consumed to supply a particular version of .Net Core SDK/runtime to the subsequent tasks in pipeline.

### **A new major version of the task is created because of the following breaking changes:**
- **Installing multiple sdk/runtime versions side by side:** Users had asked for the feature where multiple versions of sdk/runtime can be installed and then be used in subsequent tasks in a pipeline.(one project may require multiple .Net Core sdks to build different applications), for more information about user's ask, [refer here](https://github.com/Microsoft/azure-pipelines-tasks/issues/8306). This is a breaking change, as previously the V0 task always provided only one version of sdk/runtime.

## New features added in V1 task:

## **- Support for fetching latest version for a given major or major.minor version**
This feature was being asked by users who wanted to install the latest version as soon as it becomes available, without manually changing the version in the task. For information about user's asks, refer [here](https://github.com/Microsoft/azure-pipelines-tasks/issues/9171).

This feature is implemented by supporting patterns in version input: `version`. This input now accepts .Net sdk/runtime versions in the following patterns
- `Major.Minor.PatchVersion :` complete version as present in releases.json for the Major.Minor Version channel. Example: 2.2.104
- `Major.Minor.x :` Latest version in the Major.Minor version channel release. It can also be the latest preview version if `includePreviewVersions` input is enabled/true. This can be used to get all latest bug fixes automatically in a major.minor version. As back-compat is maintained in major.minor version, thus ensuring applications being built will not break.
- `Major.x :` Latest version released in the Major version channel. It can also be the latest preview version if `includePreviewVersions` input is enabled/true. This can be used by tools or library developers who need to test with every latest version for compatibility.

### How it works:
The correct version needs to be identified in case user enters pattern based version such as 2.2.x. This is how the exact needed version and its information is extracted:

- [releases-index.json](https://github.com/dotnet/core/blob/master/release-notes/releases-index.json) The file containing links to all .Net Core release channels is download and read into a JSON object `releasesIndex`. This is used to find all available release channels and links to their releases.json.

- The `version` input is divided into three sections:
  - Major
  - Minor
  - Patch

- Based on Minor versions value, the following can happen
  - Numeric : we get the corresponding channel's (Major.Minor) releases.json link from `releasesIndex`. Then the releases.json is downloaded and parsed into an object: `channelInformation`.
    - NOTE: in case exact version is not found, the function logs error and task will fail.
  - x : in this case, we find the latest channel with `support-phase` != `preview` (unless `includePreviewVersions` is true). The releases.json for the selected channel is then downloaded and parsed into json object `releaseInformation`.
    - The version with highest `release.sdk/runtime.version` is then returned. (preview version will only be selected if `includePreviewVersions` is true)
  - Empty: the function will log error as version needs to be given till at least minor version. As a result the task will fail.


- Based on Patch version value, the following can happen
  - Empty : the function logs error and task will fail as it expects either a value or x.
  - Exact Version (alpha numeric): a release with exact release.sdk/runtime.version will be searched in `channelInformation`.
    - `version found:` the version information is returned
    - `version not found:` function logs error and task will fail.
  - x : The latest sdk/runtime version among all releases in that channel will be searched. The latest version information is then returned.

## **- Support for multiple versions to be installed side by side**
This feature was asked by users so that multiple versions can be installed using the task and they all will be available to subsequent tasks in pipeline. It is required in applications where multiple versions of SDK/runtime are required to build/run different projects.

Advantages of this feature:
- User can build all applications in a project using a single build task and need not create different pipelines or add multiple build task.

### How it works:
This feature is implemented, by asking user a new input: `installationPath`, the path where .Net core SDK/runtime should be installed. The Agent process should have write access on the path.
There are multiple benefits of asking `installationPath` from user:
- User can choose to install a particular version in isolation of all other version already installed, by specifying a path which is cleaned up after each release/build.
- User can augment existing set of versions installed with another version by specifying a path where a set of .Net core versions might already be installed, such as: $(Agent.ToolsDirectory)
- User can also install it at any other location, such as: C:\user\username\temp. This will lead to changing the machine configuration and may affect all processes running on the machine.

The way a version is installed at the `installationPath` is now as follows:
- We extract all folders from dotnetVersions.zip/tgz into the `installationPath`, just like install-dotnet.ps1/sh.
- The files in root directory of archive are only copied/overridden if
  - The .Net core version being installed at `installationPath` is later than all other versions already installed at the path.

The advantage of the above installation approach are:
- Time is saved by not copying unneeded files.
- Failures which might occur while overriding existing files are avoided.

Also to further optimize and save time while installation, we do not install a version if it is already cached at that path. Below described are different approaches to find out if a version is cached,

1. **`Folder based approach`**
   - `Installation process:` While installing a version, we will extract the files from downloaded archive and then copy paste the files into the installationPath folder.
   - `Caching process:` Existence of folder with name = version inside sdk or host/fxr folder will be considered as proof that sdk/runtime version is cached. Algorithm to find if version is cached or not will be like this:
     - `installationPath` should contains a folder called `sdk or host/fxr`. If it
       - `exists:` check if sdk or host/fxr folder contains a folder with name = version to be downloaded.
         - `exists:` Version is cached, nothing more needs to be done.
         - `doesn't exist:` Version needs to be installed.
       - `doesn't exist:` Version needs to be installed

2. **`version.completed file based approach`**
   - `Installation process:` Once all the files are successfully extracted, copied and pasted into installationPath, we will create a **`version.completed`** file in sdk/runtime folder. The version.completed file will exist at the same level as the version folder and will be considered as a stamp of successful installation.
     - If installation is not complete/successfull, we will not create the version.completed file.
   - `Caching Process:` So, the algorithm will be same as in Approach 1, but with an additional required check for `version.completed` file to be present in sdk or host/fxr folder along with folder with name = version. Based on version.completed's existance, the following will be concluded
     - `Exists`: version will be considered as cached
     - `Doesn't exist`: version will be installed. (overwriting if the files already exist)


There are a few advantages of `version.completed` based approach over `folder only` based approach:
- Handles failed installation attempts: in case the last installation was left incomplete, the version.completed file would not exist and thus in next try, the version will be installed.


## **- Inbuilt option to perform Multi-Level lookup**
This feature is introduced as users had asked for an option to configure Multi-Level lookup, to know more about user's ask, refer [here](https://github.com/Microsoft/azure-pipelines-tasks/issues/9608). This is applicable to Windows based agents only.

Multi-level lookup configures the .Net core host to probe several locations to find a suitable shared framework. If a folder is not found in folder containing dotnet.exe, it will attempt to look in pre-defined global locations using multi-level lookup. The default global locations are:

**For Windows:**
- C:/Program Files/dotnet (64-bit)
- C:/Program Files (x86)/dotnet (32-bit)

It's value will be set as an environment variable: `DOTNET_MULTILEVEL_LOOKUP` with values
- `0` : Disabled
- `1` : Enabled

For more information on Multi-Level Lookup refer [HERE](https://github.com/dotnet/core-setup/blob/master/Documentation/design-docs/multilevel-sharedfx-lookup.md).
