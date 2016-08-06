# Simple Yaml Builds

## Goals

- **Process follows code through branches**: History, diff, merge your build process.
- **Easy intuitive format per language type**: Having a language type allows infered execution without having to tediously define everything.
- **Easy migration to and from web based definition**: This includes a tool which maps 
- **Consistent execution with web defined process**: Switching because you have a preference in yaml and code based process should lead to a consistent build.
- **Leverage heavy investment in tasks**: Multiple teams have been developing tasks for a few years.  We should leverage that effort.
- **Execute Locally**: Should be able to execute and diagnose locally.  

## Language Type and Execution

The key to being easy to use is the language.  Because of this context, much can be infered.

The current build system has a json job format which describes the steps, the tasks, the variables which the agent uses to execute.

At a high level, we are simply using the language context to execute the proper language plugin (extensible - initially just be us) which is essentially a yaml to job json translator.  Because the language plugin understands that programming eco system, it knows how to infer what to execute based on declarative data.

As an example, lets look at a jsnode yaml.  The jsnode plugin knows project.json is special.  It knows it's executed via node so simple test matrix options lead to node installers being invoked.

[Tool installers relevant](tools.md)

It also understands that npm maps to the npm task and it is locked to the 2.x version of the task.

[Locking to versions of tasks relevant](preview.md)

It doesn't understand yaml entries that don't reference npm but it passes it down to the languageBase handler.

In entries that are paths that end with .sh, .cmd, .ps1, the base language handler knows to map that to the relevant task.

Finally, all yaml entries that fall through essentially map to the cmd line task.

Line entries can also have conditions against the state, trigger type etc... that are eval'd when being executed.

Example:

```yaml
language: jsnode
install:
  # node project type would just run npm install if install node exists
  # node project plugin knows npm task with install args is how it's done.
  - src/project.json

build:
  # each line is handed to the project type plugin.
  # in this case, the node project plugin cares paths that end with project.json
  # so node project plugin in this case would cd in that dir 
  - src/project.json

  # if it's not something handled by project plugin, goes to the base
  # base plugin has handlers for sh, cmd, ps1 etc... and auto maps to the appropriate task
  - src/ci/before.sh

  # if it falls through all the special base project handlers, 
  # ends up with exec command line task
  # this has no conditions so will not run if something failed previously
  - tsc

  # condition on failed or always run.  eval condition
  # shell script task will run this 
  - [state.status == 'failed'] src/ci/post_fail.sh
  - [state.any] src/ci/cleanup.sh

test:
  # each project type plugin can run installers.  the installer is associated 
  # with the projectType.  In this case node project type knows how to install node.
  # in this specific example, even though service can do matrix, we're asking to build once
  # and run tests multiple times
  # yaml runners knows to append timeline nodes so you would see Test Node 4.x, Test Node 5.x in run
  matrix:
    - 4
    - 5
    - 6
  # this calls our npm task
  # the yaml runner passes the string off to the task
  # locked to version 2.x our task
  - npm@2 test

```

## CI Triggers

TODO

## Installers

Tools can be lazily installed.  [More here](tools.md).  

Language plugins know what tools they run and install.  In the example above, the matrix with a simple definition of 4, 5, 6 is understood to be node.

## Test Matrix

TODO: flush out

Basic sample above.  Intent is to allow service side matrix job explosion

## Step Conditions

Basic examples above.  Condition of current state, trigger type (PR doesn't run but CI does) and more.

TODO flush out.
   