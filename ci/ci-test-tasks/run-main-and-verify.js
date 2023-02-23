const axios = require('axios');

const AUTH_TOKEN = process.argv[2];
const ADOUrl = process.argv[3];
const ProjectName = process.argv[4];
const mainPipelineId = process.argv[5];
const tasks = process.argv[6];
const apiVersion = 'api-version=7.0';
const apiUrl = `${ADOUrl}/${ProjectName}/_apis/pipelines`;
const auth = {
  username: 'Basic',
  password: AUTH_TOKEN
};
const intervalDelayMs = 30000;

if (tasks) {
  return start(tasks)
  .then(resultMessage => console.log(resultMessage))
  .catch(err => {
    console.error(err);
  });
} else {
  console.error('Task name was not provided');
}

async function start(tasks) {
  const pipelineBuild = await runMainPipeline(mainPipelineId, tasks);
  return verifyTestRunResults(pipelineBuild);  
}

function runMainPipeline(id, tasks) {
  return axios.post(`${apiUrl}/${id}/runs?${apiVersion}`, {"templateParameters": {tasks}}, { auth })
  .then(res => res.data)
  .catch(err => {
    console.error(`Error running main pipeline`, err)
    throw err;
  })
}

function verifyTestRunResults(pipelineBuild) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      verifyBuildStatus(pipelineBuild, interval, resolve, reject);
    }, intervalDelayMs)
  
    console.log(`Check status for build ${pipelineBuild.name}, id: ${pipelineBuild.id}:`);
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

  const result = `Build ${pipelineBuild.name} id:${pipelineBuild.id} finished with status "${data.result}" and result "${data.result}"`;

  if (data.result === 'succeeded') {
    resolve(result);
  } else {
    reject(result);
  }
}
