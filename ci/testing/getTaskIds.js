const files = process.argvs.lice(2);

console.log(files);

const taskNames = getTaskNamesFromOutput(filenames)
const taskNamesAndIds = fillTaskIds(taskNames);


function getTaskNamesFromOutput(files) {
  const taskNames = new Set();
  const lines = files.filter(line => line.startsWith('Tasks/'));
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