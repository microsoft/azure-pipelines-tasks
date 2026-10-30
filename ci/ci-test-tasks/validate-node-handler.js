const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const taskExecutors = ['execution', 'prejobexecution', 'postjobexecution'];

function getTaskDefinitions(taskName, root = repoRoot) {
  const definitions = [];
  const sourceTaskJson = path.join(root, 'Tasks', taskName, 'task.json');

  if (fs.existsSync(sourceTaskJson)) {
    definitions.push({
      name: taskName,
      path: sourceTaskJson,
      task: JSON.parse(fs.readFileSync(sourceTaskJson, 'utf8'))
    });
  }

  const generatedTasksPath = path.join(root, '_generated');
  if (!fs.existsSync(generatedTasksPath)) {
    return definitions;
  }

  for (const generatedTaskName of fs.readdirSync(generatedTasksPath)) {
    if (!generatedTaskName.startsWith(`${taskName}_`)) {
      continue;
    }

    const generatedTaskJson = path.join(generatedTasksPath, generatedTaskName, 'task.json');
    if (!fs.existsSync(generatedTaskJson)) {
      continue;
    }

    definitions.push({
      name: generatedTaskName,
      path: generatedTaskJson,
      task: JSON.parse(fs.readFileSync(generatedTaskJson, 'utf8'))
    });
  }

  return definitions;
}

function getNodeBackedExecutors(task) {
  return taskExecutors.filter(executor => {
    const handlers = task[executor];
    return handlers && Object.keys(handlers).some(handler => handler.startsWith('Node'));
  });
}

function supportsNodeHandler(task, requiredHandler) {
  const nodeBackedExecutors = getNodeBackedExecutors(task);
  return nodeBackedExecutors.length > 0
    && nodeBackedExecutors.every(executor => Object.prototype.hasOwnProperty.call(task[executor], requiredHandler));
}

function validateTasks(requiredHandler, taskNames, root = repoRoot) {
  const makeOptionsPath = path.join(root, 'make-options.json');
  const makeOptions = JSON.parse(fs.readFileSync(makeOptionsPath, 'utf8'));
  const inBoxTasks = new Set(makeOptions.tasks);
  const errors = [];

  for (const taskName of taskNames) {
    if (!inBoxTasks.has(taskName)) {
      console.log(`Skipping ${taskName}: the task is not listed in make-options.json.`);
      continue;
    }

    const definitions = getTaskDefinitions(taskName, root);
    const sourceDefinition = definitions.find(definition => definition.name === taskName);
    if (!sourceDefinition) {
      errors.push(`${taskName}: task.json was not found.`);
      continue;
    }

    if (sourceDefinition.task.deprecated === true) {
      console.log(`Skipping ${taskName}: the task is deprecated.`);
      continue;
    }

    if (getNodeBackedExecutors(sourceDefinition.task).length === 0) {
      console.log(`Skipping ${taskName}: the task does not use a Node handler.`);
      continue;
    }

    const supportingDefinition = definitions.find(definition => supportsNodeHandler(definition.task, requiredHandler));
    if (supportingDefinition) {
      console.log(`${taskName}: ${requiredHandler} is available in ${path.relative(root, supportingDefinition.path)}.`);
      continue;
    }

    const inspectedDefinitions = definitions.map(definition => path.relative(root, definition.path)).join(', ');
    errors.push(`${taskName}: ${requiredHandler} is missing from all Node-backed execution sections in ${inspectedDefinitions}.`);
  }

  return errors;
}

function run() {
  const requiredHandler = process.argv[2];
  const taskNames = (process.argv[3] || '').split(',').map(task => task.trim()).filter(Boolean);

  if (!requiredHandler) {
    console.log('No required Node handler was provided.');
    return;
  }

  if (taskNames.length === 0) {
    console.log('No changed tasks require Node handler validation.');
    return;
  }

  const errors = validateTasks(requiredHandler, taskNames);
  if (errors.length === 0) {
    console.log(`All applicable changed tasks support ${requiredHandler}.`);
    return;
  }

  for (const error of errors) {
    console.error(`##vso[task.logissue type=error]${error}`);
  }

  process.exit(1);
}

if (require.main === module) {
  run();
}

module.exports = {
  getNodeBackedExecutors,
  getTaskDefinitions,
  supportsNodeHandler,
  validateTasks
};
