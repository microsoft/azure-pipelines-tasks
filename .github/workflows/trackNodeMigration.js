import fetchAllPages from './fetchAllPages.js';

const token = process.argv[2];
if (!token) {
  throw new Error('Provide a PAT as a CLI argument!');
}

const issues = await fetchAllPages(token, 'repos/microsoft/azure-pipelines-tasks/issues', { labels: 'node-migration', state: 'all' });
console.log('Found', issues.length, 'Node migration issues');
