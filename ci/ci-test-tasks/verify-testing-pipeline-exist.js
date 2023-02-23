const axios = require('axios');

const AUTH_TOKEN = process.argv[2];
const ADOUrl = process.argv[3];
const projectName = process.argv[4];
const task = process.argv[5];
const apiVersion = 'api-version=7.0';
const apiUrl = `${ADOUrl}/${projectName}/_apis/pipelines`;

const auth = {
  username: 'Basic',
  password: AUTH_TOKEN
};

if (task) {
  return start(task);
} else {
  console.error('Task name was not provided');
}

async function start(taskName) {
  const pipelines = await fetchPipelines();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  if (!pipeline) {
    console.error(`Testing pipeline ${taskName} is missing`);
  }
}

function fetchPipelines() {
  return axios.get(`${apiUrl}?${apiVersion}`, { auth })
  .then(res => res.data.value)
  .catch(err => {
    console.error('Error fetching pipelines', err);
  });
}
