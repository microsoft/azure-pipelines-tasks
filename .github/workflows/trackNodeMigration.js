import fs from 'fs';
import fetchAllPages from './fetchAllPages.js';

const token = process.argv[2];
if (!token) {
  throw new Error('Provide a PAT as a CLI argument!');
}

const issues = await fetchAllPages(token, 'repos/microsoft/azure-pipelines-tasks/issues', { labels: 'node-migration', state: 'all' });
console.log('Found', issues.length, 'Node migration issues');

for (const entry of await fs.promises.readdir('../../Tasks', { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  console.log('Parsing task', entry.name, 'manifest');
  const manifest = JSON.parse(await fs.promises.readFile('../../Tasks/' + entry.name + '/task.json'));
  console.log(entry.name, 'uses', Object.keys(manifest.execution));
}
