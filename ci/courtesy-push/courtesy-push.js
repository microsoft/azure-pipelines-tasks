const fs = require('fs');
const path = require('path');

const azureSourceFolder = process.argv[2];
const newDeps = process.argv[3];
const unifiedDepsPath = path.join(azureSourceFolder, '.nuget', 'externals', 'UnifiedDependencies.xml');
const tfsServerPath = path.join(azureSourceFolder, 'Tfs', 'Service', 'Deploy', 'components', 'TfsServer.Servicing.core.xml');
const msPrefix = "Mseng.MS.TF.DistributedTask.Tasks.";
const directoryTag = new RegExp('<Directory (.*)>');

function formDirectoryString(nugetTaskName) {
    const taskName = nugetTaskName.replace(msPrefix, '');
  
    return `  <Directory Path="[ServicingDir]Tasks\\Individual\\${taskName}\\">
    <File Origin="nuget://Mseng.MS.TF.DistributedTask.Tasks.${taskName}/content/*" />
  </Directory>`;
}

function formatDeps(depArr) {
    const newDepsDict = {};

    depArr.forEach(newDep => {
        // add to dictionary
        const depDetails = newDep.split('"');
        console.log(JSON.stringify(depDetails));
        const name = depDetails[1];
        const version = depDetails[3];
        console.log(name + ' ' + version);
        newDepsDict[name] = version;
    });

    return newDepsDict;
}

function updateUnifiedDeps(pathToUnifiedDeps, pathToNewUnifiedDeps, outputPath) {
    const currentDeps = fs.readFileSync(pathToUnifiedDeps, 'utf8');
    const newDeps = fs.readFileSync(pathToNewUnifiedDeps, 'utf8');

    const currentDepsArr = currentDeps.split('\n');
    const newDepsArr = newDeps.split('\n');
    const newDepsDict = formatDeps(newDepsArr);

    const updatedDeps = [];

    currentDepsArr.forEach(currentDep => {
        const depDetails = currentDep.split('"');
        const name = depDetails[1];

        // find if there is a match in new (ignoring case)
        if (name) {
            const newDepsKey = Object.keys(newDepsDict).find(key => key.toLowerCase() === name.toLowerCase());
            if (newDepsKey && newDepsDict[newDepsKey]) {
                // update the version
                depDetails[3] = newDepsDict[newDepsKey];
                updatedDeps.push(depDetails.join('"'));
                delete newDepsDict[newDepsKey];
            } else {
                updatedDeps.push(currentDep);
                console.log(`"${currentDep}"`);
            }
        } else {
            updatedDeps.push(currentDep);
        }
    });

    // add the new deps from the start
    // working only for generated deps

    if (Object.keys(newDepsDict).length > 0) {
        for (let packageName in newDepsDict) {
            // new deps should include old packages completely
            // Example:
            // Mseng.MS.TF.DistributedTask.Tasks.AndroidSigningV2-Node16(packageName) should include 
            // Mseng.MS.TF.DistributedTask.Tasks.AndroidSigningV2(basePackageName)
            const depToBeInserted = newDepsArr.find(dep => dep.includes(packageName));
            const pushingIndex = updatedDeps.findIndex(basePackage => {
                if (!basePackage) return false;

                const depDetails = basePackage.split('"');
                const name = depDetails[1];
                return packageName.includes(name)
            });

            if (pushingIndex !== -1) {
                // We need to insert new package after the old one
                updatedDeps.splice(pushingIndex + 1, 0, depToBeInserted);
            }
        }
    }
    // write it as a new file where currentDeps is
    fs.writeFileSync(outputPath, updatedDeps.join('\n'));
    console.log('Updating Unified Dependencies file done.');
};

// Working only for insert when deps not exists, because we are not updating this file
function updateTfsServerDeps(pathToTfsCore, pathToDeps, outputPath) {
    const depsToUpdate = fs.readFileSync(pathToDeps, 'utf8');
    const tfsCore = fs.readFileSync(pathToTfsCore, 'utf8');

    const depsToUpdateArr = depsToUpdate.split('\n');
    const tfsToUpdate = tfsCore.split('\n');
    const depsForCheck = formatDeps(depsToUpdateArr);

    const insertedIndex = tfsToUpdate.findIndex(tfsString => directoryTag.test(tfsString));
    for (let i in depsForCheck) {
        if (tfsCore.indexOf(i) === -1) {
            const insertedString = formDirectoryString(i);
            tfsToUpdate.splice(insertedIndex, 0, insertedString);
            console.log(`${insertedString}`);
        } 
    }

    fs.writeFileSync(outputPath, tfsToUpdate.join('\n'));
    console.log('Inserting into Tfs Servicing Core file done.');
}

updateUnifiedDeps(unifiedDepsPath, newDeps, unifiedDepsPath);
updateTfsServerDeps(tfsServerPath, newDeps, tfsServerPath);
