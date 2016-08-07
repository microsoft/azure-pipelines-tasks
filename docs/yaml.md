# Simple Yaml Builds

## Goals

- **Process follows code through branches**: History, diff, merge your build process.
- **Keep the spirit of yaml**:  The spirit is to define your language with key simple data points which derives an execution plan.  We do not want it to define an execution plan (our job) but just serialized in a different format.  If we do that, we're missing the point.
- **Easy intuitive format per language type**: Having a language type allows infered execution without having to tediously define everything. 
- **Consistent execution with web defined process**: Switching because you have a preference in yaml and code based process should lead to a consistent build.
- **Leverage heavy investment in tasks**: Multiple teams have been developing tasks for a few years.  We should leverage that effort.
- **Execute Locally**: Should be able to execute and diagnose locally.

## Non Goals

- **Round Trip**: We will not round trip and keep yaml and web edits in sync.  Pick how you want to work.

## Related Topics

[Tools](tools.md): Build and test yaml can define which toolset version to build with.  Matrix option available in tests.  

[Task Versions](preview.md): Yaml allows reference to task including major locked version.

## Language Type and Execution

The key to being easy to use is the language.  Because of this context, much can be infered.

The current build system has a json job format which describes the steps, the tasks, the variables which the agent uses to execute.  At a high level, we are simply using the language context to execute the proper language plugin (extensible - initially just be us) which is essentially a yaml to job json translator.  Because the language plugin understands that programming eco system, it knows how to infer what to execute based on declarative data.

In entries that are paths that end with .sh, .cmd, .ps1, the base language handler knows to map that to the relevant task.

Finally, all yaml entries that fall through essentially map to the cmd line task.

Example:

```yaml
language: csharp

## drives which msbuild is called.  hint to msbuild below
toolset: VisualStudio2015

build:
  # each line is handed to the language plugin.
  # in this case, because toolset is VS2015 (above) it knows to add msbuild task
  # with input sln path and vs version. 
  - src/myApp.sln

  # if it's not something handled by project plugin, goes to the base
  # base plugin has handlers for sh, cmd, ps1 etc... and auto maps to the appropriate task
  - src/ci/after.ps1

  # if it falls through all the special base project handlers, 
  # ends up with exec command line task
  # this has no conditions so will not run if something failed previously
  - echo Hello World

  # control options like always and continueOnError are easy to use
  - [always] src/ci/cleanup.sh
```

## Installers

Language plug-ins have associate [toolinstallers](tools.md).  The language plugin in this case (jsnode) has first class knowledge of node and npm and will ensure the proper version is installed and pre-pended to the path.

Variables can also be used to leverage the build service side matrix option.  This is very powerful since it offers a matrix option that runs build jobs in parallel.

```yaml
language: jsnode
node: $(node.version)
npm: $(npm.version)
install:
  # node project type would just run npm install if install yaml element exists
  # it will inject and npm task with install as it's argument.
  # in this case, also knows to set cwd input on the task to src.
  - src/project.json

build:
  # if it's not something handled by project plugin, goes to the base
  # base plugin has handlers for sh, cmd, ps1 etc... and auto maps to the appropriate task
  - src/ci/before.sh

  # the jsnode language plugin knows if a gulpfile to inject a gulp task
  - src/gulpfile.js
```

## Common Utility Tasks

The base language plugin has first class knowledge of other common tasks such as copy and publish

```yaml
build:
  # base language plugin knows it's
  - copy $(Build.SourcesDirectory) **/*.zip $(Build.ArtifactsDirectory) overwrite
  - publish server $(Build.ArtifactsDirectory)/*.zip as AppZip 

  # condition on failed or always run.  eval condition
  # shell script task will run this 

  - [always] src/ci/cleanup.sh
```

## Generic Task Invocation

The goal is to create a simple and expressive yaml where language offers the opportunity to infer context.

However, in the event you just want literal task invocation that the language plugin does not have first class knowledge of, then that is possible (but not in the spirit of yaml and languages)

```yaml
build:

  # only task names are used.
  # input name or label name (what they see in the web UI) can be used 
  # especially useful for one off custom tasks.
  # yaml entry is dictionary instead of string with "task" key
  - task: CredScan
    format: PREFast
    scanfolder: $(Build.SourcesDirectory)
```

## Test

TODO - flush out

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
