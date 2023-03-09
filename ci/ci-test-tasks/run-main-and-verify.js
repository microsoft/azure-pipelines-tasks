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
const intervalDelayMs = 15000;
const { BUILD_SOURCEVERSION } = process.env;
const maxRetries = 10;

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
  return new Promise((resolve, reject) => verifyBuildStatus(pipelineBuild, resolve, reject));  
}

function runMainPipeline(id, tasks) {
  return axios.post(`${apiUrl}/${id}/runs?${apiVersion}`, {"templateParameters": {tasks, BuildSourceVersion: BUILD_SOURCEVERSION}}, { auth })
  .then(res => res.data)
  .catch(err => {
    console.error(`Error running main pipeline`, err)
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
    
      const result = `Build ${pipelineBuild.name} id:${pipelineBuild.id} finished with status "${data.result}" and result "${data.result}", url: ${pipelineBuild._links.web.href}`;
    
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
          console.error(`Server error ${err.message} - retry request. Retry count: ${retryCount}`);
          return;
        } else {
          console.error('Server error, maximum retries reached. Cancel requests', err.message);
        }
      }
      
      console.error('Error verifying build status', err.message);
      clearInterval(interval);
      reject(err); 
    })
  }, intervalDelayMs)
}
