const { Octokit } = require("@octokit/core");

const githubPAT = process.argv[2];
const {BUILD_SOURCEVERSIONMESSAGE, BUILD_SOURCEVERSIONAUTHOR, SYSTEM_PULLREQUEST_SOURCEBRANCH, SYSTEM_PULLREQUEST_TARGETBRANCH} = process.env

if (!githubPAT || githubPAT === 'PAT_placeholder') {
  // TODO: replace next line with uncommented line after it before moving to prod. Testing until PAT token is added
  console.log('UseNodeV1,MavenV3');
  return;
  //throw new Error('Github PAT is missing');
}

if (BUILD_SOURCEVERSIONAUTHOR && SYSTEM_PULLREQUEST_SOURCEBRANCH && SYSTEM_PULLREQUEST_TARGETBRANCH) {
  basehead = buildBasehead(BUILD_SOURCEVERSIONAUTHOR, SYSTEM_PULLREQUEST_SOURCEBRANCH, SYSTEM_PULLREQUEST_TARGETBRANCH)
} else if (isSourceVersionMessageValid(BUILD_SOURCEVERSIONMESSAGE)) {
  basehead = buildBaseheadFromSourceVersionMessage(BUILD_SOURCEVERSIONMESSAGE)
} else {
  throw new Error('Cannot build basehead for git compare', process.env)
}

const octokit = new Octokit({ auth: githubPAT });

octokit.request('GET /repos/{owner}/{repo}/compare/{basehead}{?page,per_page}', {
  owner: 'kirill-ivlev', // TODO: replace to 'microsoft'
  repo: 'azure-pipelines-tasks',
  basehead
}).then(res => {
  const fileNames = res.data.files.map(props => props.filename);
  const taskNames = getTaskNames(fileNames);

  if (taskNames.length > 0) {
    console.log(taskNames.join(', '));
  } else {
    throw new Error('No tasks were changed. Skip testing.')
  }
})

// msg should be similar to "Merge 38aa95016d4bdb90600f43a284bd1bc1fbfdf9c0 into b8a2212ce63c56d3a6ad07d7b3a2d24ecbc472bd"
function isSourceVersionMessageValid(msg) {
  if(msg.length !== 92) {
    return false;
  }
  if (msg.split(' ') != 4) {
    return false;
  }
  if (msg.split(' ')[0] !== 'Merge' || msg.split(' ')[2] !== 'into') {
    return false;
  }

  return true;
}

function buildBasehead(sourceAuthor, sourceBranch, targetBranch) {
  return `${targetBranch}...${sourceAuthor}:${sourceBranch}`;
}

function buildBaseheadFromSourceVersionMessage(msg) {
  const targetHash = msg.split(' ')[3];
  const sourceHash = msg.split(' ')[1];
  return `${targetHash}...${sourceHash}`;
}

function getTaskNames(files) {
  const taskNames = new Set();

  files.filter(filePath => filePath.startsWith('Tasks/')).forEach(filePath => {
    taskNames.add(filePath.split('/')[1]);
  });

  return [...taskNames];
}


