const fs = require('fs');
const path = require('path');

const tasks = JSON.parse(fs.readFileSync('./make-options.json', 'utf8')).tasks;

for (let i = 0; i < tasks.length; i++) {
    const taskPath = path.join(__dirname, 'Tasks', tasks[i], 'task.json');
    const taskPathLoc = path.join(__dirname, 'Tasks', tasks[i], 'task.loc.json');

    const taskFile = fs.readFileSync(taskPath);
    const taskJSON = JSON.parse(taskFile);

    taskJSON.version.Minor = 218;
    taskJSON.version.Patch = 0;

    const tasksLocFile = fs.readFileSync(taskPathLoc);
    const tasksLocJSON = JSON.parse(tasksLocFile);

    tasksLocJSON.version.Minor = 218;
    tasksLocJSON.version.Patch = 0;
    fs.writeFileSync(taskPath, JSON.stringify(taskJSON, null, getSpaces(taskFile.toString().split("\n")[2])));
    fs.writeFileSync(taskPathLoc, JSON.stringify(tasksLocJSON, null, getSpaces(tasksLocFile.toString().split("\n")[2]))); 
}

function getSpaces(string) {
    let cnt = 0;
    for (let i = 0; i < string.length; i++) {
        if (string[i] === ' ') {
            cnt++;
        } else {
            return cnt;
        }
    }
            
    return cnt;
}