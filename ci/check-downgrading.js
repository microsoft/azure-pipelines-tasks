const { join, posix, sep } = require('path');
const {
  readFileSync,
  existsSync
} = require('fs');
const { mkdir, rm } = require('shelljs');
const { platform } = require('os');
const { run, resolveTaskList } = require('./ci-util');
const { eq, inc, parse, lte } = require('semver');

const packageEndpoint = process.env['PACKAGE_VERSIONS_ENDPOINT'];

if (!packageEndpoint) {
  console.log('##vso[task.logissue type=error]Failed to get info from package endpoint because no endpoint was specified. Try setting the PACKAGE_VERSIONS_ENDPOINT environment variable.');
  process.exit(1);
}

const packageToken = process.env['PACKAGE_TOKEN'];
const { RestClient } = require('typed-rest-client/RestClient');
const { PersonalAccessTokenCredentialHandler } = require('typed-rest-client/Handlers');
const client = new RestClient('azure-pipelines-tasks-ci', '', [new PersonalAccessTokenCredentialHandler(packageToken)]);

const argv = require('minimist')(process.argv.slice(2));

if (!argv.task) {
  console.log(`$(task_pattern) variable is empty or not set. Aborting...`);
  process.exit(0);
};

// We need to escape # on Unix platforms since that turns the rest of the string into a comment
const escapeHash = str => platform() == 'win32' ? str : str.replace(/#/gi, '\\#');

const sourceBranch = escapeHash(process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH']);
const targetBranch = escapeHash(process.env['SYSTEM_PULLREQUEST_TARGETBRANCH']);

const baseProjectPath = join(__dirname, '..');

const tempMasterTasksPath = join(baseProjectPath, 'temp', 'tasks-versions', targetBranch);

if (!existsSync(tempMasterTasksPath)) {
  mkdir('-p', tempMasterTasksPath);
}

if (existsSync(join(tempMasterTasksPath, 'Tasks'))) {
  rm('-rf', join(tempMasterTasksPath, 'Tasks'));
}

function compareLocalWithMaster(localTasks, masterTasks) {
  const taskVersionsMismatch = [];

  for (const localTask of localTasks) {
    const masterTask = masterTasks.find(x => x.name.toLowerCase() === localTask.name.toLowerCase());

    if (masterTask === undefined) {
      continue;
    }

    if (masterTask.version.minor > argv.sprint) {
      taskVersionsMismatch.push(` - [${targetBranch}] ${masterTask.name} has v${masterTask.version.version} it's higher than the current sprint ${argv.sprint}`);
      continue;
    }

    let destinationVersion = parse(localTask.version.version);

    if (localTask.version.minor < argv.sprint) {
      destinationVersion.minor = argv.sprint;
    } else if (localTask.version.minor === argv.sprint) {
      if (eq(localTask.version, masterTask.version)) {
        inc(destinationVersion, 'patch');
      }
    } else {
      taskVersionsMismatch.push(` - [${sourceBranch}] ${localTask.name} has v${localTask.version.version} it's higher than the current sprint ${argv.sprint}`);
      continue;
    }

    if (localTask.version.version !== destinationVersion.version) {
      taskVersionsMismatch.push(` - ${localTask.name} have to be upgraded from v${localTask.version.version} to v${destinationVersion}`);
    }
  }

  return taskVersionsMismatch;
}

function getTasksVersions(tasks, basepath) {
  return tasks.map(x => {
    const taskJSONPath = join(basepath, 'Tasks' , x, 'task.json');

    if (!existsSync(taskJSONPath)) {
      console.log(`##vso[task.logissue type=error]Task.json of ${x} does not exist by path ${taskJSONPath}`);
      process.exit(1);
    }

    const taskJSONObject = JSON.parse(readFileSync(taskJSONPath, 'utf-8'));

    return {
      id: taskJSONObject.id,
      name: x,
      version: parse([
        taskJSONObject.version.Major,
        taskJSONObject.version.Minor,
        taskJSONObject.version.Patch
      ].join('.'))
    }
  });
}

async function clientWrapper(url) {
  try {
    return await client.get(url);
  } catch (error) {
    console.log(`##vso[task.logissue type=error]Cannot access to ${url} due to error ${error}`);
    process.exit(1);
  }
}

async function getFeedTasksVersions() {
  const { result, statusCode } = clientWrapper(packageEndpoint);

  if (statusCode !== 200) {
    console.log('##vso[task.logissue type=error]Failed while fetching feed versions');
    return;
  }

  return result.value
    .map(x => ({
      name: x.name.slice('Mseng.MS.TF.DistributedTask.Tasks.'.length),
      versions: x.versions.map(y => ({
        version: parse(y.version),
        isLatest: y.isLatest
      }))
    }));
}

function compareLocalWithFeed(localTasks, feedTasks) {
  const taskVersionsMismatch = [];

  for (const localTask of localTasks) {
    const feedTask = feedTasks.find(x => x.name.toLowerCase() === localTask.name.toLowerCase());

    if (feedTask === undefined) {
      continue;
    }

    for (const feedTaskVersion of feedTask.versions) {
      if (feedTaskVersion.version.minor > argv.sprint) {
        taskVersionsMismatch.push(` - [Feed] ${feedTask.name} has v${feedTaskVersion.version.version} it's higher than the current sprint ${argv.sprint}`);
        continue;
      }

      if (lte(localTask.version, feedTaskVersion.version) && feedTaskVersion.isLatest) {
        taskVersionsMismatch.push(` - [Feed] ${localTask.name} local version ${localTask.version.version} less or equal than version in feed ${feedTaskVersion.version.version}`);
      }
    }
  }

  return taskVersionsMismatch;
}

function getChangedTaskJsonFromMaster(names) {
  names.forEach(x => {
    mkdir('-p', join(tempMasterTasksPath, 'Tasks', x));
    run(`git show origin/master:Tasks/${x}/task.json > ${tempMasterTasksPath.split(sep).join(posix.sep)}/Tasks/${x}/task.json`);
  });
}

async function main() {
  const changedTasksNames = resolveTaskList(argv.task);
  const localTasks = getTasksVersions(changedTasksNames, join(__dirname, '..'));
  getChangedTaskJsonFromMaster(changedTasksNames);
  const masterTasks = getTasksVersions(changedTasksNames, tempMasterTasksPath);
  const feedTasks = await getFeedTasksVersions();

  const versionErrors = [
    ...compareLocalWithMaster(localTasks, masterTasks),
    ...compareLocalWithFeed(localTasks, feedTasks)
  ];

  if (versionErrors.length > 0) {
    console.log('##vso[task.logissue type=error]Failed while checking downgrading');
    console.log(`\nProblems with ${versionErrors.length} task(s) should be resolved:\n`);

    for (const versionError of versionErrors) {
      console.log(versionError);
    }

    console.log('\nor you might have an outdated branch, try to merge/rebase your branch from master');
    process.exit(1);
  }
}

main();