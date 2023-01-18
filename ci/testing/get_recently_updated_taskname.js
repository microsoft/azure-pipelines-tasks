const { spawn, exec } = require('node:child_process');
const git = spawn('git', ['diff', '--name-only', 'master'], {cwd: '../..', shell: true});


let gitDiffOutput = "";

git.stdout.setEncoding('utf8');
git.stdout.on('data', (data) => {
  gitDiffOutput += data.toString();
});


git.stderr.on('data', (data) => {
  console.error(`git stderr: ${data}`);
});

git.on('close', (code) => {
  console.log(`git child process exited with code ${code}`);
  console.log('Full output of script: ', gitDiffOutput);

  console.log('--------------------------------------------')
  console.log(gitDiffOutput);

  getTaskNamesFromOutput(gitDiffOutput);
});


function getTaskNamesFromOutput(output) {
  const taskNames = new Set();
  const lines = output.split(/\r?\n/).filter(s => s);
  const taskLines = lines.filter(line => line.startsWith('Tasks/'));
  taskLines.forEach(pathToFile => {
    let taskName = pathToFile.slice(6); // remove Tasks/ prefix
    taskName = taskName.slice(0, taskName.indexOf('/')); // remove path after task name
    console.log('taskName', taskName)
  })

  console.log(taskLines);
}
