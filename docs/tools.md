# Tool Installers

Provide the ability to lazily install various tools sets.  Also offers the ability for task authors to control the versions of their dependencies instead of relying on pre-requisites.  It should be noted that some toolsets don't offer SxS or convenient ways to switch so various tasks could have competing dependency requirements.

The tool installers should setup the environment so regardless of whether the tool is called via a task, a command line task or a script downstream, it should work and use the tool version specified.

The tool installers will leverage existing distribution mechanisms such as zips over http endpoints, nuget, npm.  It is a non goal to create yet another distribution mechanism.

## Scenarios

  - Can download and advertise self contained tool sets (download, extract, nuget, npm, etc...)
  - Test my library against a matrix of runtime versions.
  - Download external tools and even APIs and object models.  Essentially a set of binaries by name.
  - The community can create tool installers and share via the market place.

## Installer Tasks

Installers will just be another type of task.  The task library UI will have another tab as a sibling of build, test, deploy, and utilities.

An installer task will:  

  - Advertise common or well known versions of a tool (LTS or common) via a combo dropdown
  - Find that version in a tools cache or acquires it on demand
  - Prepend the path with the path to that instance of the tool.   


## Tool Cache

The tool cache will be located under _work/tools but there's an environment variable VSTS_TOOLS_PATH to override the location.  This is useful for scenarios such as our hosted image or offline agents which want to build a tools cache and direct the agent to use it. 

The cache will be keyed by name, version, and optionally platform (x86, amd64).  

```
{cacheRoot}
    {Name}
        {version}
            [{platform}]
                 {binaries}
```

The downloader should guard against incomplete downloads and be robust to virus scanners.

## Setting up the environment

The tools folder will be pre-pended to the path.  This sets up the environment so subsequent tasks and scripts use the tool version specified.  For example, if npm 3.0 is chosen, it doesn't matter if subsequent execution is via the npm task, a cmd line task or a script.  It will be used.  This also keeps the tasks simple - use the tool in the path regardless if that's a result of a pre-requisite being installed or an installer task acquiring the tool.  

The binary folder which will be used may not be directly under the root of the binaries.  As an example, node is in the bin folder and expects the libs to be in a sibling lib folder.  We should not manipulate the layout of the toolset.  The installer has firsthand knowledge of that layout (might even vary by version) and knows what folder to prepend to the path (next section).

Some tools have specific  env vars like M2_HOME.

## Satisfies

Tasks typically demand a capability of the agent which demonstrates the tool is found and installed on that agent.  By adding the task to the job, it implicitly adds the demand so the build routes to the proper agent.

Since using a tool installer means the tool will be acquired if not present, the demand is satisfied by adding the installer task.  The tool installer task will declare capabilities it satisfies as well any demands it has.

As an example, consider writing a tool installer task for [chocolatey](https://chocolatey.org) and there is a separate chocolatey task.  Chocolatey is a windows only tool.

Chocolatey task:
```
demands: [
    "chocolatey"
]
``` 

Chocolatey tool installer task:
```
demands: [
    "powershell"
],
satisfies: [
    "chocolatey"
]
```

So, adding the chocolatey task will mean the definition demands chocolatey but the chocolatey installer task will bring the chocolatey capability and satisfy that demand.  The chocolatey installer tasks needs powershell to install so it would route to a windows machine with powershell.

The tool installer may demand on OS .  Locator aspect.

## Hosted Pool

The hosted pool image will specify the cache location.  It will prep the cache with every advertised well known version of every in the box task.  Therefore, using a tool installer and selecting a well known (LTS) version will not result in build time performance losses.  If you explicitly type in a version, it will get pulled on demand and incurr build time costs.

## Matrix Builds

Being able to multiply the builds using a set of runtime versions is useful for testing.  For example, testing a node lib against versions node 4, 5, and 6.  Another example would be a dotnet core library with version 1.0 and 1.1 of the core CLR.

To achieve this, add a tool installer task and for the version, reference a variable.  E.g. $(node.version).  In the node.version variable, specific a list of the versions and check the matrix build option on the build definitions option tab.

## Safe Tool Execution under Multiple Agents 

Some tools have caches of their own which when used by multiple agents on the same machine can lead to concurrency issues and failures.  Examples are nuget and npm which have cache locations which can be overriden by environment variables.  Since the tool installer has the first class knowledge of the tool, it can set the cache location.

The agent will provide a caches well known folder in the _work folder which has caches keyed by the tool name.

## TaskLib API

This is the api that the tool installer task author uses.  A ToolInstaller class will be introduced which primarily offers conveniences for:

- Downloading and extracting tools from http, nuget, npm and other distribution solutions.
- Pre-pending the path for subsequent tasks downstream and/or ...
- Setting tool specific environment variables like M2_HOME
- Sets tool specific cache locations to temp to avoid conflicting SxS agents on the same machine

The task lib will offer a ToolInstall class.

## ToolInstaller API

This is the api the author of the tool installer uses

API:
```

// returns location of downloaded package
download(url: string): Promise string    

// tar.gz, zip.  will support handful of well known as convenience.  can always control your own
// will extract to the proper location in the agents tools folder
// returns string of tool set
extract(location: string: type: string): Promise string;

prependPath(location: string): Promise void;
setToolVariable(name: string, location: string): Promise void;  
```

Sample:
```
import tl = require('vsts-task-lib/task');
import tim = require('vsts-task-lib/toolinstaller');

async install() {
    try {
         
        let version: string = tl.getInput('version', true);
        let ti: tim.ToolInstaller = new ToolInstaller('node', version); 

        let arch = 'x64'; 
        var ext = tl.osType() == 'Windows_NT' ? 'zip' : 'tar.gz';
        var nodeUrl="https://nodejs.org/dist/v$" + version + "/node-v" + version + "-" + os + "-" + arch;

        let temp: string = await inst.download(nodeUrl);

        let extractRoot = await ti.extract(temp);

        // tool installer knows node binary is in bin folder of extracted tool
        ti.prependPath(path.join(extractRoot, 'bin'));
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('NodeInstallerFailed', err.message));
    }
```

Interesting discussion around urls changing from a vendor.  We can always patch tasks or we could externalize the formats.  Taking simplest approach right now (knowledge baked into the installer).



