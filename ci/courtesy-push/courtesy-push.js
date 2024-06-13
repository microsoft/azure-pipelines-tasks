const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const azureSourceFolder = process.argv[2];
const newDeps = process.argv[3];
const unifiedDepsPath = path.join(azureSourceFolder, '.nuget', 'externals', 'UnifiedDependencies.xml');
const tfsServerPath = path.join(azureSourceFolder, 'Tfs', 'Service', 'Deploy', 'components', 'TfsServer.hosted.xml');
const msPrefix = 'Mseng.MS.TF.DistributedTask.Tasks.';

/**
 * Helper function to check if the value is included in the array but not equal to the value in the array
 * E.g.  We compared generated task names such as Mseng.MS.TF.DistributedTask.Tasks.AppCenterDistributeV1_Node20
 * with basic Mseng.MS.TF.DistributedTask.Tasks.AppCenterDistributeV1
 * If the name is included in the list of dependencies but not equal to the name in the list, we assume its a config
 */
const isIncludeButNotEqual = (arr, value) => arr.reduce((acc, item) => acc || (value.includes(item) && value !== item), false);

function formDirectoryTag(nugetTaskName) {
    const taskName = nugetTaskName.replace(msPrefix, '');
    return {
        $: {
            Path: `[ServicingDir]Tasks\\Individual\\${taskName}\\`
        },
        File: [
            {
                $: {
                    Origin: `nuget://Mseng.MS.TF.DistributedTask.Tasks.${taskName}/content/*`
                }
            }
        ]
    };
}

/**
 * The function extracts dependency details from xml string
 * @param {string} xmlDependencyString - xml string with dependency information
 * @returns {Promise<[string, string]>} - name and version of dependency as an array
 */
async function extractDependency(xmlDependencyString) {
    try {
        var details = await xml2js.parseStringPromise(xmlDependencyString);
        return [ details.package.$.id, details.package.$.version ];
    } catch {
        return [ null, null ];
    }
}

/**
 * @typedef {Object} Dependencies
 * @property {string} name
 * @property {string} version
 * @property {string} depStr
 */

/**
 * The function to form a dictionary of dependencies
 * @param {Array} depArr - array of dependencies
 * @returns {Promise<Dependencies>} - dictionary of dependencies
 */
async function getDeps(depArr) {
    /** @type {Record<string, Dependencies>} deps */
    const deps = {};
    const getDependantConfigs = (arrKeys, packageName) => arrKeys.filter(key => key.includes(packageName) && key !== packageName);

    // first run we form structures 
    for (let i = 0; i < depArr.length; i++) {
        const newDep = depArr[i];
        var [ name, version ] = await extractDependency(newDep);

        if (!deps.hasOwnProperty(name)) deps[name] = {};

        const dep = deps[name];

        dep.name = name;
        dep.version = version;
        dep.depStr = newDep;
    }


    const keys = Object.keys(deps);

    for (let dep in deps) {
        const configs = getDependantConfigs(keys, dep);

        if (!configs.length) continue;

        
        deps[dep].configs = [];
        configs.forEach(config => {
            const configDep = deps[config];
            deps[dep].configs.push({
                name: configDep.name,
                version: configDep.version,
                depStr: configDep.depStr
            });

            delete deps[config];
        });
    }
    
    return deps;
}

/**
 * The function removes all generated configs such as Node16/Node20 from the list of dependencies
 * @param {Array} depsArray - array of parsed dependencies from UnifiedDependencies.xml
 * @param {Object} depsForUpdate - dictionary of dependencies from getDeps method
 * @param {Object} updatedDeps - structure to track added/removed dependencies
 * @returns {Promise<Array>} - updated array of dependencies and updatedDeps object { added: [], removed: []
 */
async function removeConfigsForTasks(depsArray, depsForUpdate, updatedDeps) {
    const newDepsArr = depsArray.slice();
    const updatedDepsObj = Object.assign({}, updatedDeps);
    const basicDepsForUpdate = Object.keys(depsForUpdate).map(dep => dep.toLowerCase());
    let index = 0;

    while (index < newDepsArr.length) {
        const currentDep = newDepsArr[index];
        const [ name ] = await extractDependency(currentDep);

        if (!name) {
            index++;
            continue;
        }

        const basicName = name.toLowerCase();

        if (isIncludeButNotEqual(basicDepsForUpdate, basicName)) {
            newDepsArr.splice(index, 1);
            updatedDepsObj.removed.push(name);
            continue;
        }

        index++;
    }

    return [newDepsArr, updatedDepsObj];
}

