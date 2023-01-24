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
  const filenames = res.data.files.map(props => props.filename);
  const tasksJsonFiles = filterTaskJsonFiles(filenames)
  const tasksMeta = fillTaskMeta(tasksJsonFiles);

  console.log(JSON.stringify(tasksMeta));
}).catch(err => {
  console.error(err);
})

function filterTaskJsonFiles(files) {
  return files.filter(line => line.startsWith('Tasks/') && line.endsWith('/task.json') && line.split('/').length === 3);
}

function fillTaskMeta(taskJsonFiles) {
  return taskJsonFiles.map(path => {
    const rawdata = fs.readFileSync(path);
    const taskJsonFile = JSON.parse(rawdata);

    return {name: taskJsonFile.name, id: taskJsonFile.id, folderName: path.split('/')[1]}
  })
}