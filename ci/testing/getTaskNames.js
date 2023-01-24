const githubPAT = process.argv[2];

const { Octokit } = require("@octokit/core");

const octokit = new Octokit({ auth: githubPAT });

octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}{?page,per_page}', {
  owner: 'PavloAndriiesh',
  repo: 'azure-pipelines-tasks',
  basehead: 'master...develop'
//  basehead: 'microsoft:master...develop'
}).then(res => {
  const filenames = res.data.files.map(props => props.filename);
  const taskNames = getTaskNamesFromOutput(filenames)
  const taskNamesAndIds = fillTaskIds(taskNames);

  console.log(taskNamesAndIds);
}).catch(err => {
  console.error(err);
})

function getTaskNamesFromOutput(files) {
  const taskNames = new Set();
  const taskFiles = files.filter(line => line.startsWith('Tasks/'));
  taskFiles.forEach(pathToFile => {
    let taskName = pathToFile.slice(6); // remove Tasks/ prefix
    taskName = taskName.slice(0, taskName.indexOf('/')); // remove path after task name
    taskNames.add(taskName);
  })

  return [...taskNames];
}

function fillTaskIds(taskNames) {
  return taskNames.map(taskName => ({name: taskName, id: 'id_placeholder'}))
}