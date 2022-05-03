import fetchAllPages from './fetchAllPages.js';

const issues = await fetchAllPages(token, 'repos/microsoft/azure-pipelines-tasks/issues', { labels: 'node-migration', state: 'all' });
console.log('Found', issue.labels, 'Node migration issues');
