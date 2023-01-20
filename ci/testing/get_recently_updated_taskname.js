const { spawn } = require('node:child_process');
//const git = spawn('git', ['diff', '--name-only', 'master'], {cwd: '..', shell: true});

console.log('process.argv')
console.log(process.argv)

const reason = process.argv[2];
const sourceBranch = process.argv[3];
const targetBranch = process.argv[4];
const gitDiffOutput = process.argv.slice(4);

if (reason !== 'PullRequest') {
  console.log(`Cancel script that is not "PullRequest". Current reason: "${reason}"`)
} else {
  getTaskNamesFromOutput(gitDiffOutput)
}

// let gitDiffOutput = "";

// git.stdout.setEncoding('utf8');
// git.stdout.on('data', (data) => {
//   gitDiffOutput += data.toString();
// });


// git.stderr.on('data', (data) => {
//   console.error(`git stderr: ${data}`);
// });

// git.on('close', (code) => {
//   if (code != 0) {
//     console.log(`git child process exited with code ${code}`);
//   }

//   getTaskNamesFromOutput(gitDiffOutput);
// });


function getTaskNamesFromOutput(gitDiffOutput) {
  const taskNames = new Set();
  const lines = gitDiffOutput.filter(line => line.startsWith('Tasks/'));
  lines.forEach(pathToFile => {
    let taskName = pathToFile.slice(6); // remove Tasks/ prefix
    taskName = taskName.slice(0, taskName.indexOf('/')); // remove path after task name
    taskNames.add(taskName);
  })

  console.log('----------------------------------------------------------------');
  console.log('Tasks with changes:', ...taskNames);
  console.log([...taskNames]);
}
