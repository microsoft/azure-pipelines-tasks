const childProcess = require('child_process');

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

  return [...taskNames];
}

