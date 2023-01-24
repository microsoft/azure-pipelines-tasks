const fs = require('fs');
const { Octokit } = require("@octokit/core");

const commitHashLength = 40;

const githubPAT = process.argv[2];
const source =  process.argv[4];
const target =  process.argv[6];

if (!githubPAT) {
  throw new Error('Github PAT is missing');
} else if (!source || source.length !== commitHashLength || !target || target.length !== commitHashLength) { 
  throw new Error('Build.SourceVersionMessage is invalid. Expected similar to "Merge 03030baaa23bad9c201711375827a80f36120fc7 into 04aa704021853c2a79620ce544b0ade5252d34c7"');
}

const octokit = new Octokit({ auth: githubPAT });


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