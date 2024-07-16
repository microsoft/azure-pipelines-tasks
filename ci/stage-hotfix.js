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
console.log(`Creating ${util.hotfixLayoutPath}`)
const scriptPath = path.join(util.hotfixLayoutPath, 'hotfix.ps1');
const scriptContent = `
# Hotfix created from branch: ${branch}
# Commit: ${commitInfo}
# Hotfixing tasks: ${task}
$ErrorActionPreference='Stop'
Update-DistributedTaskDefinitions -TaskZip $PSScriptRoot/hotfix.zip
`;

console.log(`Writing script into ${scriptPath}`)
fs.writeFileSync(scriptPath, scriptContent);

// copy non-aggregate tasks zip
const zipDestPath = path.join(util.hotfixLayoutPath, 'hotfix.zip');
console.log(`Copy from ${util.tasksZipPath} to ${zipDestPath}`)
fs.copyFileSync(util.tasksZipPath, zipDestPath);
