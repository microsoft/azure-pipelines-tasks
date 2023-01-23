const gitDiffOutput = process.argv.slice(2);

const taskNames = getTaskNamesFromOutput(gitDiffOutput)
const taskNamesAndIds = fillTaskIds(taskNames);

console.log(taskNamesAndIds);

function getTaskNamesFromOutput(gitDiffOutput) {
  const taskNames = new Set();
  const lines = gitDiffOutput.filter(line => line.startsWith('Tasks/'));
  lines.forEach(pathToFile => {
    let taskName = pathToFile.slice(6); // remove Tasks/ prefix
    taskName = taskName.slice(0, taskName.indexOf('/')); // remove path after task name
    taskNames.add(taskName);
  })

  return [...taskNames];
}

function fillTaskIds(taskNames) {
  return taskNames.map(taskName => ({name: taskName, id: 'id_placeholder'}))
}