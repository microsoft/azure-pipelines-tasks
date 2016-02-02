# Tool Installers

Provide the ability to lazily install various tools sets.  Also offers the ability for task authors to control the versions of their dependencies instead of relying on pre-requisites.  It should be noted that some toolsets don't offer SxS or convenient ways to switch so various tasks could have competing dependency requirements.

Note that the agent was recently changed to download it's own copy of node during installation so the agent version of node is orthogonal to the node version required by a task (like cordova).

## Scenarios

  - Can download and advertise self contained tool sets (download, extract)
  - Can scan for pre-installed tools as well (VS, Xcode, msbuild, etc...) instead of relying on non-extensible hardcoded agents
  - Tasks can ask for versions (or range) of tool to use and lazily install/cache
  - Download external tools and even APIs and object models.  Essentially a set of binaries by name

## Source

Open sourced in the GitHub tasks repo
```
Tasks
   ...
   msbuild
   xcode
   ...
Tools
   ...
   msbuild
   node
   npm
   xcode
   ...
```

Notice not necessarily 1:1.  node and npm tool used by many tasks.
Community and Tasks outside our repo can package and consume tool installers.  For example, cordova is outside our repo.  Our repo represents the in the box tasks and tool installers so others can use our tool installers (just as their tasks consume our task lib) or they can author their own tool installers.

## Packaging and Delivery

Installers are packaged with each task in a Tools folder.  Tasks are delivered via extensions.  Our build system will automate and package as we do with the task-lib as a convenience (we currently do this to pull in the vsts-task-lib)

tool.json
tool.js

## tool.json

Very similar to the existing task.json.  But different where needed.
The json does not need to advertise which script to run.  It is always tool.js as all are written in javascript.

```
{
    id='{guid}',
    name='Node',
    platforms: [ 
        { os:'linux', 'arch':['x86', 'amd64']},
        { os:'darwin', 'arch':['amd64']}, 
        { os:'windows', 'arch':['x86', 'amd64']},
    ],
    
}
```

## Agent Layout

No need to put arch and os in the path since the agent will only install tools qualified for it's os and arch.

```
{agentRoot}
    Tools
        {Name}
            {version}
                location
                {binaries}

```

Different versions of a toolset can have a different layout.  We should not massage the layout of a toolset - we download, extract.

The tool installer does have intimate knowledge of that toolsets layout (even across versions).  location is a file that contains one relative path to the entry point (often an executable binary)

## TaskLib API

This is the api that the task author uses.  For example, a cordova task that uses node and npm knows which versions of node and npm are ideal or valid.  It could choose to hard code that into the task or offer a dropdown set of valid choices to the consumer of the task.  That also allows some to run a matrix of builds using an array of tool version to explode on.

A task 'loads' a tool by asking for a version (or range).  Loading a tool will lazily download and cache on disk, prepend the path, and return the path.

API:
```
getTool(toolName: string, semverRange: string, default: string );
```

Sample:
```
import task = require('vsts-task-lib/task');

task.getTool('Node', '>=4.2', '4.2.4');
```

The api would locate {agentRoot}/Tools/Node on disk, iterate through versions already downloaded trying to satisfy the semver range requirement.  It will return the greatest version matching the requirement.

If the range cannot be satisfied, the default version will be downloaded.  The default version would be a known good LTS version of the tool (4.2.4 right now for node.js).

After that call, the location to that 

Tasks are run out of proc so there's no case where the path is poisoined for the next task.

No need to take os or arch in the api.  The api can discover that easily.


## ToolInstaller API

This is the api the author of the tool installer uses

API:
```

// returns location of downloaded package
download(url: string): QPromise string    

// tar.gz, zip.  will support handful of well known as convenience.  can always control your own
// will extract to the proper location in the agents tools folder
// returns string of tool set
extract(location: string: type: string): QPromise string;  
```

Sample:
```
import installer = require('vsts-task-lib/toolinstaller');

export function install(version, os, arch): QPromise<string> {
  var ar = arch == 'amd64' ? 'x64' : 'x86';
  var ext = os == 'windows' ? 'zip' : 'tar.gz';
  var nodeUrl="https://nodejs.org/dist/v$" + version + "/node-v" + version + "-" + os + "-" + ar;

  return installer.download(nodeUrl)
  .then((loc: string) => {
    installer.extract(loc, ext);
  })
}

```

Interesting discussion around urls changing from a vendor.  We can always patch tasks or we could externalize the formats.  Taking simplest approach right now (knowledge baked into the installer).

## Hosted

TODO: flush out how our images run the installers and/or discovery scripts

## Capabilities

TODO: Writing up how to make capabilities extensibile rather than being a hard coded set in the agent (busted).


