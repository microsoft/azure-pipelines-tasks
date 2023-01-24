
const fs = require('fs');



const files = process.argv.slice(2);
const taskIds = getTaskIds(files);


function getTaskIds(files) {
  const taskJsonFiles = files.filter(line => line.startsWith('Tasks/') && line.split('/').length === 3 && line.endsWith('/task.json'));

  taskJsonFiles.forEach(taskJsonFile => {
    // const rawdata = fs.readFileSync('student.json');
    // const student = JSON.parse(rawdata);

  })
  console.log(taskJsonFiles);
}

function fillTaskIds(taskNames) {
  return taskNames.map(taskName => ({name: taskName, id: 'id_placeholder'}))
}