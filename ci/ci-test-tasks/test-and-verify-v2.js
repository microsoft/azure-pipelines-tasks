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
  Promise.all(start(task)).then(values => {
    console.log(values);
  }).catch(err => {
    console.error(err.message);
    console.debug(err.stack);
  });
} else {
  console.error('Task name was not provided');
}

async function start(taskName) {
  const pipelines = await fetchPipelines();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  if (pipeline) {
    const configs = getBuildConfigs(taskName);
    console.log(`detected configs ${JOSN.stringify(configs)}`);
    const promises = [];
    configs.forEach(async config => {
      const pipelineBuild = await runTestPipeline(pipeline, config);
      promises.push(new Promise((resolve, reject) => verifyBuildStatus(pipelineBuild, resolve, reject)));
    });
  } else {
    console.log(`Cannot build and run tests for task ${taskName} - corresponding test pipeline was not found`);
  }

  return promises;
}


function getBuildConfigs(task) {
  console.log(`checking buildconfig for ${task}`);
  try {
      const files = fs.readdirSync('_generated');
      const tasksToTest = [];
  
      files.forEach((item) => {
        const filePath = path.join('_generated', item);
        const stats = fs.statSync(filePath);
  
        if (stats.isDirectory() && item.indexOf(task) !== -1) {
          tasksToTest.push(item);
        }
      });
      return tasksToTest;
    } catch (error) {
      console.error('Error reading subdirectories:', error);
      return [task];
    }
}

function fetchPipelines() {
  return axios
    .get(`${apiUrl}?${apiVersion}`, { auth })
    .then(res => res.data.value)
    .catch(err => {
      err.stack = 'Error fetching pipelines: ' + err.stack;
      console.error(err.stack);
      if (err.response?.data) {
        console.error(err.response.data);
      }

      throw err;
    });
}

function runTestPipeline(pipeline, config = '') {
  console.log(`Run ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`);
  console.log(JSON.stringify(process.env));
  const { CANARY_TEST_BRANCH } = process.env;
  return axios
    .post(`${apiUrl}/${pipeline.id}/runs?${apiVersion}`, 
    {
      variables: {
        CANARY_TEST_TASKNAMES: { 
          "isSercret": false,
          "value": pipeline.name,
        },
        CANARY_TEST_BRANCH: {
          "isSecret": false,
          "value": CANARY_TEST_BRANCH,
        },
        CANARY_TEST_CONFIG: {
          "isSecret": false,
          "value": config 
        }
      },
    }, { auth })
    .then(res => res.data)
    .catch(err => {
      err.stack = `Error running ${pipeline.name} pipeline. ` + err.stack;
      console.error(err.stack);
      if (err.response?.data) {
        console.error(err.response.data);
      }

      throw err;
    });
}

async function verifyBuildStatus(pipelineBuild, resolve, reject, config = '') {
  console.log(`Verify build ${pipelineBuild.name} status, url: ${pipelineBuild._links.web.href}`);

  let retryCount = 0;

  const interval = setInterval(() => {
    axios
      .get(pipelineBuild.url, { auth })
      .then(({ data }) => {
        console.log(`Verify build status... ${data.state}`);

        if (data.state !== 'completed') {
          return;
        }

        clearInterval(interval);

        const result = `Build ${pipelineBuild.name} id:${pipelineBuild.id} finished with status "${data.state}" and result "${data.result}", url: ${pipelineBuild._links.web.href}`;

        if (data.result === 'succeeded') {
          resolve(result);
        } else {
          reject(new Error(result));
        }
      })
      .catch(err => {
        if (err.code === 'ETIMEDOUT' || (err.response && err.response.status >= 500)) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Error ${err.message} - retry request. Retry count: ${retryCount}`);
            return;
          } else {
            console.error('Error, maximum retries reached. Cancel retries', err.message);
          }
        }

        clearInterval(interval);
        err.stack = 'Error verifying build status: ' + err.stack;
        console.error(err.stack);
        if (err.response?.data) {
          console.error(err.response.data);
        }

        reject(err);
      });
  }, intervalDelayMs);
}

process.on('uncaughtException', err => {
  console.error('Uncought exception:');
  console.error(err.message);
  console.debug(err.stack);
});
