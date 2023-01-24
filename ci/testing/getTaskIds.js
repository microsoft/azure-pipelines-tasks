
const fs = require('fs');

const files = process.argv.slice(2);
const taskIds = getTaskIds(files);

function getTaskIds(files) {
  const taskJsonFiles = files.filter(line => line.startsWith('Tasks/') && line.split('/').length === 3 && line.endsWith('/task.json'));

  const tasks = taskJsonFiles.forEach(path => {
    const rawdata = fs.readFileSync(path);
    const taskJsonFile = JSON.parse(rawdata);

    return {name: taskJsonFile.name, id: taskJsonFile.id, path}
  })

  console.log(tasks);
}
