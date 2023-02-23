const axios = require('axios');

const AUTH_TOKEN = process.argv[2];
const ADOUrl = process.argv[3];
const ProjectName = process.argv[4];
const task = process.argv[5];
const apiVersion = 'api-version=7.0';
const apiUrl = `${ADOUrl}/${ProjectName}/_apis/pipelines`;

const auth = {
  username: 'Basic',
  password: AUTH_TOKEN
};
const intervalDelayMs = 30000;

if (task) {
  return start(task)
  .then(resultMessage => console.log(resultMessage))
  .catch(err => {
    console.error(err);
  });
} else {
  console.error('Task name was not provided');
}

async function start(taskName) {
  const pipelines = await fetchPipelines();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  if (pipeline) {
    const pipelineBuild = await runTestPipeline(pipeline);
    return verifyTestRunResults(pipelineBuild);  
  } else {
    console.log(`Cannot build and run tests for task ${taskName} - corresponding test pipeline was not found`);
  }
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
    }, intervalDelayMs)
  
    console.log(`Check status for build ${pipelineBuild.name}, id: ${pipelineBuild.id}, url: ${pipelineBuild.url}`);
  })
}

async function verifyBuildStatus(pipelineBuild, timeout, resolve, reject) {
  const data = await axios.get(pipelineBuild.url, { auth })
    .then(res => res.data)
    .catch(err => {
      clearTimeout(timeout);
      console.error('Error verifying build status', err);
      reject(err);
    })
  
  console.log(`Verify build status... ${data.state}`);
  
  if (data.state !== 'completed') {
    return;
  }

  clearTimeout(timeout);

  const result = `Build ${pipelineBuild.name} id:${pipelineBuild.id} finished with status "${data.result}" and result "${data.result}", url: ${pipelineBuild.url}`;

  if (data.result === 'succeeded') {
    resolve(result);
  } else {
    reject(result);
  }
}
