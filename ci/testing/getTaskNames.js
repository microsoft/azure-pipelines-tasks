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

  // console.log(JSON.stringify([{name: 'name1', id: 'id1'}, {name: 'name2', id: 'id2'}, {name: 'name3', id: 'id3'}]));
  console.log(JSON.stringify([{name1: 'id1'}, {name2: 'id2'}, {name3: 'id3'}]));
  // console.log(JSON.stringify(tasksMeta.concat([{name: 'name1', id: 'id1'}, {name: 'name2', id: 'id2'}, {name: 'name3', id: 'id3'}])));
  // console.log(JSON.stringify(tasksMeta.concat([{name1: 'id1'}, {name2: 'id2'}, {name3: 'id3'}])));
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
    // return {[name], id: taskJsonFile.id}
  })
}