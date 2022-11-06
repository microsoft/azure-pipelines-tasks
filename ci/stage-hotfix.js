const fs = require('fs');
const path = require('path');
const util = require('./ci-util');

const task = process.argv[2];

// during CI agent checks out a commit, not a branch.
// $(build.sourceBranch) indicates the branch name, e.g. releases/m108
// assumes user has checked out a branch. this is a fairly safe assumption.
// this code only runs during "package" and "publish" build targets, which is not typically run locally.
const branch = process.env.TF_BUILD ? process.env.BUILD_SOURCEBRANCH : util.run('git symbolic-ref HEAD');

const commitInfo = util.run('git log -1 --format=oneline');

// create the script
fs.mkdirSync(util.hotfixLayoutPath);
const scriptPath = path.join(util.hotfixLayoutPath, `${task}.ps1`);
const scriptContent = `
# Hotfix created from branch: ${branch}
# Commit: ${commitInfo}
$ErrorActionPreference='Stop'
Update-DistributedTaskDefinitions -TaskZip $PSScriptRoot/${task}.zip
`;

fs.writeFileSync(scriptPath, scriptContent);

// link the non-aggregate tasks zip
const zipDestPath = path.join(util.hotfixLayoutPath, `${task}.zip`);
fs.linkSync(util.tasksZipPath, zipDestPath);
