import fs from 'fs';
import fetchAllPages from './fetchAllPages.js';

const token = process.argv[2];
if (!token) {
  throw new Error('Provide a PAT as a CLI argument!');
}

const issues = await fetchAllPages(token, 'repos/microsoft/azure-pipelines-tasks/issues', { labels: 'node-migration', state: 'all' });
console.log('Found', issues.length, 'Node migration issues');

let errors = 0;
for (const entry of await fs.promises.readdir('../../Tasks', { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'Common') {
    continue;
  }

  const manifest = JSON.parse(await fs.promises.readFile('../../Tasks/' + entry.name + '/task.json'));
  if (!manifest.execution) {
    console.log(entry.name);
    console.log(manifest);
    errors++;
    continue;
  }

  const keys = Object.keys(manifest.execution).filter(key => key.startsWith('Node'));
  if (keys.length === 0) {
    continue;
  }

  console.log(entry.name, 'uses', keys);
}

if (errors.length > 0) {
  console.log(errors.length, 'errors encountered');
}

process.exit(errors);
