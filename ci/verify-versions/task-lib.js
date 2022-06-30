var fs = require('fs');
var path = require('path');

const tasks = ['InstallSSHKeyV0']//JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'make-options.json'), 'utf8')).tasks;

tasks.forEach(task => {
    const pathToTask = path.resolve(__dirname, '..', '..', 'Tasks', task)
    const packageJSON = JSON.parse(fs.readFileSync(path.resolve(pathToTask, 'node_modules', 'azure-pipelines-task-lib', 'package.json')));
    const dependencies = Object.keys(packageJSON.dependencies)//.includes('')
    dependencies.forEach(dep => {
        if (dep.match('common')) {
            if (fs.existsSync(path.resolve(pathToTask, 'node_modules', dep, 'node_modules'))) {
                const commonPackageJSON = JSON.parse(fs.readFileSync(path.resolve(pathToTask, 'node_modules', dep, 'package.json')));
                if (packageJSON.dependencies.vesrion === commonPackageJSON.dependencies['azure-pipelines-task-lib'])
                    throw new Error('task-lib versions are different')
            }
        }
    })
})