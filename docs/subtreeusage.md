Build examples:

node make.js build --includeLocalPackagesBuildConfig
node make.js build --includeLocalPackagesBuildConfig --task MavenV4

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

