const fs = require('fs');
const { Octokit } = require("@octokit/core");

console.log(process.argv);
const githubPAT = process.argv[2];
const sourceBranch = process.argv[3];
const octokit = new Octokit({ auth: githubPAT });

console.log('BuildSourceBranch', BuildSourceBranch, BuildSourceBranchName);

octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}{?page,per_page}', {
  owner: 'PavloAndriiesh',
  repo: 'azure-pipelines-tasks',
  basehead: 'master...' + sourceBranch
//  basehead: 'microsoft:master...develop'
}).then(res => {
  const fileNames = res.data.files.map(props => props.filename);
  const taskNames = getTaskNames(fileNames);
  const tasksMeta = fillTaskMeta(taskNames);

  console.log(JSON.stringify(tasksMeta));
}).catch(err => {
  console.error(err);
})

function getTaskNames(files) {
  const taskNames = new Set();

  files.filter(filePath => filePath.startsWith('Tasks/')).forEach(filePath => {
    taskNames.add(filePath.split('/')[1]);
  });

  return [...taskNames];
}

function fillTaskMeta(taskNames) {
  return taskNames.map(name => {
    const filePath = 'Tasks/' + name + '/task.json';
    const rawdata = fs.readFileSync(filePath);
    const taskJsonFile = JSON.parse(rawdata);

    return {[name]: taskJsonFile.id}
  })
}