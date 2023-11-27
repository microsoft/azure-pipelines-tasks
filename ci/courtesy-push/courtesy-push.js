const fs = require('fs');
const path = require('path');

const azureSourceFolder = process.argv[2];
const newDeps = process.argv[3];
const unifiedDepsPath = path.join(azureSourceFolder, '.nuget', 'externals', 'UnifiedDependencies.xml');
const tfsServerPath = path.join(azureSourceFolder, 'Tfs', 'Service', 'Deploy', 'components', 'TfsServer.Servicing.core.xml');
const msPrefix = 'Mseng.MS.TF.DistributedTask.Tasks.';

function formDirectoryString(nugetTaskName) {
    const taskName = nugetTaskName.replace(msPrefix, '');

    return `  <Directory Path="[ServicingDir]Tasks\\Individual\\${taskName}\\">
    <File Origin="nuget://Mseng.MS.TF.DistributedTask.Tasks.${taskName}/content/*" />
  </Directory>`;
}

/**
* The function to form a dictionary of dependencies
* @param {Array} depArr - array of dependencies
* @returns {Object} - dictionary of dependencies
*/
function getDeps(depArr) {
    const deps = {};

    depArr.forEach(newDep => {
        // add to dictionary
        const depDetails = newDep.split('"');
        console.log(JSON.stringify(depDetails));
        const name = depDetails[1];
        const version = depDetails[3];
        console.log(name + ' ' + version);

        if (name.includes('_')) {
            const basicName = name.split('_')[0];
            if (!deps[basicName]) deps[basicName] = {};
            if (!deps[basicName].configs) deps[basicName].configs = [];

            deps[basicName].configs.push({ name, version, depStr: newDep });
        } else {
            if (!deps[name]) deps[name] = {};

            deps[name].name = name;
            deps[name].version = version;
            deps[name].depStr = newDep;
        }
    });

    return deps;
}

/**
 * The function removes all generated configs such as Node16/Node20 from the list of dependencies
 * @param {Array} depsArray - array of parsed dependencies from UnifiedDependencies.xml
 * @param {Object} depsForUpdate - dictionary of dependencies from getDeps method
 * @param {Object} updatedDeps - structure to track added/removed dependencies
 * @returns {Array} - updated array of dependencies and updatedDeps object { added: [], removed: []
 */
function removeConfigsForTasks(depsArray, depsForUpdate, updatedDeps) {
    const newDepsArr = depsArray.slice();
    const updatedDepsObj = Object.assign({}, updatedDeps);
    const basicDepsForUpdate = new Set(Object.keys(depsForUpdate));
    let index = 0;

    while (index < newDepsArr.length) {
        const currentDep = newDepsArr[index];
        const depDetails = currentDep.split('"');
        const name = depDetails[1];
        if (!name || !name.includes('_')) {
            index++;
            continue;
        }

        const basicName = name.split('_')[0];

        if (!basicDepsForUpdate.has(basicName)) {
            index++;
            continue;
        }

        newDepsArr.splice(index, 1);
        updatedDepsObj.removed.push(name);
    }

    return [newDepsArr, updatedDepsObj];
}

/**
 * The function updates task dependencies with configs such as Node16/Node20
 * @param {Array} depsArray - array of parsed dependencies from UnifiedDependencies.xml
 * @param {Object} depsForUpdate - dictionary of dependencies from getDeps method
 * @param {Object} updatedDeps - structure to track added/removed dependencies
 * @returns {Array} - updated array of dependencies and updatedDeps object { added: [], removed: []
 */
function updateConfigsForTasks(depsArray, depsForUpdate, updatedDeps) {
    const newDepsArr = depsArray.slice();
    const updatedDepsObj = Object.assign({}, updatedDeps);
    const basicDepsForUpdate = new Set(Object.keys(depsForUpdate));
    let index = 0;

    while (index < newDepsArr.length) {
        const currentDep = newDepsArr[index];
        const depDetails = currentDep.split('"');
        const name = depDetails[1];

        if (!name || !basicDepsForUpdate.has(name)) {
            index++;
            continue;
        }

        newDepsArr.splice(index, 1, depsForUpdate[name].depStr);
        index++;

        if (depsForUpdate[name].configs) {
            depsForUpdate[name].configs.
                sort((a, b) => a.name > b.name)
                .forEach(config => {
                    updatedDepsObj.added.push(config.name);
                    newDepsArr.splice(index, 0, config.depStr);
                    index++;
                });
        }
    }

    return [newDepsArr, updatedDepsObj];
}

