Refer to [the official documentation](https://docs.microsoft.com/azure/devops/pipelines/get-started-yaml)

<!--
# Simple Yaml Builds

## Goals

- **Process follows code through branches**: History, diff, merge your build process including tasks!
- **Keep the spirit of simple builds that use yaml**:  The spirit is to define your language with key simple data points which derives an execution plan.  We do not want it to define an execution plan (our job) but just serialized in a different format.  If we do that, we're missing the point.
- **Easy intuitive format per language type**: Having a language type allows infered execution without having to tediously define everything. 
- **Consistent execution with web defined process**: Switching because you have a preference in yaml and code based process should lead to a consistent build.
- **Leverage heavy investment in tasks**: Multiple teams have been developing tasks for a few years.  We should leverage that effort while also providing the option to have all assets in source.
- **Execute Locally**: Should be able to execute and diagnose locally. (nice to have tool after main server impl)
- **Migrate to Yaml**: Adopt yaml.  Option in definition to create a yaml file.

## Non Goals

- **Round Trip**: We will not round trip the process and keep yaml and web edits in sync.  Pick how you want to work.

## Related Topics

[Tools](tools.md): Build and test yaml can define which toolset version to build with.  The language knows which tools has to work with. 

[Task Versions](preview.md): Yaml allows reference to task including major locked version.  In addition there will be an option to reference a task checked into source.

## Language Type and Execution

The key to being easy to use is the language.  Because of this context, much can be infered.

The current build system has a lower level job instruction format which describes the steps, the tasks, the variables which the agent uses to execute.  Yaml will offer the ability to describe higher level intent using the language to compile to a lower level job which the agent understands.  Because the language plugin understands that programming eco system, it knows how to infer what to execute based on declarative data.

In entries that are paths that end with .sln, .csproj, .sh, .cmd, .ps1, the base language handler knows to map that to the relevant task.

Finally, all yaml entries that fall through essentially map to the cmd line task.

Example:

```yaml

# a definition will be able to have multiple jobs
my build job:

  toolset: dotnet
 
  ## variables are merged and overlayed over variables defined in the web definition editor.
  variables:
    foo: bar
    baz: foo

  steps:
    
    # The dotnet toolset knows that cmdlines that first arg ends in ps1 means to inject a powershell task (defaults apply) 
    - src/ci/before.ps1 arg1 $(foo)
    - "src/ci/before with space.ps1" arg1 $(foo)

    # the dotnet language plugin also understands that "proj" maps to msbuild task
    # you can pass other inputs to the msbuild task
    # conditions supported
    - task: msbuild 
      condition: $(foo) -eq "bar"
      inputs: 
        path: src/mywebApp.csproj
        additonalArguments: /m      

    # if I need to specify other inputs for script tasks ...
    # always control option is an option
    - task: powershell
      always: $(foo) -eq "bar"
      inputs:
        path: src/ci/try.ps1 $(baz) "arg two"
        failOnStandardError: true

    # arbitrary tasks from the server can be invoked and optionally locked to a major version
    # based on the task.json metadata we know how to cast values from a string
    - task: MyCustomTask@2.x
      inputs:
        input1: input1 value
        input2: false

    # if it falls through all the special base project handlers, 
    # ends up with exec command line task
    - echo Hello World

  finally:
    # always run inferred from finally
    - src/ci/cleanup.ps1
```

## Checking in Task Assets to Source

Tasks can also be locked down to ensure all build assets can be:

  - Locked down
  - Repeatable (build a patch from an old branch)
  - Test all changes (tasks, scripts, ) and then merge 
  - Use a forked and modified version of an open source task

Tasks from source can be retrieved from the same repro (relative path in same repo) and external repos at a ref.   This offers complete control.

Example:

```yaml

# a definition will be able to have multiple jobs
my build job:

  ## Tasks
  tasks:
     myTaskRepo:
        type: git 
        location: http://somegitserver
        ref: refs/heads/mybranch

  ## specify language.
  toolset: Xcode
 
  ## variables are merged and overlayed over variables defined in the web definition editor.
  variables:
    foo: bar
    baz: foo

  steps:

    # this would use the servers installed xcode task locked to 2.x and the rest of defaults
    - task: XCode@2.x
      inputs:
        workspace: src/MyProject/My.xcworkspace    

    # This would look for the task checked into source (starts with /) relative to the root of the repo
    # other properties besides 'task' is mapped to an input 
    # SDK overwrides the highlevel property
    - task: /tasks/xcode
      inputs:
        actions: build
        SDK: $(SDK)
        workspace: src/MyProject/My.xcworkspace

    # This would look for the task checked into source (starts with /) relative to the root of the repo
    # cloned from myTaskRepo
    - task: /tasks/xcode @ myTaskRepo
      inputs:
        actions: build
        workspace: src/MyProject/My.xcworkspace      
```

## Testing Across Different Versions on Runtimes (using Installers and Tools)

Language plug-ins have associate [tool installers](tools.md).  The language plugin in this case (jsnode) has first class knowledge of node and npm and will ensure the proper version is installed and pre-pended to the path.

Variables can also be used to leverage the build service side matrix option.  This is very powerful since it offers a matrix option that runs build jobs in parallel.

```yaml
my build job:
  toolset: node
    # node language plugin knows it's so it will insert a node installer task.  So it knows nodejs element is a matrix.
    # We will have a set of 'Set xxx Runtime Version' tasks.  In this case 'Set Node Runtime Version' (think nvm)
    # Same for other runtimes like jvm, python, etc...
    # The server will create a job for each of this and add the 'Set Node Runtime Version' task first in the job with a value
    # The 'Set xxx Runtime Tasks' will use the tool installers feature above. 
    #   
    nodejs:
      - 0.12.7
      - 4.3.2

  # if steps do not exist the nodejs toolset plugin will npm install, npm test
  # you can specify
  steps:
    - task: npm
      inputs: 
        action: install

    - task: gulp

    - task: gulp
      inputs: 
        gulpfile: gulpfile.js
        action: test
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

## Service Endpoints

## Docker

## CI Triggers

TODO.  CI only - defined in yaml.

## Build Definition

The build definition in the web still has to exist.  All reporting, queues and other items hang off it.

TODO define.  Basic gist...

- Checkin yaml under .vsts folder.  Only supported in git.
- Name should be ci-{name here}.yml for build rel-{name here}.yml for a release definition.    
- A build / release definition is created in vsts by {name here} used. 
- Process tab is replaced with monaco editor in place.  Can edit and save.  We should validate on save.  Not only valid yaml but valid per lang.
- Variables still exist.  Merged with yaml defined at queue time.

## Variables

TODO - define variables in yaml.  Merged with variables on definition.

## Demands

Define what it means for demands since the web designer no longer adds the relevant demands. 

I think language offers a good opportunity here.

## New Definition Wizard Integration

New definition templates can be provided in the box or user created from a definition.  

For the in the box templates we deliver, we will deliver yaml as the template.  When you create a user template from a definition it will be either a yaml or web edited definition.

If the definition template is backed by yaml, then when creating a definition from a template, we will offer the choice of whether you want a yaml or web edited process.  We can derive both from a yaml (higher level construct) but not go the other way and create yaml from the lower level step construct.
-->
