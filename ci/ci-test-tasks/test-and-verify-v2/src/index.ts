import { BuildDefinitionReference, Build } from 'azure-devops-node-api/interfaces/BuildInterfaces';

import { api } from './api';
import { fetchBuildStatus, retryFailedJobsInBuild } from './helpers.Build';
import { fetchPipelines } from './helpers.Pipeline';
import { getBuildConfigs } from './helpers';

interface BuildResult { result: string; message: string }

const parralelRunVariable = "ALLOW_PARALLEL_RUN"

const DISABLED = 'disabled';
const INVALID = 'invalid';

const buildResultCode = {
  0: 'None',
  2: 'Succeeded',
  4: 'PartiallySucceeded',
  8: 'Failed',
  32: 'Canceled'
};

const buildStatuses = {
  0: 'None',
  1: 'InProgress',
  2: 'Completed',
  4: 'Cancelling',
  8: 'Postponed',
  32: 'NotStarted'
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
  const invalidPipelines: string[] = [];
  const runningTestBuilds: Promise<BuildResult | BuildResult[]>[] = [];
  
  // Fetch all pipelines once at the start for efficiency
  const pipelines = await fetchPipelines()();

  // Add null check and array validation
  if (!pipelines || !Array.isArray(pipelines)) {
    console.error('Failed to fetch pipelines or pipelines is not an array');
    console.log('##vso[task.complete result=Failed]');
    process.exit(1);
  }

  // Add length check
  if (pipelines.length === 0) {
    console.warn('No pipelines found in the project');
    console.log('##vso[task.issue type=warning]No pipelines found in the project');
    console.log('##vso[task.complete result=Succeeded]');
    process.exit(0);
  }

  console.log(`Found ${pipelines.length} total pipelines in the project`);

  for (const task of api.tasks) {
    console.log(`starting tests for ${task} task`);

    // Find all pipelines that start with the task name
    const matchingPipelines = pipelines.filter(pipeline => pipeline.name?.startsWith(task));
    
    if (matchingPipelines.length > 0) {
      console.log(`Found ${matchingPipelines.length} pipeline(s) for task "${task}": ${matchingPipelines.map(p => p.name).join(', ')}`);

      for (const pipeline of matchingPipelines) {
        console.log(`\n--- Starting pipeline execution: ${task} on ${pipeline.name} ---`);
        
        const runResult = await runTaskPipelines(task, pipeline);

        if (runResult === DISABLED) {
          disabledPipelines.push(`${task} (${pipeline.name})`);
        } else if (runResult === INVALID) {
          invalidPipelines.push(`${task} (${pipeline.name})`);
        } else {
          runningTestBuilds.push(...runResult);
        }
      }
    } else {
      console.log(`Cannot build and run tests for task ${task} - corresponding test pipeline was not found`);
    }
  }

  let failed: boolean = false;

  Promise.all(runningTestBuilds).then(buildResults => {
    console.log('\nResults:');
    const buildResultsFlat = buildResults.flat();

    buildResultsFlat.map(buildResult => {
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

    if (invalidPipelines.length > 0) {
      console.log('\nInvalid pipelines (can not be triggered due to an incorrect YML file structure and/or issues with pipeline resources such as service connections):');

      invalidPipelines.map(invalidPipeline => console.log(
        `##vso[task.issue type=error]${invalidPipeline} is not valid`
      ));

      failed = true;
    }

    console.log('\n');
    if (failed) {
      console.log('##vso[task.complete result=Failed]');
      process.exit(1);
    }
    process.exit(0);
  });
}

// Running test pipelines for task by build configs
async function runTaskPipelines(taskName: string, pipeline: BuildDefinitionReference): Promise<Promise<BuildResult | BuildResult[]>[] | typeof DISABLED | typeof INVALID> {
  let allowParrallelRun = true;

    if (pipeline.queueStatus === 2) { // disabled
      console.log(`Pipeline "${pipeline.name}" is disabled.`);
      return DISABLED;
    }

    if (pipeline.id) {
      const definition = await api.getDefinition(pipeline.id!);
      allowParrallelRun = definition?.variables?.[parralelRunVariable]?.value === 'false' ? false : true;
    }

    const configs = getBuildConfigs(taskName);
    console.log(`Detected buildconfigs ${JSON.stringify(configs)}`);

    const runningBuilds: Promise<BuildResult | BuildResult[]>[] = [];
    console.log(`Parallel run is ${allowParrallelRun ? 'enabled' : 'disabled'} for "${taskName}" task`);

    // TODO possibly refactor
    if (allowParrallelRun) {
      for (const config of configs) {
        console.log(`Running tests for "${taskName}" task with config "${config}" for pipeline "${pipeline.name}"`);
        const pipelineBuild = await startTestPipeline(pipeline, config);

        if (pipelineBuild === null) {
          console.log(`Pipeline "${pipeline.name}" is not valid.`);
          return INVALID;
        }

        runningBuilds.push(completeBuild(taskName, pipelineBuild));
      }
    } else {
      const firstConfig = configs.shift();
      const pipelineBuild = await startTestPipeline(pipeline, firstConfig);

      if (pipelineBuild === null) {
        console.log(`Pipeline "${pipeline.name}" is not valid.`);
        return INVALID;
      }

      runningBuilds.push(new Promise<BuildResult[]>(async resolve => {
        const buildResults = new Array<BuildResult>();
        console.log(`Running tests for "${taskName}" task with config "${firstConfig}" for pipeline "${pipeline.name}"`);
        let result = await completeBuild(taskName, pipelineBuild);
        buildResults.push(result);

        for (const config of configs) {
          console.log(`Running tests for "${taskName}" task with config "${config}" for pipeline "${pipeline.name}"`);
          const pipelineBuild = await startTestPipeline(pipeline, config);
          if (pipelineBuild !== null) {
            result = await completeBuild(taskName, pipelineBuild);
            buildResults.push(result);
          }
        }
        resolve(buildResults);
      }));
    }

    return runningBuilds;
}

async function startTestPipeline(pipeline: BuildDefinitionReference, config = ''): Promise<Build | null> {
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
    if (err.message === 'Could not queue the build because there were validation errors or warnings.') {
      return null;
    }

    err.stack = `Error running ${pipeline.name} pipeline. Stack: ${err.stack}`;
    console.error(err.stack);
    if (err.response?.data) {
      console.error(err.response.data);
    }

    throw err;
  }
}

function completeBuild(
  pipelineName: string,
  pipelineBuild: Build,
): Promise<BuildResult> {
  const maxRetries = 3;
  const buildTimeoutInSeconds = 300 * 60;
  const intervalInSeconds = 20;

  const stringifiedBuild = `build (id: [ ${pipelineBuild.id} ], url: [ ${pipelineBuild._links.web.href} ], pipeline: [ ${pipelineName} ])`;

  let retryCount = 0;
  let intervalAmount = 0;
  return new Promise<BuildResult>(resolve => {
    const interval = setInterval(
      async () => {
        const buildStatus = await fetchBuildStatus(pipelineBuild);
        const statusText = buildStatus.status ? buildStatuses[buildStatus.status] : 'Unknown';
        console.log(`State of the ${stringifiedBuild}: "${statusText}(${buildStatus.status})"`);

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
  });
}

process.on('uncaughtException', err => {
  console.error(`Uncaught exception: ${err.message}`);
  console.debug(err.stack);
});

main();