/**
 * The main function for unified dependencies update
 * The function parses unified dependencies file and updates it with new dependencies/remove unused
 * Since the generated tasks can only be used and build with default version, if unified_deps.xml doesn't contain
 * the default version, the specific config (e.g. Node16) will be removed from the list of dependencies
* @param {String} pathToUnifiedDeps - path to UnifiedDependencies.xml
* @param {String} pathToNewUnifiedDeps - path to unified_deps.xml which contains dependencies updated on current week  
*/
function updateUnifiedDeps(pathToUnifiedDeps, pathToNewUnifiedDeps) {
    const currentDeps = fs.readFileSync(pathToUnifiedDeps, 'utf8');
    const newDeps = fs.readFileSync(pathToNewUnifiedDeps, 'utf8');

    const newDepsArr = newDeps.split('\n');
    const depsForUpdate = getDeps(newDepsArr);

    let depsArray = currentDeps.split('\n');
    let updatedDeps = { added: [], removed: [] };

    [depsArray, updatedDeps] = removeConfigsForTasks(depsArray, depsForUpdate, updatedDeps);
    [depsArray, updatedDeps] = updateConfigsForTasks(depsArray, depsForUpdate, updatedDeps);


    fs.writeFileSync(pathToUnifiedDeps, depsArray.join('\n'));
    console.log('Updating Unified Dependencies file done.');
    return updatedDeps;
}

/**
 * The function update TfsServer.Servicing.core.xml with new dependencies
 * The function check the depsToUpdate which was created during updateUnifiedDeps 
 * and add/remove dependencies from TfsServer.Servicing.core.xml
 * @param {String} pathToTfsCore - path to TfsServer.Servicing.core.xml
 * @param {Object} depsToUpdate - structure to track added/removed dependencies (formed in updateUnifiedDeps)
*/
function updateTfsServerDeps(pathToTfsCore, depsToUpdate) {
    const directoryTagOpen = new RegExp('<Directory (.*)>');
    const directoryTagClose = new RegExp('</Directory>');

    const tfsCore = fs.readFileSync(pathToTfsCore, 'utf8');
    const tfsToUpdate = tfsCore.split('\n');
    const depsToAdd = depsToUpdate.added;
    const depsToRemove = depsToUpdate.removed.filter(dep => depsToAdd.indexOf(dep) === -1);

    depsToRemove.forEach(dependencyName => {
        const refLine = dependencyName.replace(msPrefix, '');
        const refIndexStart = tfsToUpdate.findIndex(tfsString => tfsString.match(directoryTagOpen) && tfsString.includes(`${refLine}\\"`));
        if (refIndexStart === -1) return;

        console.log(`Looking directory range for ${dependencyName} from line ${refIndexStart}`);
        let refIndexEnd = refIndexStart;
        while (!tfsToUpdate[refIndexEnd].match(directoryTagClose) && refIndexEnd < tfsToUpdate.length) {
            refIndexEnd++;
        }

        tfsToUpdate.splice(refIndexStart, refIndexEnd - refIndexStart + 1);
        console.log(`Removing ${dependencyName} from line ${refIndexStart} to ${refIndexEnd}`);
    });


    const insertedIndex = tfsToUpdate.findIndex(tfsString => directoryTagOpen.test(tfsString));
    depsToAdd.forEach(dependencyName => {
        const refLine = dependencyName.replace(msPrefix, '');
        const refIndex = tfsToUpdate.findIndex(tfsString => tfsString.match(directoryTagOpen) && tfsString.includes(`${refLine}\\"`));
        if (refIndex === -1) {
            const insertedString = formDirectoryString(dependencyName);
            tfsToUpdate.splice(insertedIndex, 0, insertedString);
            console.log(`Inserting ${dependencyName} at line ${insertedIndex}`)
            console.log(`${insertedString}`);
        }
    });

    fs.writeFileSync(pathToTfsCore, tfsToUpdate.join('\n'));
    console.log('Inserting into Tfs Servicing Core file done.');
}

const changedTasks = updateUnifiedDeps(unifiedDepsPath, newDeps);
updateTfsServerDeps(tfsServerPath, changedTasks);
