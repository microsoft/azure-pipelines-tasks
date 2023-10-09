const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const args = minimist(process.argv.slice(2));

const exclude = args.exclude?.split(',').map(task => task.trim()) || [];

const tasksPath = path.join(__dirname, '..', '..', 'Tasks');

const items = fs.readdirSync(tasksPath);

const tasks = [];

for (const item of items) {
    if (fs.existsSync(path.join(tasksPath, item, 'task.json'))) {
        tasks.push(item);
    }
}

console.log(tasks.filter(task => !exclude.includes(task)).join(','));
