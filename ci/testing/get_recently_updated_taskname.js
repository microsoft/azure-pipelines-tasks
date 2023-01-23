const reason = process.argv[2];
const targetBranch = process.argv[3];
const gitDiffOutput = process.argv.slice(4);

if (reason !== 'PullRequest') {
  console.log(`Skip since reason is not "PullRequest". Current reason is "${reason}"`)
} else if (targetBranch !== 'master') {
  console.log(`Skip since target branch is not "master". Current target branch is "${targetBranch}"`)
} else {
  console.log('process.argv');
  console.log(process.argv);
  getTaskNamesFromOutput(gitDiffOutput)
}


function getTaskNamesFromOutput(gitDiffOutput) {
  const taskNames = new Set();
  const lines = gitDiffOutput.filter(line => line.startsWith('Tasks/'));
  lines.forEach(pathToFile => {
    let taskName = pathToFile.slice(6); // remove Tasks/ prefix
    taskName = taskName.slice(0, taskName.indexOf('/')); // remove path after task name
    taskNames.add(taskName);
  })

  console.log([...taskNames]);
}
