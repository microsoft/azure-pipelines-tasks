const axios = require('axios');
const hostname = 'https://dev.azure.com';
const organization = 'canary2-poc';
const project = 'tasks-canary';
const apiVersion = '7';
const url = 'https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7';

const AUTH_TOKEN = process.argv[2];
const tasks = process.argv[3];
// axios.defaults.headers.common['Authorization'] = `Basic ${AUTH_TOKEN}`;
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

if (tasks) {
  start(tasks);
} else {
  console.log('Skip test verification');
}

async function start(tasks) {
  const taskNames = tasks.split(',');

  const pipelines = await getPipelines();
  console.log(pipelines);

  // taskNames.forEach(taskName => {
  //   return triggerTestPipeline(taskName).then(res => {
  //     console.log(res);

  //     return observeTestPipeline(taskName, res);
  //   })
  //   .catch(function (error) {
  //     // handle error
  //     console.log(error);
  //   })
  //   .finally(function () {
  //     // always executed
  //   });;
  // })
}

function getPipelines() {
  return axios.get(`https://dev.azure.com/${organization}/${project}/_apis/pipelines?api-version=7.0`, {}, {
    auth: {
      username: '',
      password: AUTH_TOKEN
    }
  });
}

function triggerTestPipeline(taskName) {
  console.log(`Trigger test pipeline for ${taskName} task`);

  return axios.post(url, {
    templateParameters: {}
  },{ 
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })
}

function observeTestPipeline(taskName, pipeline) {
  console.log(`Observe test pipeline for ${taskName} task`);
}




// curl --user "":"$(ADOToken)" -H "Content-Type: application/json" -H "Accept:application/json" "https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7" -X POST -d "{\"templateParameters\": { \"tasks\": \"$TASKS\"}}"