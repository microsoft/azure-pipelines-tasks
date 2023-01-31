const axios = require('axios');
console.log(axios.isCancel('something'));

const url = 'https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7';

const ADOToken = process.argv[2];
const tasks = process.argv[3];

if (tasks) {
  const taskNames = tasks.split(',');

  taskNames.forEach(taskName => {
    const pipeline = triggerTestPipeline(taskName);
    return observeTestPipeline(taskName, pipeline);
  })
}


function triggerTestPipeline(taskName) {
  console.log(`Trigger test pipeline for ${taskName} task`);
}

function observeTestPipeline(taskName, pipeline) {
  console.log(`Observe test pipeline for ${taskName} task`);
}




// curl --user "":"$(ADOToken)" -H "Content-Type: application/json" -H "Accept:application/json" "https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7" -X POST -d "{\"templateParameters\": { \"tasks\": \"$TASKS\"}}"