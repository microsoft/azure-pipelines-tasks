const axios = require('axios');

const HOSTNAME = 'https://dev.azure.com';
const ORGANIZATION = 'canary2-poc';
const PROJECT = 'tasks-canary';
const apiVersion = 'api-version=7.0';
const apiUrl = `${HOSTNAME}/${ORGANIZATION}/${PROJECT}/_apis/pipelines`;
const AUTH_TOKEN = process.argv[2];
const tasks = process.argv[3];
const auth = {
  username: 'Basic',
  password: AUTH_TOKEN
};

if (tasks) {
  return start(tasks);
} else {
  console.log('Skip test verification');
}

async function start(tasks) {
  const taskNames = tasks.split(',');

  if (taskNames.length) {
    const pipelines = await fetchPipelines();
    const map = mapPipelines(pipelines);
  
    return Promise.all(taskNames.map(async taskName => {
      if (map[taskName]) {
        const pipelineBuild = await runTestPipeline(map[taskName]);
        return verifyTestRunResults(pipelineBuild);  
      } else {
        console.error(`Error: cannot build and run tests for task ${taskName} - corresponding pipeline was not found`);
      }
    }))
  }
}

function mapPipelines(pipelines) { 
  const map = {};

  pipelines.forEach(data => {
    map[data.name] = data;
  })

  return map;
}

function fetchPipelines() {
  return axios.get(`${apiUrl}?${apiVersion}`, { auth })
  .then(res => res.data.value)
  .catch(err => {
    console.error('Error fetching pipelines', err);
    throw err;
  });
}

function runTestPipeline(pipeline) {
  console.log(`Run ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`);

  return axios.post(`${apiUrl}/${pipeline.id}/runs?${apiVersion}`, {}, { auth })
  .then(res => res.data)
  .catch(err => {
    console.error(`Error running ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`, err)
    throw err;
  })
}

function verifyTestRunResults(pipelineBuild) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      verifyBuildStatus(pipelineBuild, interval, resolve, reject);
    }, 1000)
  
    console.log(`Check status for build ${pipelineBuild.name}, id: ${pipelineBuild.id} task...`);
  })
}

async function verifyBuildStatus(pipelineBuild, timeout, resolve, reject) {
  const data = await axios.get(pipelineBuild.url, { auth })
    .then(res => res.data)
    .catch(err => {
      console.error('Error verifying build status', err);
      throw err;
    })
  
  console.log(`Verify build status... ${data.state}`);
  
  if (data.state === 'inProgress') {
    return;
  }

  clearTimeout(timeout);
  console.log(`Pipeline build finished with status ${data.result}`);
  if (data.result === 'failed') {
    reject('Test pipeline build failed')
  } else {
    resolve('Test pipeline build succeeded')
  }
}
