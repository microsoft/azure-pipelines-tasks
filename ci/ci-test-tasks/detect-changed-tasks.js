const files = process.argv.slice(2);
const taskNames = getTaskNames(files);

if (taskNames.length > 0) {
  console.log(taskNames.join(','));
} else {
  console.error('No tasks were changed. Skip testing.')
}

function getTaskNames(files) {
  const tasks = new Set();

  files.filter(filePath => filePath.startsWith('Tasks/')).forEach(filePath => {
    tasks.add(filePath.split('/')[1]);
  });

  // skip Common folder as this is not a task folder
  tasks.delete('Common');
  return [...tasks];
}
