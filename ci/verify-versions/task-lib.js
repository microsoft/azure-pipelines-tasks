var fs = require('fs');
var path = require('path');

const tasks = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'make-options.json'), 'utf8')).tasks;

tasks.forEach(task => {
    
    const pathToTask = path.resolve(__dirname, '..', '..', '_build', 'Tasks', task)
    console.log(pathToTask);
    if(fs.existsSync(path.resolve(pathToTask, 'node_modules', 'azure-pipelines-task-lib'))) {
        const packageJSON = JSON.parse(fs.readFileSync(path.resolve(pathToTask, 'node_modules', 'azure-pipelines-task-lib', 'package.json')));
        const dependencies = Object.keys(packageJSON.dependencies)//.includes('')
        dependencies.forEach(dependency => {
            if (dependency.match('common')) {
                if (fs.existsSync(path.resolve(pathToTask, 'node_modules', dependency, 'node_modules'))) {
                    const commonPackageJSON = JSON.parse(fs.readFileSync(path.resolve(pathToTask, 'node_modules', dependency, 'node_modules', 'package.json')));
                    if (packageJSON.version !== commonPackageJSON.version)
                        throw new Error('task-lib versions are different')
                }
            }
        })
    }
})