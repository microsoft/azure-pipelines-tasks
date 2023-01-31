// const axios = require('axios');
// const url = 'https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7';

// const ADOToken = process.argv[2];
// const tasks = process.argv[3];

console.log(process.argv);

// console.log(axios.isCancel('something'));



// curl --user "":"$(ADOToken)" -H "Content-Type: application/json" -H "Accept:application/json" "https://dev.azure.com/canary2-poc/tasks-canary/_apis/pipelines/5/runs?api-version=7" -X POST -d "{\"templateParameters\": { \"tasks\": \"$TASKS\"}}"