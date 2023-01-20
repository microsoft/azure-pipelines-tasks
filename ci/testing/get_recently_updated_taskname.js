const { spawn } = require('node:child_process');
const git = spawn('git', ['diff', '--name-only', 'master'], {cwd: '..', shell: true});

console.log('process.argv')

console.log(process.argv)

let gitDiffOutput = "";

git.stdout.setEncoding('utf8');
git.stdout.on('data', (data) => {
  gitDiffOutput += data.toString();
});


git.stderr.on('data', (data) => {
  console.error(`git stderr: ${data}`);
});

git.on('close', (code) => {
  if (code != 0) {
    console.log(`git child process exited with code ${code}`);
  }

  getTaskNamesFromOutput(gitDiffOutput);
});


function getTaskNamesFromOutput(output) {
  const taskNames = new Set();
  const lines = output.split(/\r?\n/).filter(s => s);
  const taskLines = lines.filter(line => line.startsWith('Tasks/'));
  taskLines.forEach(pathToFile => {
    let taskName = pathToFile.slice(6); // remove Tasks/ prefix
    taskName = taskName.slice(0, taskName.indexOf('/')); // remove path after task name
    taskNames.add(taskName);
  })

  console.log('----------------------------------------------------------------');
  console.log('Tasks with changes:', ...taskNames);
  console.log([...taskNames]);
}
