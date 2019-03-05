#  **.NET Core Installer Task**

The task installs .NET Core SDK/Runtime. Below are the features provided by the task and there implementation
New version of the task is being written because
- Change in installation behaviour, directly impacting user: the changed default location of installation may result in multiple versions of dotnet being available to user, in contrast to only one version being available earlier. As the versions are cached, thus the user might get newer versions than the one user had asked to be installed, and may lead to difference in build/restore.

## **- Caching SDK/Runtime versions**
The task provides caching of dotnet sdk/runtime versions, given that the `Path to install dotnet` is same each time the task is runs.

### What it means:
The task will only install the sdk/runtime if that version is not already installed. This will save time in cases when dotnet version is already installed.

### How it works:
Before installting the SDK/Runtime version, it is checked if that sdk/runtime version is already installed in the specified location: `installationPath` (installationPath is a user input).

Commonality in both approaches defined below:
1. `installationPath` will be created if it doesn't already exist.
2. All the folders from dotnet.zip/tgz will be copied inside the `installationPath` folder.
3. Files at top level (such as dotnet.exe, LICENSE.txt etc.) in dotnetVersion.zip/tgz will only be copied, if the sdk/runtime being installed is greater than all other already installed in that path.


Approaches to build caching of SDK/Runtime versions:

1. **`Folder based approach`**
   - `Installation process:` While installing a version, we will only extract the files from downloaded archive and then copy paste the files into the installationPath folder.
   - `Caching process:` Existance of folder with name = version inside sdk or host/fxr folder will be considered as proof that sdk/runtime version is installed. Alogirthm to find if version is cached or not will be like this:
     - `installationPath` should contains a folder called `sdk or host/fxr`. If it
       - `exists:` check if sdk or host/fxr folder contains a folder with name = version to be downloaded.
         - `exists:` Version is cached, nothing more needs to be done.
         - `doesn't exist:` Version needs to be installed.
       - `doesn't exist:` Version needs to be installed

2. **`Version.Complete file based approach`**
   - `Installation process:` Once all the files are successfully extracted, copied and pasted into installationPath, we will create a **`version.complete`** file in sdk/runtime folder. The Version.complete file will exist at the same level as the version folder and will be considered as a stamp of successfull installation.
     - If installation is not complete/successfull, we will not create the version.complete file.
   - `Caching Process:` So, the algorithm will be same as in Approach 1, but with an additional required check for `version.complete` file to be present in sdk/runtime folder along with version folder. Based on Version.Complete's existance, the following will be concluded
     - `Exists`: version will be considered as cached
     - `Doesn't exist`: version will be installed. (overwriting if the files already existing)
     - **optionally:** `Doesn't exist but installationPath is global dotnet installation path`: in this case the version will be considered as cached even without the version.complete file.


## **- Supporting version wildcards**
The task input `version` accepts dotnet sdk/runtime versions in the following patterns
- `Major.Minor.PatchVersion :` complete version as present in releases.json for the Major.Minor Version channel. Example: 2.2.104
- `Major.Minor.x :` Latest version in the Major.Minor version channel release. It can also be the latest preview version if `includePreviewVersions` input is enabled/true.
- `Major.x :` Latest version released in the Major version channel. It can also be the latest preview version if `includePreviewVersions` input is enabled/true.

### How it works:
The correct version needs to be identified in case `x` is used to specify required version. This is how the exact needed version and its information is extracted:


- The `version` input is evaluated and divided into three sections:
  - Major
  - Minor
  - Patch

- Download and read file [releases-index.json](https://github.com/dotnet/core/blob/master/release-notes/releases-index.json) as a JSON object `release-index`.

- Based on Minor versions value, the following can happen
  - Numeric : Then we get the corresponding channels (Major.Minor) releases.json link from `release-index`. Then the releases.json is downloaded and parsed into an object: `releaseInformation`.
    - NOTE: in case exact version is not found, the function logs error and task will fail.
  - \* : in this case, we find the latest channel with `support-phase` != `preview` (unless `includePreviewVersions` is true). The releases.json for the selected channel is then downloaded and parsed into json object `releaseInformation`.
    - The latest version from  `release.sdk/runtime.version` is the returned by the funtion. (preview version will only be selected if `includePreviewVersions` is true)
  - Empty: the function will log error as version needs to be given till atleast minor version. As a result the task will fail.


- Based on Patch version value, the following can happen
  - Empty : the function logs error and task will fail as it expects either a value or \*.
  - Exact Version (alpha numeric): the exact sdk/runtime version will be searched in `releaseInformation's`.
    - `version found:` the version information is returned
    - `version not found:` function logs error and task will fail.
  - \* : The latest sdk/runtime version will be searched in each release. The latest release is then returned.

## **- Inbuilt option to restrict Multi-Level lookup**

The host will probe several locations to find a suitable shared framework. If a folder is not there, it will attempt to look in pre-defined global locations using multi-level lookup. The default global locations are:

**For Windows:**
- C:/Program Files/dotnet (64-bit processes)
- C:/Program Files (x86)/dotnet


**For MacOs:**
- /usr/local/share/dotnet


**For Linux:**
- /usr/share/dotnet

Selecting it would mean your application would be built using the SDK and will consume only those runtimes, which are installed by the tool installer and not the ones installed on the machine.<br/>
It's value will be set as an environment variable: `DOTNET_MULTILEVEL_LOOKUP` with values
- `0` : Disabled
- `1` : Enabled