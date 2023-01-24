
const fs = require('fs');

const files = process.argv.slice(2);
const tasks = getTaskIds(files.slice(0,2));

console.log(tasks);

function getTaskIds(files) {
  const taskJsonFiles = files.filter(line => line.startsWith('Tasks/') && line.split('/').length === 3 && line.endsWith('/task.json'));
  console.log(taskJsonFiles);

  return taskJsonFiles.map(path => {
    const rawdata = fs.readFileSync(path);
    const taskJsonFile = JSON.parse(rawdata);
    console.log(taskJsonFile);

    return {name: taskJsonFile.name, id: taskJsonFile.id, path}
  })
}
