var fs = require('fs');
var path = require('path');

const tasks = []  // get list of tasks

console.log(fs.readFileSync(path.resolve(__dirname, '..', '..', 'make-options.json'), 'utf8'))



tasks.forEach(task => {
    const pathToTask = path.resolve(__dirname, '..', '..', '..', 'Tasks', task)
    const packageJSON = JSON.parse(fs.readFileSync(path.resolve(pathToTask, 'package.json')));
    const dependencies = Object.keys(packageJSON.dependencies)//.includes('')
    dependencies.forEach(dep => {
        if (dep.match('common')) {
            const commonPackageJSON = JSON.parse(fs.readFileSync(path.resolve(pathToTask, 'node_modules', dep, 'package.json')));
            if (packageJSON.dependencies['azure-pipelines-task-lib'] === commonPackageJSON.dependencies['azure-pipelines-task-lib']) throw new Error('task-lib versions are different')
        }
    })
})