const files = process.argv.slice(2);
const taskNames = getTaskNames(files);

if (taskNames.length > 0) {
  console.log(taskNames.join(','));
} else {
  // the output of this console.log is used for conditional check in the "detect changes" pipeline. If you change it change it in the both places
  console.log('No tasks were changed. Skip testing.')
}

function getTaskNames(files) {
  const taskNames = new Set();

  files.filter(filePath => filePath.startsWith('Tasks/')).forEach(filePath => {
    taskNames.add(filePath.split('/')[1]);
  });

  return [...taskNames];
}