const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AUTH_TOKEN = process.argv[2];
const ADOUrl = process.argv[3];
const ProjectName = process.argv[4];
const taskArg = process.argv[5];
const apiVersion = 'api-version=7.0';
const apiUrl = `${ADOUrl}/${ProjectName}/_apis/pipelines`;

const auth = {
  auth: {
    username: 'Basic',
    password: AUTH_TOKEN
  }
};

const intervalInSeconds = 20;
const buildTimeoutInMinutes = 300;
const maxRetries = 10;

async function main() {
  if (!taskArg) {
    console.error('Task list is not provided');
    return;
  }
  const tasks = taskArg.split(',');
  const runningTests = [];
  for (const task of tasks) {
    console.log(`starting tests for ${task}`);
    runningTests.push(...await start(task));
  }
  Promise.all(runningTests).then(data => {
    console.log(data);
  }).catch(error => {
    console.error(error);
  });
}

async function start(taskName) {
  const pipelines = await fetchPipelines();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  if (pipeline) {
    const configs = getBuildConfigs(taskName);
    console.log(`Detected buildconfigs ${JSON.stringify(configs)}`);
    const promises = [];
    for (const config of configs) {
      console.log(`Running tests for ${taskName} with config ${config} for pipeline ${pipeline.name}`)
      const pipelineBuild = await runTestPipeline(pipeline, config);
      const promise = new Promise((resolve, reject) => verifyBuildStatus(taskName, pipelineBuild, resolve, reject))
      promises.push(promise);
    }

    return promises;
  }

  console.log(`Cannot build and run tests for task ${taskName} - corresponding test pipeline was not found`);

  return [];
}

function getBuildConfigs(task) {
  console.log(`checking buildconfig for ${task}`);
  try {
    const items = fs.readdirSync('_generated');
    const tasksToTest = [];

    for (const item of items) {
      const itemPath = path.join('_generated', item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory() && item.startsWith(task)) {
        tasksToTest.push(item);
      }
    }

    if (tasksToTest.length === 0) {
      tasksToTest.push(task);
    }
    return tasksToTest;
  } catch (error) {
    console.error(`Error reading subdirectories: ${error}`);
    return [task];
  }
}

function fetchPipelines() {
  return axios
    .get(`${apiUrl}?${apiVersion}`, auth)
    .then(res => res.data.value)
    .catch(err => {
      err.stack = `Error fetching pipelines: ${err.stack}`;
      console.error(err.stack);
      if (err.response?.data) {
        console.error(err.response.data);
      }

      throw err;
    });
}

const pipelineVariable = (key, value) => ({ [key]: { value, isSecret: false } });

function runTestPipeline(pipeline, config = '') {
  console.log(`Run ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`);
  const { BUILD_SOURCEVERSION: branch, CANARY_TEST_NODE_VERSION: nodeVersion } = process.env;
  return axios
    .post(`${apiUrl}/${pipeline.id}/runs?${apiVersion}`, {
      variables: {
        ...pipelineVariable('CANARY_TEST_TASKNAME', pipeline.name),
        ...pipelineVariable('CANARY_TEST_BRANCH', branch),
        ...pipelineVariable('CANARY_TEST_CONFIG', config),
        ...pipelineVariable('CANARY_TEST_NODE_VERSION', nodeVersion)
      },
    }, auth)
    .then(res =>  res.data)
    .catch(err => {
      err.stack = `Error running ${pipeline.name} pipeline. ${err.stack}`;
      console.error(err.stack);
      if (err.response?.data) {
        console.error(err.response.data);
      }

      throw err;
    });
}

async function verifyBuildStatus(pipelineName, pipelineBuild, resolve, reject) {
  const stringifiedBuild = `build (id: [" ${pipelineBuild.id} "], url: [" ${pipelineBuild._links.web.href} "], pipeline: [" ${pipelineName} "])`;
  console.log(`Verifying state of the ${stringifiedBuild}`);

  let retryCount = 0;

  let intervalAmount = 0;
  const interval = setInterval(() => {
    axios
      .get(pipelineBuild.url, auth)
      .then(({ data }) => {
        console.log(`State of the ${stringifiedBuild}: "${data.state}"`);

        if (data.state !== 'completed') {
          if (++intervalAmount * intervalInSeconds >= buildTimeoutInMinutes * 60) {
            clearInterval(interval);

            reject(new Error(`Timeout to complete the ${stringifiedBuild} exceeded`));
          }

          return;
        }

        clearInterval(interval);

        const result = `The ${stringifiedBuild} completed with result "${data.result}"`;

        if (data.result === 'succeeded') {
          resolve(result);
        } else {
          reject(new Error(result));
        }
      })
      .catch(err => {
        if (['ETIMEDOUT', 'ECONNRESET'].includes(err.code) || err.response?.status >= 500) {
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Error verifying state of the ${stringifiedBuild}, retry request. Retry count: ${retryCount}. Error message: ${err.message}`);
            return;
          } else {
            console.error(`Error verifying state of the ${stringifiedBuild}, maximum retries reached. Cancel retries. Error message: ${err.message}`);
          }
        }

        clearInterval(interval);
        err.stack = `Error verifying build status: ${err.stack}`;
        console.error(err.stack);
        if (err.response?.data) {
          console.error(err.response.data);
        }

        reject(err);
      });
  }, intervalInSeconds * 1000);
}

process.on('uncaughtException', err => {
  console.error(`Uncaught exception: ${err.message}`);
  console.debug(err.stack);
});

main();