/**
 * The function updates task dependencies with configs such as Node16/Node20
 * @param {Array} depsArray - array of parsed dependencies from UnifiedDependencies.xml
 * @param {Object} depsForUpdate - dictionary of dependencies from getDeps method
 * @param {Object} updatedDeps - structure to track added/removed dependencies
 * @returns {Promise<Array>} - updated array of dependencies and updatedDeps object { added: [], removed: []
 */
async function updateConfigsForTasks(depsArray, depsForUpdate, updatedDeps) {
    const newDepsArr = depsArray.slice();
    const updatedDepsObj = Object.assign({}, updatedDeps);
    const basicDepsForUpdate = new Set(Object.keys(depsForUpdate));
    let index = 0;

    while (index < newDepsArr.length) {
        const currentDep = newDepsArr[index];
        const [ name ] = await extractDependency(currentDep);

        if (!name || !basicDepsForUpdate.has(name)) {
            index++;
            continue;
        }

        newDepsArr.splice(index, 1, depsForUpdate[name].depStr);
        index++;

        if (depsForUpdate[name].configs) {
            depsForUpdate[name].configs
                .sort((a, b) => a.name > b.name)
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
 * Parse UnifiedDependency.xml file to array of non-null strings
 * @param {string} path - Path to a file 
 * @returns {string[]}
 */
function parseUnifiedDependencies(path) {
    return fs.readFileSync(path, 'utf8').split('\n').filter(x => x.length);
}

/**
 * The main function for unified dependencies update
 * The function parses unified dependencies file and updates it with new dependencies/remove unused
 * Since the generated tasks can only be used and build with default version, if unified_deps.xml doesn't contain
 * the default version, the specific config (e.g. Node16) will be removed from the list of dependencies
 * @param {String} pathToUnifiedDeps - path to UnifiedDependencies.xml
 * @param {String} pathToNewUnifiedDeps - path to unified_deps.xml which contains dependencies updated on current week
 */
async function updateUnifiedDeps(unifiedDepsPath, newUnifiedDepsPath) {
    let currentDependencies = parseUnifiedDependencies(unifiedDepsPath);
    let updatedDependencies = parseUnifiedDependencies(newUnifiedDepsPath);

    const updatedDependenciesStructure = await getDeps(updatedDependencies);

    let updatedDeps = { added: [], removed: [] };

    [ currentDependencies, updatedDeps ] = await removeConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);
    [ currentDependencies, updatedDeps ] = await updateConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);

    fs.writeFileSync(unifiedDepsPath, currentDependencies.join('\n'));
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
async function updateTfsServerDeps(pathToTfsCore) {
    const depsToUpdate = await updateUnifiedDeps(unifiedDepsPath, newDeps);

    const tfsCore = fs.readFileSync(pathToTfsCore, 'utf8');
    const tfxCoreJson = await xml2js.parseStringPromise(tfsCore);
    const depsToAdd = depsToUpdate.added.filter(dep => depsToUpdate.removed.indexOf(dep) === -1);
    const depsToRemove = depsToUpdate.removed.filter(dep => depsToUpdate.added.indexOf(dep) === -1);

    // removing dependencies
    for (let idx = 0; idx < tfxCoreJson.Component.Directory.length; idx++) {
        const directory = tfxCoreJson.Component.Directory[idx];
        const files = directory.File;
        const needToRemove = files.filter(file => depsToRemove.findIndex(dep => file.$.Origin.includes(dep)) !== -1);
        if (needToRemove.length) {
            tfxCoreJson.Component.Directory.splice(idx, 1);
            idx--;
        }
    }

    depsToAdd.forEach(dep => {
        const directory = formDirectoryTag(dep);
        tfxCoreJson.Component.Directory.unshift(directory);
    });

    const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'utf-8' },
        renderOpts: { pretty: true, indent: '  ', newline: '\n', allowEmpty: false, spacebeforeslash: ' ' }
    });
    const xml = builder.buildObject(tfxCoreJson);

    fs.writeFileSync(pathToTfsCore, xml);
    console.log('Inserting into Tfs Servicing Core file done.');
}

updateTfsServerDeps(tfsServerPath);
