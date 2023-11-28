const fs = require('fs');

var admzip = require('adm-zip');

var util = require('../make-util');
var run = util.run;
var rm = util.rm;

// Generate sprintly zip
// This methods generate a zip file that contains the tip of all task major versions for the last sprint
// Use:
//   node make.js gensprintlyzip --sprint=m153 --outputdir=E:\testing\ --depxmlpath=C:\Users\stfrance\Desktop\tempdeps.xml
//
// Result:
//   azure-pipelines.firstpartytasks.m153.zip
//
// The generated zip can be uploaded to an account using tfx cli and it will install all of the tasks contained in the zip.
// The zip should be uploaded to the azure-pipelines-tasks repository
//
// Process:
//
//  We create a workspace folder to do all of our work in. This is creaverifyAllAgentPluginTasksAreInSkipListed in the output directory. output-dir/workspace-GUID
//  Inside here, we first create a package file based on the packages we want to download.
//  Then nuget restore, then get zips, then create zip.
function gensprintlyzip(/** @type {{ sprint: string; outputdir: string; depxmlpath: string }} */ argv) {
    var sprint = argv.sprint;
    var outputDirectory = argv.outputdir;
    var dependenciesXmlFilePath = argv.depxmlpath;
    var taskFeedUrl = 'https://mseng.pkgs.visualstudio.com/_packaging/Codex-Deps/nuget/v3/index.json';

    console.log('# Creating sprintly zip.');

    console.log('\n# Loading tasks from dependencies file.');
    var dependencies = fs.readFileSync(dependenciesXmlFilePath, 'utf8');

    var dependenciesArr = dependencies.split('\n');
    console.log(`Found ${dependenciesArr.length} dependencies.`);

    var taskDependencies = [];
    var taskStringArr = [];

    dependenciesArr.forEach(function (currentDep) {
        if (currentDep.indexOf('Mseng.MS.TF.DistributedTask.Tasks.') === -1) {
            return;
        }

        taskStringArr.push(currentDep);

        var depDetails = currentDep.split("\"");
        var name = depDetails[1];
        var version = depDetails[3];

        taskDependencies.push({ 'name': name, 'version': version });
    });

    console.log(`Found ${taskDependencies.length} task dependencies.`);

    console.log('\n# Downloading task nuget packages.');

    var tempWorkspaceDirectory = `${outputDirectory}\\workspace-${Math.floor(Math.random() * 1000000000)}`;
    console.log(`Creating temporary workspace directory ${tempWorkspaceDirectory}`);

    fs.mkdirSync(tempWorkspaceDirectory);

    console.log('Writing packages.config file');

    var packagesConfigPath = `${tempWorkspaceDirectory}\\packages.config`;
    var packagesConfigContent = '<?xml version="1.0" encoding="utf-8"?>\n';
    packagesConfigContent += '<packages>\n';

    taskStringArr.forEach(function (taskString) {
        packagesConfigContent += taskString;
    });

    packagesConfigContent += '</packages>';

    fs.writeFileSync(packagesConfigPath, packagesConfigContent);
    console.log(`Completed writing packages.json file. ${packagesConfigPath}`);

    console.log('\n# Restoring NuGet packages.');
    run(`nuget restore ${tempWorkspaceDirectory} -source "${taskFeedUrl}" -packagesdirectory ${tempWorkspaceDirectory}\\packages`);
    console.log('Restoring NuGet packages complete.');

    console.log(`\n# Creating sprintly zip.`);

    var sprintlyZipContentsPath = `${tempWorkspaceDirectory}\\sprintly-zip`;
    fs.mkdirSync(sprintlyZipContentsPath);

    console.log('Sprintly zip folder created.');

    console.log('Copying task zip files to sprintly zip folder.');
    taskDependencies.forEach(function (taskDependency) {
        var nameAndVersion = `${taskDependency.name}.${taskDependency.version}`;
        var src = `${tempWorkspaceDirectory}\\packages\\${nameAndVersion}\\content\\task.zip`; // workspace-735475103\packages\Mseng.MS.TF.DistributedTask.Tasks.AndroidBuildV1.1.0.16\content\task.zip
        var dest = `${sprintlyZipContentsPath}\\${nameAndVersion}.zip`; // workspace-735475103\sprintly-zip\

        fs.copyFileSync(src, dest);
    });
    console.log('Copying task zip files to sprintly zip folder complete.');

    console.log('Creating sprintly zip file from folder.');

    var sprintlyZipPath = `${outputDirectory}azure-pipelines.firstpartytasks.${sprint}.zip`;

    var zip = new admzip();
    zip.addLocalFolder(sprintlyZipContentsPath);
    zip.writeZip(sprintlyZipPath);

    console.log('Creating sprintly zip file from folder complete.');
    console.log('\n# Cleaning up folders');
    console.log(`Deleting temporary workspace directory ${tempWorkspaceDirectory}`);
    rm('-Rf', tempWorkspaceDirectory);

    console.log('\n# Completed creating sprintly zip.');
}

module.exports = gensprintlyzip;