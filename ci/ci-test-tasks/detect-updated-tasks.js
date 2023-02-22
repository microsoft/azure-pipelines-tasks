try {
  const files = process.argv.slice(2);
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
