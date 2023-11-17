
import axios from 'axios';

import { PipelineBuild } from './interfaces';
import { getBuildConfigs, pipelineVariable } from './helpers';

// Static constants
const API_VERSION = 'api-version=7.0';

// Args
const AuthToken = process.argv[2];
const AdoUrl = process.argv[3];
const ProjectName = process.argv[4];
const TaskArg = process.argv[5];

// Dynamic constants
const ApiUrl = `${AdoUrl}/${ProjectName}/_apis`;

const auth = {
  auth: {
    username: 'Basic',
    password: AuthToken
  }
};

async function main() {
  if (!TaskArg) {
    console.error('Task list is not provided');
    return;
  }

  const tasks = TaskArg.split(',');

  const runningTestBuilds: Promise<string>[] = [];
  for (const task of tasks) {
    console.log(`starting tests for ${task}`);
    runningTestBuilds.push(...await runTaskPipelines(task));
  }

  Promise.all(runningTestBuilds).then(results => {
    console.log(results);
  }).catch(error => {
    console.error(error);
  });
}

// Running test pipelines for task by build configs
async function runTaskPipelines(taskName: string): Promise<Promise<string>[]> {
  const pipelines = await fetchPipelines();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  if (pipeline) {
    const configs = getBuildConfigs(taskName);
    console.log(`Detected buildconfigs ${JSON.stringify(configs)}`);

    const runningBuilds: Promise<string>[] = [];
    for (const config of configs) {
      console.log(`Running tests for ${taskName} with config ${config} for pipeline ${pipeline.name}`)
      const pipelineBuild = await startTestPipeline(pipeline, config);

      const buildPromise = new Promise<string>((resolve, reject) => completeBuild(taskName, pipelineBuild, resolve, reject))
      runningBuilds.push(buildPromise);
    }

    return runningBuilds;
  }

  console.log(`Cannot build and run tests for task ${taskName} - corresponding test pipeline was not found`);

  return [];
}

async function fetchPipelines(): Promise<PipelineBuild[]> {
  try {
    const res = await axios
      .get(`${ApiUrl}/pipelines?${API_VERSION}`, auth);

    return res.data.value;
  } catch (err: any) {
    err.stack = `Error fetching pipelines: ${err.stack}`;
    console.error(err.stack);
    if (err.response?.data) {
      console.error(err.response.data);
    }

    throw err;
  }
}

async function startTestPipeline(pipeline: PipelineBuild, config = ''): Promise<PipelineBuild> {
  console.log(`Run ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`);

  const { BUILD_SOURCEVERSION: branch, CANARY_TEST_NODE_VERSION: nodeVersion } = process.env;
  if (!branch || !nodeVersion) {
    throw new Error('Cannot run test pipeline. Environment variables BUILD_SOURCEVERSION or CANARY_TEST_NODE_VERSION are not defined');
  }

  try {
    const res = await axios
      .post(
        `${ApiUrl}/pipelines/${pipeline.id}/runs?${API_VERSION}`,
        {
          variables: {
            ...pipelineVariable('CANARY_TEST_TASKNAME', pipeline.name),
            ...pipelineVariable('CANARY_TEST_BRANCH', branch),
            ...pipelineVariable('CANARY_TEST_CONFIG', config),
            ...pipelineVariable('CANARY_TEST_NODE_VERSION', nodeVersion)
          },
        },
        auth
      );

    return res.data;
  } catch (err: any) {
    err.stack = `Error running ${pipeline.name} pipeline. Stack: ${err.stack}`;
    console.error(err.stack);
    if (err.response?.data) {
      console.error(err.response.data);
    }

    throw err;
  }
}

async function completeBuild(
  pipelineName: string,
  pipelineBuild: PipelineBuild,
  resolve: (value: string) => void,
  reject: (reason?: any) => void
): Promise<void> {
  const maxRetries = 10;
  const buildTimeoutInSeconds = 300 * 60;
  const intervalInSeconds = 20;

  const stringifiedBuild = `build (id: [" ${pipelineBuild.id} "], url: [" ${pipelineBuild._links.web.href} "], pipeline: [" ${pipelineName} "])`;
  console.log(`Verifying state of the ${stringifiedBuild}`);

  let retryCount = 0;
  let intervalAmount = 0;

  const interval = setInterval(
    async () => {
      console.log(`Fetching status of the "${pipelineBuild.id}" pipeline build.`)
      const buildStatus = await fetchBuildStatus(pipelineBuild);
      console.log(`State of the ${stringifiedBuild}: "${buildStatus.state}"`);

      if (buildStatus.state !== 'completed') {
        if (++intervalAmount * intervalInSeconds >= buildTimeoutInSeconds) {
          clearInterval(interval);

          reject(new Error(`Timeout to complete the ${stringifiedBuild} exceeded`));
        }

        return;
      }

      if (buildStatus.result === 'succeeded') {
        clearInterval(interval);

        const result = `The ${stringifiedBuild} completed with result "${buildStatus.result}"`;
        resolve(result);
      } else if (retryCount < maxRetries) {
        // Retry failed jobs in pipeline build
        await retryFailedJobsInBuild(pipelineBuild);
      }
      else {
        clearInterval(interval);

        const result = `The ${stringifiedBuild} completed with result "${buildStatus.result}"`;
        reject(new Error(result));
      }
    },
    intervalInSeconds * 1000
  );
}

async function fetchBuildStatus(pipelineBuild: PipelineBuild): Promise<PipelineBuild> {
  const intervalInSeconds = 20;
  const maxRetries = 10;

  let retryCount = 0;

  const getBuildPromise = new Promise<PipelineBuild>((resolve, reject) => {
    const interval = setInterval(
      async () => {
        try {
          const res = await axios.get(pipelineBuild.url, auth);

          clearInterval(interval);
          resolve(res.data);
        }
        catch (err: any) {
          if (['ETIMEDOUT', 'ECONNRESET'].includes(err.code) || err.response?.status >= 500) {
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Error verifying state of the [${pipelineBuild.name} ${pipelineBuild.id}] build, retry request. Retry count: ${retryCount}. Error message: ${err.message}`);

              return;
            } else {
              console.error(`Error verifying state of the [${pipelineBuild.name} ${pipelineBuild.id}], maximum retries reached. Cancel retries. Error message: ${err.message}`);
            }
          }

          clearInterval(interval);

          err.stack = `Error verifying build status. Stack: ${err.stack}`;
          console.error(err.stack);
          if (err.response?.data) {
            console.error(`Error response data: ${err.response.data}`);
          }

          reject(err);
        }
      },
      intervalInSeconds * 1000
    );
  });

  return getBuildPromise;
}

async function retryFailedJobsInBuild(pipelineBuild: PipelineBuild): Promise<void> {
  try {
    await axios.patch(`${ApiUrl}/build/builds/${pipelineBuild.id}?retry=true&${API_VERSION}`, auth)
  }
  catch (err: any) {
    err.stack = `Error retrying failed jobs in build: ${err.stack}`;
    console.error(err.stack);
    if (err.response?.data) {
      console.error(err.response.data);
    }

    throw err;
  }
}

process.on('uncaughtException', err => {
  console.error(`Uncaught exception: ${err.message}`);
  console.debug(err.stack);
});

main();
