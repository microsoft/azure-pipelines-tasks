# Bumping task version
To bump the task version - please change the 'version' field in the task.json and task.loc.json files following the steps below:
1. Check the current Azure DevOps sprint - https://whatsprintis.it/
2. If the sprint number differs from the current minor number - set it to the current sprint number, and set the patch to 0. Since there is a cut-off on Tuesday of the 3rd week of the sprint - for changes on the 3rd sprint week after Tuesday - set it up as (current sprint number) + 1. For this case, changes will be shipped with the next release.
3. If the minor version and the sprint number are the same - increase the patch number

For major changes (large behavioral changes or changes without backward support) increase the major number.
