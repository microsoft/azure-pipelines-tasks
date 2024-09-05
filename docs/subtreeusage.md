Subtrees were added to pull in modules from other repos

git clone https://github.com/microsoft/azure-pipelines-tasks  

git remote add -f azure-pipelines-task-lib https://github.com/microsoft/azure-pipelines-task-lib
git subtree add --prefix task-lib azure-pipelines-task-lib master --squash

 it remote add -f azure-pipelines-tasks-common-packages https://github.com/microsoft/azure-pipelines-tasks-common-packages
git subtree add --prefix tasks-common azure-pipelines-tasks-common-packages main --squash