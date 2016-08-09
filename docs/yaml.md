# Simple Yaml Builds

## Goals

- **Process follows code through branches**: History, diff, merge your build process.
- **Keep the spirit of simple builds that use yaml**:  The spirit is to define your language with key simple data points which derives an execution plan.  We do not want it to define an execution plan (our job) but just serialized in a different format.  If we do that, we're missing the point.
- **Easy intuitive format per language type**: Having a language type allows infered execution without having to tediously define everything. 
- **Consistent execution with web defined process**: Switching because you have a preference in yaml and code based process should lead to a consistent build.
- **Leverage heavy investment in tasks**: Multiple teams have been developing tasks for a few years.  We should leverage that effort.
- **Execute Locally**: Should be able to execute and diagnose locally.

## Non Goals

- **Round Trip**: We will not round trip the process and keep yaml and web edits in sync.  Pick how you want to work.

## Related Topics

[Tools](tools.md): Build and test yaml can define which toolset version to build with.  The language knows which tools has to work with. 

[Task Versions](preview.md): Yaml allows reference to task including major locked version.

## Language Type and Execution

The key to being easy to use is the language.  Because of this context, much can be infered.

The current build system has a json job format which describes the steps, the tasks, the variables which the agent uses to execute.  At a high level, we are simply using the language context to execute the proper language plugin (extensible - initially just be us) which is essentially a yaml to job json translator.  Because the language plugin understands that programming eco system, it knows how to infer what to execute based on declarative data.

In entries that are paths that end with .sh, .cmd, .ps1, the base language handler knows to map that to the relevant task.

Finally, all yaml entries that fall through essentially map to the cmd line task.

Example:

```yaml

# a definition will be able to have multiple jobs
my build job:

  ## specify language.
  language: dotnet

  ## drives which msbuild is called.  hint to msbuild below
  toolset: VisualStudio2015
 
  ## variables are merged and overlayed over variables defined in the web definition editor.
  variables:
    foo: bar
    baz: foo

  steps:
    
    # each line is handed to the language plugin.
    # in this case, because toolset is VS2015 (above) it knows to add msbuild task
    - src\mywebapp.sln

    # the dotnet language plugin also understands that "proj" maps to msbuild task
    # you can pass other inputs to the msbuild task
    - proj: src\mywebApp.csproj
      msbuildArguments: /m

    # if it's not something handled by project plugin, goes to the base
    # base plugin has handlers for sh, cmd, ps1 etc... and auto maps to the powershell task
    # language pluging understands that everything after the script is additional arguments to script 
    - src\ci\after.ps1 arg1 $(foo)

    # if I need to specify other inputs for script tasks ...
    # variables map into inputs  
    - script: src\ci\try.ps1 $(baz) "arg two"
      failOnStandardError: true

    # if it falls through all the special base project handlers, 
    # ends up with exec command line task
    - echo Hello World

  finally:
    # always run
    - src\ci\cleanup.ps1
```

## Installers and Tools

Language plug-ins have associate [toolinstallers](tools.md).  The language plugin in this case (jsnode) has first class knowledge of node and npm and will ensure the proper version is installed and pre-pended to the path.

Variables can also be used to leverage the build service side matrix option.  This is very powerful since it offers a matrix option that runs build jobs in parallel.

```yaml
my build job:
  language: jsnode

  # jsnode language plugin knows it's node that it installs and had the node installer
  # TODO: define how server uses job matrix and sets variable.  
  # Is it a hint to the tasks below so all tasks that use that node version?  
  # Need conventions for that.  tools feature needs flushing out 
  nodejs:
    - 0.12.7
    - 4.3.2

  # if steps do not exist the nodejs lang plugin will npm install, npm test
  # you can specify
  steps:
    - npm install
    - gulp
    - gulp test


    # the jsnode language plugin knows if a gulpfile to inject a gulp task
    - src/gulpfile.js

    - gulp src/gulptest.js test
    - gulp test
    
```

## Common Utility Tasks

The base language plugin has first class knowledge of other common tasks such as copy and publish

```yaml
steps:

  # base language plugin knows it's
  - copy $(Build.SourcesDirectory) **/*.zip $(Build.ArtifactsDirectory) overwrite 

publish:
  # publish to a server drop
  - server $(Build.ArtifactsDirectory)/*.zip as AppZip
```

## Task Hints and Locking

We need to be able to lock to certain versions of tasks.  

**The default is latest non preview task** 

The language plugin will sometimes have to decide which task to use.  A good example of this is ps1 paths.  It could be a generic ps1 task or an azure powershell task.  We will figure it out by cracking the file. 

```yaml
steps:
  # This will use the latest non-preview version of the task
  # It will also use the powershell version of the task 
  - src/ci/start.ps1

  # This will use the 2.0.1-preview version of the powershell task 
  - (PowerShell@2) src/ci/setupenv.ps1

  # This will use the azure powershell task.  It's a hint to the base language handler
  - (AzurePowerShell) src/ci/prepazure.ps1
```

## Generic Task Invocation

The goal is to create a simple and expressive yaml where language offers the opportunity to infer context.

However, in the event you just want literal task invocation that the language plugin does not have first class knowledge of, then that is possible (but not in the spirit of yaml and languages)

```yaml
steps:

  # only task names are used.
  # input name or label name (what they see in the web UI) can be used 
  # especially useful for one off custom tasks.
  # yaml entry is dictionary instead of string with "task" key
  - task: CredScan
    format: PREFast
    scanfolder: $(Build.SourcesDirectory)
```

## CI Triggers

TODO.  CI only - defined in yaml.

## Build Definition

The build definition in the web still has to exist.  All reporting, queues and other items hang off it.

TODO define.  Basic gist...

- Checkin yaml.  Convention creates build definition in build system.
- Process tab is replaced with monaco editor in place.  Can edit and save.  We should validate on save.
- Variables still exist.  Merged with yaml defined.

## Variables

TODO - define variables in yaml.  Merged with variables on definition.

## Demands

Define what it means for demands since the web designer no longer adds the relevant demands. 

I think language offers a good opportunity here.

## New Definition Wizard Integration


