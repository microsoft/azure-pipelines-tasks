# CI Changes

Effective December 17, we will be changing how we perform CI and PR builds. 
Currently, we build all tasks sliced across 5 different jobs, but now we will be doing the following:

## PR builds

For PR builds we will only build tasks that could have been affected by the PR changes. 
This includes **tasks that have been directly changed** as well as **tasks that use changed files in the ```Tasks/common``` directory**.

## CI builds

For CI builds we will only build **tasks that have different version numbers than the published version**.

## Accompanying changes

1. To try to keep the number of tasks built by CI lower and speed it up, we will perform a courtesy publish of tasks once a week (previously we had done this once every 3 weeks).

2. Tasks will now be built in a single job instead of being sliced across 5 jobs.

## Response

There are a couple things that task authors can do to make this transition great:

1. If you notice any problems with CI, create a github issue and tag @damccorm

2. Try to avoid being overly reliant on files in ```Tasks/common```. This will speed up PR builds since we will have to build fewer tasks.
Additionally, we have noticed a lot of bloated tasks that are much bigger than they need to be due to using 1 or 2 shared functions that require importing large files.
Reducing reliance on ```Tasks/common``` helps address both these issues.
