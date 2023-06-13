const fs = require('fs');
const path = require('path');

const result = [];
const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, 'tasks.json')));

for (const task in tasks) {
    const versions = tasks[task];

    for (const version of versions) {
        result.push(`${task}V${version}`);
    }
}

console.log(result.join(','));
