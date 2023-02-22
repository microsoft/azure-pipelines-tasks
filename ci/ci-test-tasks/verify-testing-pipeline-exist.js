const axios = require('axios');

const AUTH_TOKEN = process.argv[2];
const apiUrl = process.argv[3];
const task = process.argv[4];
const apiVersion = 'api-version=7.0';

const auth = {
  username: 'Basic',
  password: AUTH_TOKEN
};

if (task) {
  return start(task);
} else {
  throw new Error('Task name was not provided');
}

async function start(taskName) {
  const pipelines = await fetchPipelines();
  const pipeline = pipelines.find(pipeline => pipeline.name === taskName);

  if (!pipeline) {
    throw new Error(`Testing pipeline ${taskName} is missing`);
  }
}

function fetchPipelines() {
  return axios.get(`${apiUrl}?${apiVersion}`, { auth })
  .then(res => res.data.value)
  .catch(err => {
    console.error('Error fetching pipelines', err);
    throw err;
  });
}
