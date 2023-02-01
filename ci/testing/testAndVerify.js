const axios = require('axios');
const hostname = 'https://dev.azure.com';
const organization = 'canary2-poc';
const project = 'tasks-canary';
const apiVersion = '7';
const url = 'https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7';

const AUTH_TOKEN = process.argv[2];
const tasks = process.argv[3];

if (tasks) {
  start(tasks);
} else {
  console.log('Skip test verification');
}

async function start(tasks) {
  const taskNames = tasks.split(',');

  const pipelines = await getPipelines();
  console.log(pipelines);

  const map = mapPipelines(pipelines);
  return Promise.all(taskNames.map(async taskName => {
    if (map[taskName]) {
      const pipelineBuild = await runTestPipeline(map[taskName]);
      return verifyTestRunResults(pipelineBuild);  
    } else {
      console.error(`Error: pipeline ${taskName} was not found`);
    }
  }))
}

function mapPipelines(pipelines) { 
  const map = {};

  pipelines.forEach(data => {
    map[data.name] = data;
  })

  return map;
}

function getPipelines() {
  return axios.get(`https://dev.azure.com/${organization}/${project}/_apis/pipelines?api-version=7.0`, { 
    auth: {
       username: 'Basic',
       password: AUTH_TOKEN
    }
  })
  .then(res => res.data.value)
  .catch(err => {
    console.error(err);
    throw err;
  });
}

function runTestPipeline(pipeline) {
  console.log(`Run test pipeline for ${pipeline.name} task, pipelineId: ${pipeline.id}`);

  return axios.post(`https://dev.azure.com/${organization}/${project}/_apis/pipelines/${pipeline.id}/runs?api-version=7.0`, {},{
    auth: {
      username: 'Basic',
      password: AUTH_TOKEN
   }
  })
  .then(res => res.data)
  .catch(err => err)
}

function verifyTestRunResults(pipelineBuild) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      verifyBuildStatus(pipelineBuild, timeout, resolve, reject);
    }, 1000)
  
    console.log(pipelineBuild)
    console.log(`Observe test pipeline for ${pipelineBuild.name} task`);
  })
}

async function verifyBuildStatus(pipelineBuild, timeout, resolve, reject) {
  const response = await axios.get(pipelineBuild.url, {
    auth: {
      username: 'Basic',
      password: AUTH_TOKEN
    }
  })
  
  if (response.data.state === 'inProgress') {
    console.log('Verify build status... in progress')
    return;
  }

  clearTimeout(timeout);
  console.log(`Pipeline build finished with status ${response.data.result}`);
  if (response.data.result === 'failed') {
    reject('Test pipeline build failed')
  } else {
    resolve('Test pipeline build succeeded')
  }
}




// curl --user "":"$(ADOToken)" -H "Content-Type: application/json" -H "Accept:application/json" "https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7" -X POST -d "{\"templateParameters\": { \"tasks\": \"$TASKS\"}}"