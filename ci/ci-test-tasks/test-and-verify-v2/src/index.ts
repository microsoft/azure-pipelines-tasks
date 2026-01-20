import { BuildDefinitionReference, Build } from 'azure-devops-node-api/interfaces/BuildInterfaces';

import { api } from './api';
import { fetchBuildStatus, retryFailedJobsInBuild } from './helpers.Build';
import { fetchPipelines } from './helpers.Pipeline';
import { getBuildConfigs, getNodeVersionForTask, getNodeVersionsFromTaskJson } from './helpers';

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
        
        const  runResult = await runTaskPipelines(task, pipeline);
        
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
        if (!api.isNodeCompatible) {
          const nodeVersion = getNodeVersionForTask(taskName, config);
          console.log(`Running tests for "${taskName}" task with config "${config}" on Node ${nodeVersion} for pipeline "${pipeline.name}"`);
          const pipelineBuild = await startTestPipeline(pipeline, taskName, config);

          if (pipelineBuild === null) {
            console.log(`Pipeline "${pipeline.name}" is not valid.`);
            return INVALID;
          }

          runningBuilds.push(completeBuild(taskName, pipelineBuild, config, nodeVersion));
        } else {
          const getNodeVersionsFromTaskJsons = getNodeVersionsFromTaskJson(taskName, config);
          for (const nodeVersion of getNodeVersionsFromTaskJsons) {
            console.log(`Running tests for "${taskName}" task with config "${config}" on Node ${nodeVersion} for pipeline "${pipeline.name}"`);
            const pipelineBuild = await startTestPipeline(pipeline, taskName, config, nodeVersion);

            if (pipelineBuild === null) {
              console.log(`Pipeline "${pipeline.name}" is not valid.`);
              return INVALID;
            }

            runningBuilds.push(completeBuild(taskName, pipelineBuild, config, nodeVersion));
          }
        }
      }
    } else {
      const firstConfig = configs.shift();
      const nodeVersion = getNodeVersionForTask(taskName, firstConfig);
      const pipelineBuild = await startTestPipeline(pipeline, taskName, firstConfig);

      if (pipelineBuild === null) {
        console.log(`Pipeline "${pipeline.name}" is not valid.`);
        return INVALID;
      }

      runningBuilds.push(new Promise<BuildResult[]>(async resolve => {
        const buildResults = new Array<BuildResult>();
        console.log(`Running tests for "${taskName}" task with config "${firstConfig}" on Node ${nodeVersion} for pipeline "${pipeline.name}"`);
        let result = await completeBuild(taskName, pipelineBuild, firstConfig, nodeVersion);
        buildResults.push(result);

        for (const config of configs) {
          const nodeVersion = getNodeVersionForTask(taskName, config);
          console.log(`Running tests for "${taskName}" task with config "${config}" on Node ${nodeVersion} for pipeline "${pipeline.name}"`);
          const pipelineBuild = await startTestPipeline(pipeline, taskName, config);
          if (pipelineBuild !== null) {
            result = await completeBuild(taskName, pipelineBuild, config, nodeVersion);
            buildResults.push(result);
          }
        }
        resolve(buildResults);
      }));
    }

    return runningBuilds;
}

async function startTestPipeline(pipeline: BuildDefinitionReference, taskName: string, config = '', _nodeVersion?: number | null): Promise<Build | null> {
  const { BUILD_SOURCEVERSION: branch, CANARY_TEST_NODE_VERSION: envNodeVersion } = process.env;
  
  if (!branch) {
    throw new Error('BUILD_SOURCEVERSION environment variable is required');
  }

  // Get task-specific Node version, fallback to environment variable
  const taskNodeVersion = api.isNodeCompatible ? _nodeVersion : getNodeVersionForTask(taskName, config);
  const nodeVersion = taskNodeVersion?.toString() || envNodeVersion;

  console.log(`startTestPipeline() - Using Node version: ${nodeVersion} for task: ${taskName}`);

  if (!nodeVersion) {
    throw new Error(`Cannot determine Node version for task ${taskName}`);
  }

  const buildParameters: Record<string, string> = {
    CANARY_TEST_TASKNAME: taskName || pipeline.name!,
    CANARY_TEST_BRANCH: branch,
    CANARY_TEST_CONFIG: config.replace(/@Node\d+$/, ''),
    CANARY_TEST_NODE_VERSION: nodeVersion
  };

  // Set agent knobs based on Node version
  const nodeVersionNum = parseInt(nodeVersion, 10);
  if (nodeVersionNum === 20) {
    buildParameters['AGENT_USE_NODE20_1'] = 'true';
    buildParameters['AGENT_USE_NODE24_WITH_HANDLER_DATA'] = 'false';
    console.log(`Agent knob AGENT_USE_NODE20_1 set to: true`);
    console.log(`Agent knob AGENT_USE_NODE24_WITH_HANDLER_DATA set to: false`);
  } else if (nodeVersionNum === 24) {
    buildParameters['DistributedTask.Agent.UseNode20_1'] = 'false';
    buildParameters['DistributedTask.Agent.UseNode24WithHandlerData'] = 'true';
  }

  // Enable debug mode by default
  if (process.env.CANARY_TEST_DEBUG_MODE !== 'false') {
    buildParameters['system.debug'] = 'true';
  }

  try {
    const build = await api.queueBuild(pipeline.id!, buildParameters);
    
    if (build && build.id) {
      // Add tags for better pipeline identification
      const tags: string[] = [
        `Node${nodeVersionNum}`,
        config ? `Config:${config.replace(/@Node\d+$/, '')}` : 'BaseTask'
      ];
      
      try {
        await api.addBuildTags(build.id, tags);
      } catch (tagErr) {
        console.warn(`Failed to add tags to build ${build.id}: ${tagErr}`);
      }
    }
    
    return build;
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
  buildConfig?: string,
  nodeVersion?: number | null,
): Promise<BuildResult> {
  const maxRetries = 3;
  const buildTimeoutInSeconds = 300 * 60;
  const intervalInSeconds = 20;

  const nodeInfo = nodeVersion ? ` on Node ${nodeVersion}` : '';
  const configInfo = buildConfig ? ` with config "${buildConfig}"` : '';
  const stringifiedBuild = `build (id: [ ${pipelineBuild.id} ], url: [ ${pipelineBuild._links.web.href} ], pipeline: [ ${pipelineName}${configInfo}${nodeInfo} ])`;

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