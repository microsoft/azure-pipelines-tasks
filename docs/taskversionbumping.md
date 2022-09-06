# Bumping task version
To bump task version - please change 'version' field in task.json and task.loc.json files following the steps below:
1. Check current Azure DevOps sprint - https://whatsprintis.it/
2. If sprint number differs from current minor number - set it to current sprint number, set patch to 0. Since there is cut off on Tuesday of the 3rd week of the sprint - for changes on 3rd sprint week after Tuesday - set it up as (current sprint number) + 1. For this case changes will be shipped with the next release.
3. If the minor version and the sprint number are the same - increase patch number

For major changes (large behavioral changes or changes without backward support) increase major number.