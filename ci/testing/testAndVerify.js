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
  const promises = taskNames.map(async taskName => {
    if (map[taskName]) {
      const pipelineBuild = await runTestPipeline(map[taskName]);    
      await verifyTestRunResults(pipelineBuild);  
    } else {
      console.error(`Error: pipeline ${taskName} was not found`);
    }
  });
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

  return axios.post(`https://dev.azure.com/${organization}/${project}/_apis/pipelines${pipeline.id}/runs?api-version=7.0`, {
    templateParameters: {}
  },{ 
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })
  .then(res => res.data)
  .catch(err => err)
}

function verifyTestRunResults(pipelineBuild) {
  console.log(`Observe test pipeline for ${pipeline.name} task`);
}




// curl --user "":"$(ADOToken)" -H "Content-Type: application/json" -H "Accept:application/json" "https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7" -X POST -d "{\"templateParameters\": { \"tasks\": \"$TASKS\"}}"