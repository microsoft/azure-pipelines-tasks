var fs = require('fs');
var path = require('path');

var tasksPath = path.join(__dirname, 'Tasks');

function getCommonDeps(argv) {
    var first = true;
    var totalReferencesToCommonPackages = 0;
    var commonCounts = {};
    argv.taskList.forEach(function (taskName) {
        var commonDependencies = [];
        var packageJsonPath = path.join(tasksPath, taskName, 'package.json');

        if (fs.existsSync(packageJsonPath)) {
            var packageJson = JSON.parse(fs.readFileSync(packageJsonPath));

            if (first)
            {
                Object.values(packageJson.dependencies).forEach(function (v) {
                    if (v.indexOf('Tasks/Common') !== -1)
                    {
                        var depName = v
                            .replace('file:../../_build/Tasks/Common/', '')
                            .replace('-0.1.0.tgz', '')
                            .replace('-1.0.0.tgz', '')
                            .replace('-1.0.1.tgz', '')
                            .replace('-1.0.2.tgz', '')
                            .replace('-1.1.0.tgz', '')
                            .replace('-2.0.0.tgz', '')

                        commonDependencies.push(depName);

                        totalReferencesToCommonPackages++;

                        if (commonCounts[depName]) {
                            commonCounts[depName]++;
                        } else {
                            commonCounts[depName] = 1;
                        }
                    }
                });
            }
        }

        if (commonDependencies.length > 0)
        {
            console.log('----- ' + taskName + ' (' + commonDependencies.length + ') -----');

            commonDependencies.forEach(function (dep) {
                console.log(dep);
            });
        }
    });

    console.log('');
    console.log('##### ##### ##### #####');
    console.log('totalReferencesToCommonPackages: ' + totalReferencesToCommonPackages);
    console.log('');

    Object.keys(commonCounts).forEach(function (k) {
        console.log(k + ': ' + commonCounts[k]);
    });
}

module.exports = getCommonDeps;