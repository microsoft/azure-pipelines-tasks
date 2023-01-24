const fs = require('fs');
const { Octokit } = require("@octokit/core");

console.log('process.argv', process.argv);

const githubPAT = process.argv[2];
const SourceVersionMessage = process.argv[3];
const octokit = new Octokit({ auth: githubPAT });
const source = SourceVersionMessage.split(' ')[1];
const target = SourceVersionMessage.split(' ')[3];

octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}{?page,per_page}', {
  owner: 'PavloAndriiesh', // TODO: replace to 'microsoft'
  repo: 'azure-pipelines-tasks',
  basehead: target + '...' + source
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