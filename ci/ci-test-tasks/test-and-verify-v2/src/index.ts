
import axios from 'axios';

import { PipelineBuild } from './interfaces';
import { getBuildConfigs, pipelineVariable } from './helpers';
import { configInstance } from './config';
import { API_VERSION, DISABLED } from './constants';
import { fetchBuildStatus, retryFailedJobsInBuild } from './helpers.Build';
import { fetchPipelines } from './helpers.Pipeline';

async function main() {
  const tasks = configInstance.TaskArg.split(',');

  const disabledPipelines: string[] = [];
  const runningTestBuilds: Promise<string>[] = [];
  for (const task of tasks) {
    console.log(`starting tests for ${task} task`);
    const runResult = await runTaskPipelines(task);

    if (runResult == DISABLED) {
      disabledPipelines.push(task);
    } else {
      runningTestBuilds.push(...runResult);
    }
  }

  Promise.all(runningTestBuilds).then(results => {
    console.log(results);
  }).catch(error => {
    console.error(error);
  }).finally(() => {
    console.log(`\nDisabled pipelines:\n${disabledPipelines.join('\n')}\n`);
  });
}

// Running test pipelines for task by build configs
async function runTaskPipelines(taskName: string): Promise<Promise<string>[] | typeof DISABLED> {
  const pipelines = await fetchPipelines()();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  console.log('>>>>>>>>>>>>>>>>>>>>>>');
  console.log(JSON.stringify(pipeline));
  console.log('<<<<<<<<<<<<<<<<<<<<<<');

  if (pipeline) {
    const configs = getBuildConfigs(taskName);
    console.log(`Detected buildconfigs ${JSON.stringify(configs)}`);

    const runningBuilds: Promise<string>[] = [];
    for (const config of configs) {
      console.log(`Running tests for "${taskName}" task with config "${config}" for pipeline "${pipeline.name}"`);
      const startResult = await startTestPipeline(pipeline, config);

      if (startResult == DISABLED) {
        return DISABLED;
      } else {
        const buildPromise = new Promise<string>((resolve, reject) => completeBuild(taskName, startResult, resolve, reject));
        runningBuilds.push(buildPromise);
      }
    }

    return runningBuilds;
  }

  console.log(`Cannot build and run tests for task ${taskName} - corresponding test pipeline was not found`);

  return [];
}

async function startTestPipeline(pipeline: PipelineBuild, config = ''): Promise<PipelineBuild | typeof DISABLED> {
  console.log(`Run ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`);

  const { BUILD_SOURCEVERSION: branch, CANARY_TEST_NODE_VERSION: nodeVersion } = process.env;
  if (!branch || !nodeVersion) {
    throw new Error('Cannot run test pipeline. Environment variables BUILD_SOURCEVERSION or CANARY_TEST_NODE_VERSION are not defined');
  }

  try {
    const res = await axios
      .post(
        `${configInstance.ApiUrl}/pipelines/${pipeline.id}/runs?${API_VERSION}`,
        {
          variables: {
            ...pipelineVariable('CANARY_TEST_TASKNAME', pipeline.name),
            ...pipelineVariable('CANARY_TEST_BRANCH', branch),
            ...pipelineVariable('CANARY_TEST_CONFIG', config),
            ...pipelineVariable('CANARY_TEST_NODE_VERSION', nodeVersion)
          },
        },
        configInstance.AxiosAuth
      );

    return res.data;
  } catch (err: any) {
    const data = err.response?.data;

    if (data) {
      const message = `Build pipeline ${pipeline.name} is disabled for project ${configInstance.ProjectName}.`;

      if (data.message == message) {
        console.log(message);
        return DISABLED;
      }
    }

    console.error(`Error running ${pipeline.name} pipeline.`);
    console.log(err.stack);

    if (data) {
      console.log(data);
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

  const stringifiedBuild = `build (id: [ ${pipelineBuild.id} ], url: [ ${pipelineBuild._links.web.href} ], pipeline: [ ${pipelineName} ])`;

  let retryCount = 0;
  let intervalAmount = 0;

  const interval = setInterval(
    async () => {
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
        console.log(`Retrying failed jobs in ${stringifiedBuild}. Retry count: ${++retryCount} out of ${maxRetries}`);
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

process.on('uncaughtException', err => {
  console.error(`Uncaught exception: ${err.message}`);
  console.debug(err.stack);
});

main();
