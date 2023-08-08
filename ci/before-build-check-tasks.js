const util = require('./ci-util');
const fs = require('fs');
const path = require('path');

const argv = require('minimist')(process.argv.slice(2));
const { genTaskPath, tasksSourcePath, makeOptionPath, logToPipeline } = require('./ci-util');

/**
 * Function validating that all passed tasks are presented in tasks folder
 * @param {Array<Tasks>} taskList
 * @returns {Array<Tasks>} - array of messages which are not presented in tasks folder
 */
function validateTaskSources( taskList ) {
  const errorList = [];

  for (const task of taskList) {
    const taskPath = path.join(tasksSourcePath, task);
    if (!fs.existsSync(taskPath)) {
      errorList.push(`Sources for ${task} task not found in ${tasksSourcePath} but the task found in ${makeOptionPath}`);
      continue;
    }
  }

  return errorList;
}

/** 
 * Function validating that for all generated task has versionmap file
 * @param {Object} makeOptionJson - make-options.json as object
 * @returns {Array<String>} - array of messages with tasks which don't have versionmap file 
 */
function validateGeneratedTasksExists( makeOptionJson ) {
  const excludedKeys = ['tasks', 'taskResources'];
  const errorList = [];

  for (const key in makeOptionJson) {
    if (excludedKeys.includes(key)) continue;
    if (!Array.isArray(makeOptionJson[key])) continue;
    
    const taskList = makeOptionJson[key];
    for (const task of taskList) {
      const versionMapFile = `${task}.versionmap.txt`;
      if (fs.existsSync(path.join(genTaskPath, versionMapFile))) continue;
      errorList.push(`Task ${task} doesn't have versionmap file but found in ${key} section in make-options.json`);
    }
  }
  return errorList;
}

/** 
 * Function validating that all tasks presented in make-options.json are valid
 */
function validateMakeOption() {
  if (!fs.existsSync(makeOptionPath)) {
    throw new Error(`make-options.json doesn't exist in ${makeOptionPath}`);
  }

  const makeOptions = JSON.parse(fs.readFileSync(makeOptionPath, { encoding: 'utf-8' }));
  const messages = [
    ...validateGeneratedTasksExists(makeOptions),
    ...validateTaskSources(makeOptions.tasks)
  ];

  if (messages.length > 0) {
    console.warn(`\nProblems with ${messages.length} task(s) should be resolved:\n`);
    
    messages.forEach((message) => {
      logToPipeline("error", message);
    });

    process.exit(1);
  }
}

validateMakeOption();
