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
const intervalDelayMs = 15000;
const maxRetries = 10;

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
    return new Promise((resolve, reject) => verifyBuildStatus(pipelineBuild, resolve, reject));  
  } else {
    console.log(`Cannot build and run tests for task ${taskName} - corresponding test pipeline was not found`);
  }
}

function fetchPipelines() {
  return axios.get(`${apiUrl}?${apiVersion}`, { auth })
  .then(res => res.data.value)
  .catch(err => {
    err.stack = 'Error fetching pipelines: ' + err.stack;
    throw err;
  });
}

function runTestPipeline(pipeline) {
  console.log(`Run ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`);

  return axios.post(`${apiUrl}/${pipeline.id}/runs?${apiVersion}`, {}, { auth })
  .then(res => res.data)
  .catch(err => {
    err.stack = `Error running ${pipeline.name} pipeline, pipelineId ${pipeline.id}: ` + err.stack;
    throw err;
  })
}

async function verifyBuildStatus(pipelineBuild, resolve, reject) {
  console.log(`Verify build ${pipelineBuild.name} status, url: ${pipelineBuild._links.web.href}`);

  let retryCount = 0;

  const interval = setInterval(() => {
    axios.get(pipelineBuild.url, { auth })
    .then(({data}) => {
      console.log(`Verify build status... ${data.state}`);
  
      if (data.state !== 'completed') {
        return;
      }
    
      clearInterval(interval);
    
      const result = `Build ${pipelineBuild.name} id:${pipelineBuild.id} finished with status "${data.state}" and result "${data.result}", url: ${pipelineBuild._links.web.href}`;
    
      if (data.result === 'succeeded') {
        resolve(result);
      } else {
        reject(result);
      }
    })
    .catch(err => {
      if (err.response && err.response.status >= 500) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Server error ${err.message} - retry request. Retry count: ${retryCount}`);
          return;
        } else {
          console.error('Server error, maximum retries reached. Cancel retries', err.message);
        }
      }
    
      clearInterval(interval);
      err.stack = 'Error verifying build status: ' + err.stack;
      reject(err); 
    })
  }, intervalDelayMs)
}

process.on('uncaughtException', err => {
  console.error(err.stack);
});
