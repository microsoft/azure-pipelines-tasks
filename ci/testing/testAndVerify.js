const axios = require('axios');
const url = 'https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7';

const AUTH_TOKEN = process.argv[2];
const tasks = process.argv[3];
axios.defaults.headers.common['Authorization'] = AUTH_TOKEN;
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

if (tasks) {
  const taskNames = tasks.split(',');

  taskNames.forEach(taskName => {
    const pipeline = triggerTestPipeline(taskName);
    return observeTestPipeline(taskName, pipeline);
  })
}


function triggerTestPipeline(taskName) {
  console.log(`Trigger test pipeline for ${taskName} task`);

  axios.post(url, {
    templateParameters: {}
  },{ 
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })
  .then(function (response) {
    // handle success
    console.log(response);
  })
  .catch(function (error) {
    // handle error
    console.log(error);
  })
  .finally(function () {
    // always executed
  });
}

function observeTestPipeline(taskName, pipeline) {
  console.log(`Observe test pipeline for ${taskName} task`);
}




// curl --user "":"$(ADOToken)" -H "Content-Type: application/json" -H "Accept:application/json" "https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7" -X POST -d "{\"templateParameters\": { \"tasks\": \"$TASKS\"}}"