const fs = require('fs');
const { Octokit } = require("@octokit/core");

const githubPAT = process.argv[2];
const octokit = new Octokit({ auth: githubPAT });


octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}{?page,per_page}', {
  owner: 'PavloAndriiesh',
  repo: 'azure-pipelines-tasks',
  basehead: 'master...develop'
//  basehead: 'microsoft:master...develop'
}).then(res => {
  const fileNames = res.data.files.map(props => props.filename);
  const taskNames = getTaskNames(fileNames);
  const tasksMeta = fillTaskMeta(taskNames);

  console.log('filenames', fileNames);
  console.log('taskNames', taskNames);
  console.log('tasksMeta', JSON.stringify(tasksMeta));

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

    return {name, id: taskJsonFile.id}
  })
}