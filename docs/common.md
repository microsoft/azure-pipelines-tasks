# Proposed Changes to Common

## Problem Statement

Currently, tasks rely heavily on the `Common` directory in this repo. Some packages in `Common` have 20+ tasks relying on them.
Despite this, `Common` has several key issues. These issues can probably be viewed orthogonally, though it is also possible
that solutions may address more than one of these issues. The issues we have identified are as follows:

#### Updates to Common from one task author can break other tasks

Unlike npm modules, for example, which have versioning to address this issue, there is no way for tasks to be sure that
their dependencies on `Common` won't slide under them. This means that if one task author updates `Common` in a way that breaks
assumptions, then other tasks can break.

This also increases risk, since a bug in one place can break 20+ tasks

#### Task authors have a tendency to import more than needed from Common

This is actually true beyond just `Common` with npm modules, but it is most obvious in `Common` - often tasks will import large `Common`
packages when they really just need access to a simple utility function. This leads to bloated tasks that are much larger than they
need to be, ultimately leading to slower download times and more memory utilization.

#### There is no clear owner of Common or the individual components within

This makes triaging/fixing issues challenging when the issue is with `Common` (aka who should be in charge of the fix?).

## Proposed Fixes

To address this, we are proposing the following changes:

#### Updates to common from one task author can break other tasks

TODO - Its unclear to me what the best solution is here. Possible options include:

1. Turn `Common` into npm modules (and publish in our CI process). This introduces versioning,
but means we would need 2 PRs to use Common, one to introduce common change and one to consume the newest version.
2. Break `Common` into its own repo - this is basically just a stronger version of (1).
3. Do away with `Common` - this would probably mean a combination of moving things to the task-lib and into individual tasks.

#### Task authors have a tendency to import more than needed from Common

Explored Webpack, pretty sure its not the answer - since its a static module bundler and we have too much dynamic require logic required around loading resource files. We can remove some of this with the goal of getting there eventually, but we'd have to upgrade every tasks version of the task-lib that they're consuming first.

Other potential optimizations:

1. Compress/minify files - Reduces size but leads to ugly/hard to diagnose tasks.
2. Introduce tooling to track size of tasks (probably run during CI and flag changes that introduce lots of storage overhead - maybe require admin approval?)
3. Manually go through tasks and try to clean up extra imports. This could be done in conjunction with (2) (aka (2) finds overhead, we go in and fix it - or shell that work out to task authors)

#### There is no clear owner of Common or the individual components within

Add codeowners for each `Common` package. Maybe even enforce this in the build. If no one is willing to take charge as codeowner, cut it and force task writers to move that into their own tasks. We can also consider adding some things to task-lib (we want to be careful not to bloat this though).
