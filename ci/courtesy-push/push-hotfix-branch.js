const path = require('path');
const cp = require('child_process');

const token = process.env.TOKEN;
const repository = process.env.REPOSITORY;
const taskName = process.env.TASK_NAME;
const username = process.env.USERNAME;
const branch = process.env.BRANCH;
const sourcesDir = process.env['BUILD_SOURCESDIRECTORY'];

const GIT = 'git';
const gitUrl = `https://${token}@dev.azure.com/mseng/AzureDevOps/_git/${repository}`;

function commitChanges(directory, pathToAdd, commitMessage) {
  execInForeground(`${GIT} add ${pathToAdd}`, directory);
  gitConfig();
  execInForeground(`${GIT} checkout -b ${branch}`, directory);
  execInForeground(`${GIT} commit -m "${commitMessage}" `, directory);
  execInForeground(`${GIT} push --set-upstream ${gitUrl} ${branch}`, directory);
}

function gitConfig() {
  execInForeground(`${GIT} config --global user.email "${username}@microsoft.com"`, null);
  execInForeground(`${GIT} config --global user.name "${username}"`, null);
}

function execInForeground(command, directory, dryrun = false) {
  directory = directory || '.';
  console.log(`% ${command}`);
  if (!dryrun) {
    cp.execSync(command, { cwd: directory, stdio: [process.stdin, process.stdout, process.stderr] });
  }
}

function commitAzureDevOpsChanges(pathToAdoRepo) {
  const unifiedDepsPath = path.join('.nuget', 'externals', 'UnifiedDependencies.xml');
  const commitMessage = `Update UnifiedDependencies.xml`;
  commitChanges(pathToAdoRepo, unifiedDepsPath, commitMessage);
}

function commitConfigChangeChanges(pathToCCRepo) {
  const hotfixFolder = process.argv[2];
  if (!hotfixFolder) {
    throw new Error('No hotfixFolder provided');
  }

  commitMessage = `Hotfix tasks: ${taskName}`;
  commitChanges(pathToCCRepo, hotfixFolder, commitMessage);
}

function main() {
  const pathToRepo = path.join(sourcesDir, repository);
  if (repository === 'AzureDevOps') {
    commitAzureDevOpsChanges(pathToRepo);
  }

  if (repository === 'AzureDevOps.ConfigChange') {
    commitConfigChangeChanges(pathToRepo);
  }
}

main();
