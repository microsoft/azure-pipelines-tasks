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
  //
  // '_generated/_buildConfigs/**' is deliberately excluded. It holds generated
  // build-config metadata (lock files and the like) rather than task sources, and
  // a routine refresh of it touches a hundred tasks at once. It is also where the
  // fan-out bug lived: '_buildConfigs'.split(/_|\./)[0] is the EMPTY STRING, and
  // an empty task name makes every downstream `startsWith(task)` match
  // EVERYTHING - which queued every pipeline in the canary project, twice, rather
  // than the handful of tasks the PR actually changed.
  files
    .filter(filePath => filePath.startsWith('_generated/') && !filePath.startsWith('_generated/_buildConfigs/'))
    .forEach(filePath => {
      const segment = filePath.split('/')[1];
      const taskName = segment ? segment.split(/_|\./)[0] : '';

      if (taskName && !tasks.has(taskName)) {
        tasks.add(taskName);
      }
    });

  // skip Common folder as this is not a task folder
  tasks.delete('Common');

  // A blank entry here is never a real task, and it is actively dangerous: it
  // makes the prefix match downstream select every pipeline in the project.
  tasks.delete('');
  return [...tasks];
}
