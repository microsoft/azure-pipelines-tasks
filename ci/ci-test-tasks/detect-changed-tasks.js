const files = process.argv.slice(2);
const taskNames = getTaskNames(files);

if (taskNames.length > 0) {
  console.log(taskNames.join(','));
} else {
  console.error('No tasks were changed. Skip testing.');
}

function getTaskNames(files) {
  const tasks = new Set();

  files.filter(filePath => filePath.startsWith('Tasks/')).forEach(filePath => tasks.add(filePath.split('/')[1]));

  // Include tasks changed in _generated
  // Test case:
  // var files  =["Tasks/Joe", "Tasks/Bob", , "_generated/Sue_Node20", "_generated/Ralf.versionmap"];
  // var tasks = new Set();
  // Result:
  // tasks == Set(4) { 'Joe', 'Bob', 'Sue', 'Ralf' }
  files.filter(filePath => filePath.startsWith('_generated/')).forEach(filePath => { 
    var taskName = filePath.split('/')[1].split(/_|\./)[0];
    if(!tasks.has(taskName))   
    {
      tasks.add(taskName);
    }
  });

  // skip Common folder as this is not a task folder
  tasks.delete('Common');
  return [...tasks];
}
