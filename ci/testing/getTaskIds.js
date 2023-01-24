
const fs = require('fs');

const files = process.argv.slice(2);
const tasks = getTaskIds(files);

exports = tasks;

function getTaskIds(files) {
  const taskJsonFiles = files.filter(line => line.startsWith('Tasks/') && line.split('/').length === 3 && line.endsWith('/task.json'));

  return taskJsonFiles.map(path => {
    const rawdata = fs.readFileSync(path);
    const taskJsonFile = JSON.parse(rawdata);

    return {name: taskJsonFile.name, id: taskJsonFile.id, folderName: path.split('/')[1]}
  })
}
