## Usage examples

node make.js build --includeLocalPackagesBuildConfig
node make.js build --includeLocalPackagesBuildConfig --task MavenV4

## What does specifing --includeLocalPackagesBuildConfig do?

It produces a new LocalPackages config, which updates several package.json references to point to local files.

A single version is used for all LocalPackages, stored in [gitroot]\globalversion.txt.  globalversion.txt is only created if "—includeLocalPackagesBuildConfig" is specified.

globalversion.txt (if present) is updated to avoid clashes with existing task versions.  The global version specified is use for tasks generated under LocalPackages build.config.  The version number is [major from task].[sprint].[patch]

This hybrid approach is transitionary.  In the future, all build configs (including the default) will use the global version.

## sub-tree

Subtrees were added to pull in modules from other repos

git clone https://github.com/microsoft/azure-pipelines-tasks  


# add (one time)
git remote add -f azure-pipelines-task-lib https://github.com/microsoft/azure-pipelines-task-lib
git subtree add --prefix task-lib azure-pipelines-task-lib master --squash

git remote add -f azure-pipelines-tasks-common-packages https://github.com/microsoft/azure-pipelines-tasks-common-packages
git subtree add --prefix tasks-common azure-pipelines-tasks-common-packages main --squash

# pull
git subtree pull --prefix task-lib azure-pipelines-task-lib master --squash
git subtree pull --prefix tasks-common azure-pipelines-tasks-common-packages main --squash

