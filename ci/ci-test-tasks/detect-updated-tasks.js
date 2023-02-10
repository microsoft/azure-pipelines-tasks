const childProcess = require('child_process');
const allowedTasks = new Set(['DownloadPackageV1']); // TODO: remove after testing


try {
  const files = ((childProcess.execSync('git diff --name-only ms/master') || '').toString().trim()).split(/\r?\n/);
  const taskNames = getTaskNames(files);

  if (taskNames.length > 0) {
    console.log(taskNames.join(','));
  } else {
    throw new Error('No tasks were changed. Skip testing.')
  }
} catch (err) {
  console.error(err.message);  
};

function getTaskNames(files) {
  const taskNames = new Set();

  files.filter(filePath => filePath.startsWith('Tasks/')).forEach(filePath => {
    taskNames.add(filePath.split('/')[1]);
  });

  return [...taskNames].filter(taskName => allowedTasks.has(taskName)); //TODO: remove after testing
}
