import { BuildDefinitionReference, Build } from 'azure-devops-node-api/interfaces/BuildInterfaces';

import { api } from './api';
import { fetchBuildStatus, retryFailedJobsInBuild } from './helpers.Build';
import { fetchPipelines } from './helpers.Pipeline';
import { getBuildConfigs } from './helpers';

interface BuildResult { result: string; message: string }

const DISABLED = 'disabled';

const buildResultCode = {
  0: 'None',
  2: 'Succeeded',
  4: 'PartiallySucceeded',
  8: 'Failed',
  32: 'Canceled'
};

const buildResultEnum = {
  None: 'None',
  Succeeded: 'Succeeded',
  PartiallySucceeded: 'PartiallySucceeded',
  Failed: 'Failed',
  Canceled: 'Canceled'
};

async function main() {
  const disabledPipelines: string[] = [];
  const runningTestBuilds: Promise<BuildResult>[] = [];
  for (const task of api.tasks) {
    console.log(`starting tests for ${task} task`);
    const runResult = await runTaskPipelines(task);

    if (runResult === DISABLED) {
      disabledPipelines.push(task);
    } else {
      runningTestBuilds.push(...runResult);
    }
  }

  let failed: boolean = false;

  Promise.all(runningTestBuilds).then(buildResults => {
    console.log('\nResults:');

    buildResults.map(buildResult => {
      if (buildResult.result === buildResultEnum.PartiallySucceeded) {
        buildResult.message = `##vso[task.issue type=warning]${buildResult.message}`;
      } else if (buildResult.result !== buildResultEnum.Succeeded) {
        buildResult.message = `##vso[task.issue type=error]${buildResult.message}`;
        failed = true;
      }

      console.log(buildResult.message);
    });
  }).catch(error => {
    console.error(error);
  }).finally(() => {
    if (disabledPipelines.length > 0) {
      console.log('\nDisabled pipelines:');

      disabledPipelines.map(disabledPipeline => console.log(
        `##vso[task.issue type=warning]${disabledPipeline} is disabled`
      ));
    }

    console.log('\n');
    if (failed) console.log('##vso[task.complete result=Failed]');
  });
}

// Running test pipelines for task by build configs
async function runTaskPipelines(taskName: string): Promise<Promise<BuildResult>[] | typeof DISABLED> {
  const pipelines = await fetchPipelines()();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  if (pipeline) {
    if (pipeline.queueStatus === 2) { // disabled
      console.log(`Pipeline "${pipeline.name}" is disabled.`);
      return DISABLED;
    }

    const configs = getBuildConfigs(taskName);
    console.log(`Detected buildconfigs ${JSON.stringify(configs)}`);

    const runningBuilds: Promise<BuildResult>[] = [];
    for (const config of configs) {
      console.log(`Running tests for "${taskName}" task with config "${config}" for pipeline "${pipeline.name}"`);
      const pipelineBuild = await startTestPipeline(pipeline, config);
      console.log(pipelineBuild)
      const buildPromise = new Promise<BuildResult>(resolve => completeBuild(taskName, pipelineBuild, resolve));
      runningBuilds.push(buildPromise);
    }

    return runningBuilds;
  }

  console.log(`Cannot build and run tests for task ${taskName} - corresponding test pipeline was not found`);

  return [];
}

async function startTestPipeline(pipeline: BuildDefinitionReference, config = ''): Promise<Build> {
  console.log(`Run ${pipeline.name} pipeline, pipelineId: ${pipeline.id}`);

  const { BUILD_SOURCEVERSION: branch, CANARY_TEST_NODE_VERSION: nodeVersion } = process.env;
  if (!branch || !nodeVersion) {
    throw new Error('Cannot run test pipeline. Environment variables BUILD_SOURCEVERSION or CANARY_TEST_NODE_VERSION are not defined');
  }

  try {
    return await api.queueBuild(pipeline.id!, {
      CANARY_TEST_TASKNAME: pipeline.name,
      CANARY_TEST_BRANCH: branch,
      CANARY_TEST_CONFIG: config,
      CANARY_TEST_NODE_VERSION: nodeVersion
    });
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
  pipelineBuild: Build,
  resolve: (value: BuildResult) => void
): Promise<void> {
  const maxRetries = 3;
  const buildTimeoutInSeconds = 300 * 60;
  const intervalInSeconds = 20;

  const stringifiedBuild = `build (id: [ ${pipelineBuild.id} ], url: [ ${pipelineBuild._links.web.href} ], pipeline: [ ${pipelineName} ])`;

  let retryCount = 0;
  let intervalAmount = 0;

  const interval = setInterval(
    async () => {
      const buildStatus = await fetchBuildStatus(pipelineBuild);
      console.log(`State of the ${stringifiedBuild}: "${buildStatus.status}"`);

      if (buildStatus.status !== 2) { // completed
        if (++intervalAmount * intervalInSeconds >= buildTimeoutInSeconds) {
          clearInterval(interval);

          resolve({ result: 'Timeout', message: `Timeout to complete the ${stringifiedBuild} exceeded` });
        }

        return;
      }

      const result = buildResultCode[buildStatus.result!];

      if (
        result !== buildResultEnum.Succeeded &&
        result !== buildResultEnum.PartiallySucceeded &&
        retryCount < maxRetries
      ) {
        console.log(`Retrying failed jobs in ${stringifiedBuild}. Retry count: ${++retryCount} out of ${maxRetries}`);
        await retryFailedJobsInBuild(pipelineBuild);
      } else {
        clearInterval(interval);

        resolve({ result, message: `The ${stringifiedBuild} completed with result "${result}"` });
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
