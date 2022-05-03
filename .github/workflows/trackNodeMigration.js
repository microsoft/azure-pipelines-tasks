import fs from 'fs';
import fetchAllPages from './fetchAllPages.js';
import callGitHub from './callGitHub.js';

const token = process.argv[2];
if (!token) {
  throw new Error('Provide a PAT as a CLI argument!');
}

// https://github.com/microsoft/azure-pipelines-tasks/labels/node-migration
const issues = await fetchAllPages(token, 'repos/microsoft/azure-pipelines-tasks/issues', { labels: 'node-migration', state: 'all' });
console.log('Found', issues.length, 'existing Node migration issues');

let errors = 0;
for (const entry of await fs.promises.readdir('../../Tasks', { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'Common') {
    continue;
  }

  const manifest = JSON.parse(await fs.promises.readFile('../../Tasks/' + entry.name + '/task.json'));

  // TODO: Handle also `prejobexecution` and `postjobexecution`, some tasks have
  // it as well as `execution` and `DownloadSecureFileV1`, `InstallSSHKeyV0` and
  // `InstallAppleCertificateV2` lack `execution` altogether.
  if (!manifest.execution) {
    // TODO: Let this fail again once the above TODO is resolved
    //console.log(entry.name);
    //console.log(manifest);
    //errors++;
    continue;
  }

  const keys = Object.keys(manifest.execution).filter(key => key.startsWith('Node'));
  if (keys.length === 0) {
    continue;
  }

  if (keys.length !== 1) {
    throw new Error(`${entry.name} has multiple Node execution definitions`);
  }

  const [key] = keys;
  if (key === 'Node10') {
    console.log(entry.name, 'already uses Node 10');

    // TODO: Check `prejobexecution` and `postjobexecution` as well in the future
    continue;
  }

  if (key !== 'Node') {
    throw new Error('Unexpected Node version encountered in ' + entry.name + ': ' + key);
  }

  const [issue, ...conflicts] = issues.filter(issue => issue.title.startsWith(`[${entry.name}]`));
  if (conflicts.length > 0) {
    throw new Error(`Multiple Node migration issues refer to ${entry.name}: ${conflicts.map(issue => issue.number).join(', ')} and ${issue.number}`);
  }

  if (issue) {
    console.log(entry.name, 'Node 6 to Node 10 migration already tracked in the', issue.state, 'issue', issue.html_url);
    continue;
  }

  console.log(entry.name, 'uses Node 6 and has no tracking issue, creating…');
  const title = `[${entry.name}] Migrate "execution" from Node 6 to Node 10`;
  const body = 'The issue uses the Node 6 runtime and should be migrated to Node 10. Once done on the master branch, this issue will self-close.';
  const labels = ['node-migration'];
  const assignee = 'tomashubelbauer';
  const data = await callGitHub(token, 'repos/microsoft/azure-pipelines-tasks/issues', { method: 'POST', body: { title, body, labels, assignee } });
  if (!data.html_url) {
    console.log(data);
    throw new Error(`Failed to create a tracking issue for ${entry.name}, rerun the workflow if it was an API fluke.`);
  }
  console.log(entry.name, 'uses Node 6 and has no tracking issue, created:', data.html_url);
}

if (errors.length > 0) {
  console.log(errors.length, 'errors encountered');
}

process.exit(errors);
