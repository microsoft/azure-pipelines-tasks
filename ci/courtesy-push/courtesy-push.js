const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const cp = require('child_process');

const azureSourceFolder = process.argv[2];
const newDeps = process.argv[3];
const unifiedDepsPath = path.join(azureSourceFolder, 'Directory.Packages.props');
const tfsServerPath = path.join(azureSourceFolder, 'Tfs', 'Service', 'Deploy', 'components', 'TfsServer.hosted.xml');
const msPrefix = 'Mseng.MS.TF.DistributedTask.Tasks.';

// Git configuration
const GIT = 'git';
const token = process.env.PAT || process.env.TOKEN;
// const orgUrl = 'dev.azure.com/mseng';
const orgUrl= 'dev.azure.com/surajitshil'
// const project = 'AzureDevOps';
const project= 'Azure-Repo-File-Structure'
// const repo = 'AzureDevOps';
const repo= 'Azure-Repo-File-Structure'
const username = process.env.USERNAME || 'azure-pipelines-bot';
const sourceBranch = process.env.BRANCH_NAME || `courtesy-push-${Date.now()}`;
const commitMessage = 'Update UnifiedDependencies.xml and TfsServer.hosted.xml';
const dryrun = process.env.DRYRUN === 'true';

// Validate required environment variables
if (!token) {
    console.error('Error: PAT or TOKEN environment variable is required for git authentication');
    process.exit(1);
}

if (!azureSourceFolder || !newDeps) {
    console.error('Usage: node courtesy-push.js <azureSourceFolder> <newDepsFile>');
    process.exit(1);
}

/**
 * Execute a command in the foreground
 * @param {string} command - The command to execute
 * @param {string} directory - The directory to execute the command in
 * @param {boolean} dryrun - Whether this is a dry run
 */
function execInForeground(command, directory, dryrun = false) {
    directory = directory || '.';
    console.log(`% ${command}`);
    if (!dryrun) {
        try {
            cp.execSync(command, { cwd: directory, stdio: [process.stdin, process.stdout, process.stderr] });
        } catch (error) {
            console.error(`Command failed: ${command}`);
            throw error;
        }
    }
}

/**
 * Configure git user settings
 */
function gitConfig() {
    try {
        execInForeground(`${GIT} config --global user.email "${username}@microsoft.com"`, null, dryrun);
        execInForeground(`${GIT} config --global user.name "${username}"`, null, dryrun);
    } catch (error) {
        console.warn('Warning: Could not configure git user settings. This might be expected if already configured.');
    }
}

/**
 * Clone the Azure DevOps repository if it doesn't exist
 * @param {string} repoPath - Path where the repo should be cloned
 */


// function ensureRepoExists(repoPath) {
//     if (!fs.existsSync(repoPath)) {
//         console.log(`Cloning Azure DevOps repository to ${repoPath}`);
//         const gitUrl = `https://${token}@${orgUrl}/${project}/_git/${repo}`;
//         execInForeground(`${GIT} clone --depth 1 ${gitUrl} ${repoPath}`, null, dryrun);
//     } else {
//         console.log(`Repository already exists at ${repoPath}`);
//         // Pull latest changes
//          // Pull latest changes - try main first, then master
//         try {
//             execInForeground(`${GIT} pull origin main`, repoPath, dryrun);
//         } catch (error) {
//             console.log('main branch not found, trying master...');
//             execInForeground(`${GIT} pull origin master`, repoPath, dryrun);
//         }
//     }
// }


// function ensureRepoExists(repoPath) {
//     const gitUrl = `https://${token}@${orgUrl}/${project}/_git/${repo}`;
    
//     // Always start fresh to avoid state issues
//     if (fs.existsSync(repoPath)) {
//         console.log(`Removing existing repository at ${repoPath}`);
//         if (!dryrun) {
//             fs.rmSync(repoPath, { recursive: true, force: true });
//         }
//     }
    
//     console.log(`Cloning Azure DevOps repository to ${repoPath}`);
//     execInForeground(`${GIT} clone --depth 1 ${gitUrl} ${repoPath}`, null, dryrun);
// }


// function ensureRepoExists(repoPath) {
//     const gitUrl = `https://${token}@${orgUrl}/${project}/_git/${repo}`;
    
//     if (!fs.existsSync(repoPath)) {
//         console.log(`Cloning Azure DevOps repository to ${repoPath}`);
//         execInForeground(`${GIT} clone --depth 1 ${gitUrl} ${repoPath}`, null, dryrun);
//     } else {
//         console.log(`Repository already exists at ${repoPath}`);
        
//         // Reset to clean state first
//         console.log('Resetting to clean state...');
//         execInForeground(`${GIT} checkout main`, repoPath, dryrun);
//         execInForeground(`${GIT} reset --hard HEAD`, repoPath, dryrun);
//         execInForeground(`${GIT} clean -fd`, repoPath, dryrun);
        
//         // Pull latest changes - try main first, then master
//         try {
//             execInForeground(`${GIT} pull origin main`, repoPath, dryrun);
//         } catch (error) {
//             console.log('main branch not found, trying master...');
//             try {
//                 execInForeground(`${GIT} checkout master`, repoPath, dryrun);
//                 execInForeground(`${GIT} pull origin master`, repoPath, dryrun);
//             } catch (masterError) {
//                 console.log('Could not pull from main or master');
//                 throw masterError;
//             }
//         }
//     }
// }




function ensureRepoExists(repoPath) {
    const gitUrl = `https://${token}@${orgUrl}/${project}/_git/${repo}`;
    
    // Always start fresh (safest approach)
    if (fs.existsSync(repoPath)) {
        console.log(`Removing existing repository at ${repoPath}`);
        if (!dryrun) {
            fs.rmSync(repoPath, { recursive: true, force: true });
        }
    }
    
    console.log(`Cloning Azure DevOps repository to ${repoPath}`);
    execInForeground(`${GIT} clone --depth 1 ${gitUrl} ${repoPath}`, null, dryrun);
}








/**
 * Commit and push changes to the Azure DevOps repository
 * @param {string} repoPath - Path to the repository
 * @param {string} targetToCommit - Path to the files to commit
 */
// function commitAndPushChanges(repoPath, targetToCommit) {
//     console.log('Adding changes to git...');
//     execInForeground(`${GIT} add ${targetToCommit}`, repoPath, dryrun);
    
//     gitConfig();
    
//     console.log(`Creating branch ${sourceBranch}...`);
//     execInForeground(`${GIT} checkout -b ${sourceBranch}`, repoPath, dryrun);
    
//     console.log('Committing changes...');
//     execInForeground(`${GIT} commit -m "${commitMessage}"`, repoPath, dryrun);
    
//     console.log('Pushing changes...');
//     execInForeground(`${GIT} push --force origin ${sourceBranch}`, repoPath, dryrun);
// }


function commitAndPushChanges(repoPath, targetToCommit) {
    console.log('Adding changes to git...');
    
    // Debug: Check git status before adding
    console.log('\n=== Git Status Before Add ===');
    try {
        const gitStatus = cp.execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf8' });
        console.log('Git status output:', gitStatus || '(no changes)');
        
        const diffOutput = cp.execSync('git diff --name-only', { cwd: repoPath, encoding: 'utf8' });
        console.log('Modified files:', diffOutput || '(no files)');
    } catch (error) {
        console.log('Could not get git status:', error.message);
    }
    
    execInForeground(`${GIT} add ${targetToCommit}`, repoPath, dryrun);
    
    // Debug: Check git status after adding
    console.log('\n=== Git Status After Add ===');
    try {
        const gitStatusAfter = cp.execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf8' });
        console.log('Git status after add:', gitStatusAfter || '(no changes staged)');
    } catch (error) {
        console.log('Could not get git status after add:', error.message);
    }
    
    gitConfig();
    
    console.log(`Creating branch ${sourceBranch}...`);
    execInForeground(`${GIT} checkout -b ${sourceBranch}`, repoPath, dryrun);
    
    console.log('Committing changes...');
    execInForeground(`${GIT} commit -m "${commitMessage}"`, repoPath, dryrun);
    
    console.log('Pushing changes...');
    execInForeground(`${GIT} push --force origin ${sourceBranch}`, repoPath, dryrun);
}

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
        return [ details.PackageVersion.$.Include, details.PackageVersion.$.Version ];
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
        const lowercasedName = name.toLowerCase();
        // console.log("Success-1")

        if (!deps.hasOwnProperty(lowercasedName)) deps[lowercasedName] = {};

        const dep = deps[lowercasedName];

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
    // console.log("Success-2")
    let index = 0;

    while (index < newDepsArr.length) {
        const currentDep = newDepsArr[index];
        const [ name ] = await extractDependency(currentDep);

        if (!name) {
            index++;
            continue;
        }

        const basicName = name.toLowerCase();
        // console.log("Success-3")

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
        
        const lowerName = name && name.toLowerCase();
        // console.log("Success-4")
        if (!name || !basicDepsForUpdate.has(lowerName)) {
            index++;
            continue;
        }

        newDepsArr.splice(index, 1, depsForUpdate[lowerName].depStr);
        index++;

        if (depsForUpdate[lowerName].configs) {
            depsForUpdate[lowerName].configs
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
 * Add new dependencies that don't exist in the current dependencies
 * @param {Array} depsArray - array of parsed dependencies from UnifiedDependencies.xml
 * @param {Object} depsForUpdate - dictionary of dependencies from getDeps method
 * @param {Object} updatedDeps - structure to track added/removed dependencies
 * @returns {Promise<Array>} - updated array of dependencies and updatedDeps object
 */
async function addNewDependencies(depsArray, depsForUpdate, updatedDeps) {
    const newDepsArr = depsArray.slice();
    const updatedDepsObj = Object.assign({}, updatedDeps);
    
    // Get all existing dependency names (lowercase for comparison)
    const existingDeps = new Set();
    for (const dep of newDepsArr) {
        const [name] = await extractDependency(dep);
        if (name) {
            existingDeps.add(name.toLowerCase());
        }
    }
    
    // Add new dependencies that don't exist
    for (const depKey in depsForUpdate) {
        const dep = depsForUpdate[depKey];
        
        // If this dependency doesn't exist in current file, add it
        if (!existingDeps.has(dep.name.toLowerCase())) {
            console.log(`Adding new dependency: ${dep.name}`);
            
            // Add the main dependency
            newDepsArr.push(dep.depStr);
            updatedDepsObj.added.push(dep.name);
            
            // Add its configs (Node16/Node20) if they exist
            if (dep.configs) {
                dep.configs
                    .sort((a, b) => a.name > b.name)
                    .forEach(config => {
                        console.log(`Adding new config: ${config.name}`);
                        newDepsArr.push(config.depStr);
                        updatedDepsObj.added.push(config.name);
                    });
            }
        }
    }
    
    return [newDepsArr, updatedDepsObj];
}






/**
 * Parse Directory.Packages.props as XML and extract PackageVersion elements
 * @param {string} filePath - Path to Directory.Packages.props file
 * @returns {Object} - Object containing packageVersions array and parsed XML structure
 */
async function parseUnifiedDependenciesAsXml(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsedXml = await xml2js.parseStringPromise(content);
    
    // Extract PackageVersion elements as strings
    const packageVersions = [];
    if (parsedXml.Project && parsedXml.Project.ItemGroup) {
        for (const itemGroup of parsedXml.Project.ItemGroup) {
            if (itemGroup.PackageVersion) {
                for (const packageVersion of itemGroup.PackageVersion) {
                    // Convert back to XML string
                    const builder = new xml2js.Builder({
                        headless: true,
                        renderOpts: { pretty: false, indent: '', newline: '' }
                    });
                    const xmlString = builder.buildObject({ PackageVersion: packageVersion }).trim();
                    packageVersions.push(xmlString);
                }
            }
        }
    }
    
    return {
        packageVersions,
        parsedXml
    };
}

/**
 * Write the updated dependencies back to XML format
 * @param {string} filePath - Path to Directory.Packages.props file
 * @param {Array} packageVersions - Array of PackageVersion XML strings
 * @param {Object} originalXml - Original parsed XML structure
 */
async function writeUnifiedDependenciesAsXml(filePath, packageVersions, originalXml) {
    // Find the ItemGroup that contains PackageVersion elements
    let targetItemGroup = null;
    if (originalXml.Project && originalXml.Project.ItemGroup) {
        for (const itemGroup of originalXml.Project.ItemGroup) {
            if (itemGroup.PackageVersion) {
                targetItemGroup = itemGroup;
                break;
            }
        }
    }
    
    if (!targetItemGroup) {
        console.error('Could not find ItemGroup with PackageVersion elements');
        return;
    }
    
    // Parse all PackageVersion strings back to objects
    const newPackageVersions = [];
    for (const pkgStr of packageVersions) {
        try {
            const parsed = await xml2js.parseStringPromise(pkgStr);
            if (parsed.PackageVersion) {
                newPackageVersions.push(parsed.PackageVersion);
            }
        } catch (error) {
            console.error(`Error parsing PackageVersion: ${pkgStr}`, error);
        }
    }
    
    // Replace the PackageVersion array in the target ItemGroup
    targetItemGroup.PackageVersion = newPackageVersions;
    
    // Build the final XML
    const builder = new xml2js.Builder({
        xmldec: { version: '1.0', encoding: 'utf-8' },
        renderOpts: { pretty: true, indent: '  ', newline: '\n', allowEmpty: false, spacebeforeslash: ' ' }
    });
    const xml = builder.buildObject(originalXml);
    
    fs.writeFileSync(filePath, xml);
}



/**
 * Simple approach: Just insert new dependencies at the end of the existing ItemGroup
 * @param {string} filePath - Path to Directory.Packages.props file
 * @param {Array} newDependencyStrings - Array of new PackageVersion XML strings to add
 */
function insertNewDependenciesSimple(filePath, newDependencyStrings) {
    if (newDependencyStrings.length === 0) {
        console.log('No new dependencies to add');
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find the last PackageVersion entry in the ItemGroup
    const lastPackageVersionMatch = content.lastIndexOf('</ItemGroup>');
    
    if (lastPackageVersionMatch === -1) {
        console.error('Could not find </ItemGroup> tag in the file');
        return;
    }
    
    // Create the new dependency entries with proper indentation
    const indent = '    '; // 4 spaces to match existing formatting
    const newEntries = newDependencyStrings.map(dep => `${indent}${dep}`).join('\n');
    
    // Insert new dependencies just before the </ItemGroup> closing tag
    const beforeClosing = content.substring(0, lastPackageVersionMatch);
    const afterClosing = content.substring(lastPackageVersionMatch);
    
    const updatedContent = beforeClosing + newEntries + '\n' + afterClosing;
    
    fs.writeFileSync(filePath, updatedContent);
    console.log(`Added ${newDependencyStrings.length} new dependencies to ${filePath}`);
}







// Replace the insertNewDependenciesSimple function with this improved version:

/**
 * Simple approach: Just insert new dependencies before the closing </ItemGroup> tag
 * @param {string} filePath - Path to Directory.Packages.props file
 * @param {Array} newDependencyStrings - Array of new PackageVersion XML strings to add
 */
function insertNewDependenciesSimple(filePath, newDependencyStrings) {
    if (newDependencyStrings.length === 0) {
        console.log('No new dependencies to add');
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the file has proper XML structure
    const hasProperStructure = content.includes('<Project') && content.includes('<ItemGroup>') && content.includes('</ItemGroup>');
    
    if (hasProperStructure) {
        // Find the last </ItemGroup> tag
        const lastItemGroupMatch = content.lastIndexOf('</ItemGroup>');
        
        if (lastItemGroupMatch === -1) {
            console.error('Could not find </ItemGroup> tag in the file');
            return;
        }
        
        // Find the indentation of the last PackageVersion element
        const lastPackageVersionMatch = content.lastIndexOf('<PackageVersion');
        let indent = '    '; // default 4 spaces
        
        if (lastPackageVersionMatch !== -1) {
            // Find the line containing the last PackageVersion
            const lineStart = content.lastIndexOf('\n', lastPackageVersionMatch) + 1;
            const lineEnd = content.indexOf('\n', lastPackageVersionMatch);
            const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
            
            // Extract the indentation from this line
            const match = line.match(/^(\s*)/);
            if (match) {
                indent = match[1];
            }
        }
        
        // Create the new dependency entries with proper indentation
        const newEntries = newDependencyStrings.map(dep => `${indent}${dep}`).join('\n');
        
        // Insert new dependencies just before the </ItemGroup> closing tag
        const beforeClosing = content.substring(0, lastItemGroupMatch);
        const afterClosing = content.substring(lastItemGroupMatch);
        
        const updatedContent = beforeClosing + newEntries + '\n' + afterClosing;
        
        fs.writeFileSync(filePath, updatedContent);
        console.log(`Added ${newDependencyStrings.length} new dependencies to ${filePath}`);
    } else {
        // File doesn't have proper structure - rebuild it with proper XML structure
        console.log('File appears to be missing XML structure. Rebuilding with proper format...');
        
        // Extract existing PackageVersion elements
        const existingPackageVersions = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('<PackageVersion') && trimmedLine.includes('Include=')) {
                existingPackageVersions.push(trimmedLine);
            }
        }
        
        // Combine existing and new dependencies
        const allDependencies = [...existingPackageVersions, ...newDependencyStrings];
        
        // Create properly structured XML
        const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<Project>
  <ItemGroup>
${allDependencies.map(dep => `    ${dep}`).join('\n')}
  </ItemGroup>
</Project>`;
        
        fs.writeFileSync(filePath, xmlContent);
        console.log(`Rebuilt ${filePath} with proper XML structure and added ${newDependencyStrings.length} new dependencies`);
    }
}












/**
 * The main function for unified dependencies update
 * The function parses unified dependencies file and updates it with new dependencies/remove unused
 * Since the generated tasks can only be used and build with default version, if unified_deps.xml doesn't contain
 * the default version, the specific config (e.g. Node16) will be removed from the list of dependencies
 * @param {String} pathToUnifiedDeps - path to UnifiedDependencies.xml
 * @param {String} pathToNewUnifiedDeps - path to unified_deps.xml which contains dependencies updated on current week
 */

// async function updateUnifiedDeps(unifiedDepsPath, newUnifiedDepsPath) {
//     let currentDependencies = parseUnifiedDependencies(unifiedDepsPath);
//     let updatedDependencies = parseUnifiedDependencies(newUnifiedDepsPath);

//     const updatedDependenciesStructure = await getDeps(updatedDependencies);

//     let updatedDeps = { added: [], removed: [] };

//     [ currentDependencies, updatedDeps ] = await removeConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);
//     [ currentDependencies, updatedDeps ] = await updateConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);

//     fs.writeFileSync(unifiedDepsPath, currentDependencies.join('\n'));
//     console.log('Updating Unified Dependencies file done.');
//     return updatedDeps;
// }

// async function updateUnifiedDeps(unifiedDepsPath, newUnifiedDepsPath) {
// console.log(`\n=== DEBUG: updateUnifiedDeps ===`);
//     console.log(`Reading current deps from: ${unifiedDepsPath}`);
//     console.log(`Reading new deps from: ${newUnifiedDepsPath}`);
    
//     // Parse current dependencies as XML
//     const { packageVersions: currentDependencies, parsedXml: originalXml } = await parseUnifiedDependenciesAsXml(unifiedDepsPath);
    
//     // Parse new dependencies as simple text (since test-deps.xml is just lines)
//     let updatedDependencies = parseUnifiedDependencies(newUnifiedDepsPath);

//     console.log(`Current dependencies count: ${currentDependencies.length}`);
//     console.log(`New dependencies count: ${updatedDependencies.length}`);

//     const updatedDependenciesStructure = await getDeps(updatedDependencies);
//     console.log(`New dependencies structure:`, Object.keys(updatedDependenciesStructure));

//     let updatedDeps = { added: [], removed: [] };

//     // Step 1: Remove old configs (Node16/Node20) for tasks that will be updated
//     let workingDependencies;
//     [ workingDependencies, updatedDeps ] = await removeConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);
    
//     // Step 2: Update existing dependencies with new versions/configs
//     [ workingDependencies, updatedDeps ] = await updateConfigsForTasks(workingDependencies, updatedDependenciesStructure, updatedDeps);
    
//     // Step 3: Find NEW dependencies that don't exist yet (but don't modify currentDependencies)
//     const existingDeps = new Set();
//     for (const dep of currentDependencies) {
//         const [name] = await extractDependency(dep);
//         if (name) {
//             existingDeps.add(name.toLowerCase());
//         }
//     }
    
//     const newDependenciesToAdd = [];
//     for (const depKey in updatedDependenciesStructure) {
//         const dep = updatedDependenciesStructure[depKey];
        
//         // If this dependency doesn't exist in current file, prepare to add it
//         if (!existingDeps.has(dep.name.toLowerCase())) {
//             console.log(`Preparing to add new dependency: ${dep.name}`);
            
//             // Add the main dependency
//             newDependenciesToAdd.push(dep.depStr);
//             updatedDeps.added.push(dep.name);
            
//             // Add its configs (Node16/Node20) if they exist
//             if (dep.configs) {
//                 dep.configs
//                     .sort((a, b) => a.name > b.name)
//                     .forEach(config => {
//                         console.log(`Preparing to add new config: ${config.name}`);
//                         newDependenciesToAdd.push(config.depStr);
//                         updatedDeps.added.push(config.name);
//                     });
//             }
//         }
//     }

//     console.log(`Dependencies to add: ${JSON.stringify(updatedDeps.added)}`);
//     console.log(`Dependencies to remove: ${JSON.stringify(updatedDeps.removed)}`);
    
//     // Only modify the file if there are changes
//     if (updatedDeps.added.length > 0 || updatedDeps.removed.length > 0) {
//         // First, update the existing file with modified dependencies (if any)
//         if (updatedDeps.removed.length > 0) {
//             // Write the updated currentDependencies back (this handles removals and updates)
//             fs.writeFileSync(unifiedDepsPath, currentDependencies.join('\n'));
//         }
        
//         // Then, simply append the new dependencies
//         if (newDependenciesToAdd.length > 0) {
//             insertNewDependenciesSimple(unifiedDepsPath, newDependenciesToAdd);
//         }
        
//         console.log('Updating Unified Dependencies file done.');
//     } else {
//         console.log('No changes detected, skipping file write.');
//     }
    
//     return updatedDeps;
// }

// Replace the updateUnifiedDeps function with this corrected version:

// async function updateUnifiedDeps(unifiedDepsPath, newUnifiedDepsPath) {
//     console.log(`\n=== DEBUG: updateUnifiedDeps ===`);
//     console.log(`Reading current deps from: ${unifiedDepsPath}`);
//     console.log(`Reading new deps from: ${newUnifiedDepsPath}`);
    
//     // Parse current dependencies as XML
//     const { packageVersions: currentDependencies, parsedXml: originalXml } = await parseUnifiedDependenciesAsXml(unifiedDepsPath);
    
//     // Parse new dependencies as simple text (since test-deps.xml is just lines)
//     let updatedDependencies = parseUnifiedDependencies(newUnifiedDepsPath);

//     console.log(`Current dependencies count: ${currentDependencies.length}`);
//     console.log(`New dependencies count: ${updatedDependencies.length}`);

//     const updatedDependenciesStructure = await getDeps(updatedDependencies);
//     console.log(`New dependencies structure:`, Object.keys(updatedDependenciesStructure));

//     let updatedDeps = { added: [], removed: [] };

//     // Step 1: Remove old configs (Node16/Node20) for tasks that will be updated
//     let workingDependencies;
//     [ workingDependencies, updatedDeps ] = await removeConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);
    
//     // Step 2: Update existing dependencies with new versions/configs
//     [ workingDependencies, updatedDeps ] = await updateConfigsForTasks(workingDependencies, updatedDependenciesStructure, updatedDeps);
    
//     // Step 3: Find NEW dependencies that don't exist yet
//     const existingDeps = new Set();
//     for (const dep of currentDependencies) {
//         const [name] = await extractDependency(dep);
//         if (name) {
//             existingDeps.add(name.toLowerCase());
//         }
//     }
    
//     const newDependenciesToAdd = [];
//     for (const depKey in updatedDependenciesStructure) {
//         const dep = updatedDependenciesStructure[depKey];
        
//         // If this dependency doesn't exist in current file, prepare to add it
//         if (!existingDeps.has(dep.name.toLowerCase())) {
//             console.log(`Preparing to add new dependency: ${dep.name}`);
            
//             // Add the main dependency
//             newDependenciesToAdd.push(dep.depStr);
//             updatedDeps.added.push(dep.name);
            
//             // Add its configs (Node16/Node20) if they exist
//             if (dep.configs) {
//                 dep.configs
//                     .sort((a, b) => a.name > b.name)
//                     .forEach(config => {
//                         console.log(`Preparing to add new config: ${config.name}`);
//                         newDependenciesToAdd.push(config.depStr);
//                         updatedDeps.added.push(config.name);
//                     });
//             }
//         }
//     }

//     console.log(`Dependencies to add: ${JSON.stringify(updatedDeps.added)}`);
//     console.log(`Dependencies to remove: ${JSON.stringify(updatedDeps.removed)}`);
    
//     // Only modify the file if there are changes
//     if (updatedDeps.added.length > 0 || updatedDeps.removed.length > 0) {
//         // Combine all dependencies (updated existing ones + new ones)
//         const allDependencies = [...workingDependencies, ...newDependenciesToAdd];
        
//         // Write back with proper XML structure using the original XML structure
//         await writeUnifiedDependenciesAsXml(unifiedDepsPath, allDependencies, originalXml);
        
//         console.log('Updating Unified Dependencies file done.');
//     } else {
//         console.log('No changes detected, skipping file write.');
//     }
    
//     return updatedDeps;
// }


// Replace the updateUnifiedDeps function with this simpler version:

// async function updateUnifiedDeps(unifiedDepsPath, newUnifiedDepsPath) {
//     console.log(`\n=== DEBUG: updateUnifiedDeps ===`);
//     console.log(`Reading current deps from: ${unifiedDepsPath}`);
//     console.log(`Reading new deps from: ${newUnifiedDepsPath}`);
    
//     // Read the original file as text to preserve structure
//     const originalContent = fs.readFileSync(unifiedDepsPath, 'utf8');
    
//     // Parse new dependencies as simple text
//     let currentDependencies = parseUnifiedDependencies(unifiedDepsPath);
//     let updatedDependencies = parseUnifiedDependencies(newUnifiedDepsPath);
//     console.log(`New dependencies count: ${updatedDependencies.length}`);

//     const updatedDependenciesStructure = await getDeps(updatedDependencies);
//     console.log(`New dependencies structure:`, Object.keys(updatedDependenciesStructure));

//     let updatedDeps = { added: [], removed: [] };

//     // Extract existing PackageVersion elements from the original content
//     const existingPackageVersions = [];
//     const lines = originalContent.split('\n');
    
//     for (const line of lines) {
//         const trimmedLine = line.trim();
//         if (trimmedLine.startsWith('<PackageVersion') && trimmedLine.includes('Include=')) {
//             existingPackageVersions.push(trimmedLine);
//         }
//     }
    
//     console.log(`Current dependencies count: ${existingPackageVersions.length}`);

//     // Find existing dependency names for comparison
//     const existingDeps = new Set();
//     for (const dep of existingPackageVersions) {
//         const [name] = await extractDependency(dep);
//         if (name) {
//             existingDeps.add(name.toLowerCase());
//         }
//     }
    
//     // Find NEW dependencies that don't exist yet
//     const newDependenciesToAdd = [];
//     for (const depKey in updatedDependenciesStructure) {
//         const dep = updatedDependenciesStructure[depKey];
        
//         // If this dependency doesn't exist in current file, prepare to add it
//         if (!existingDeps.has(dep.name.toLowerCase())) {
//             console.log(`Preparing to add new dependency: ${dep.name}`);
            
//             // Add the main dependency
//             newDependenciesToAdd.push(dep.depStr);
//             updatedDeps.added.push(dep.name);
            
//             // Add its configs (Node16/Node20) if they exist
//             if (dep.configs) {
//                 dep.configs
//                     .sort((a, b) => a.name > b.name)
//                     .forEach(config => {
//                         console.log(`Preparing to add new config: ${config.name}`);
//                         newDependenciesToAdd.push(config.depStr);
//                         updatedDeps.added.push(config.name);
//                     });
//             }
//         }
//     }

//     console.log(`Dependencies to add: ${JSON.stringify(updatedDeps.added)}`);
//     console.log(`Dependencies to remove: ${JSON.stringify(updatedDeps.removed)}`);
    
//     // Only modify the file if there are new dependencies to add
//     if (newDependenciesToAdd.length > 0) {
//         // Simply append new dependencies to the existing file structure
//         insertNewDependenciesSimple(unifiedDepsPath, newDependenciesToAdd);
//         console.log('Updating Unified Dependencies file done.');
//     } else {
//         console.log('No new dependencies to add, skipping file write.');
//     }
//     [ currentDependencies, updatedDeps ] = await removeConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);
//     [ currentDependencies, updatedDeps ] = await updateConfigsForTasks(currentDependencies, updatedDependenciesStructure, updatedDeps);
    
//     return updatedDeps;
// }






// Replace the updateUnifiedDeps function with this enhanced version:

// async function updateUnifiedDeps(unifiedDepsPath, newUnifiedDepsPath) {
//     console.log(`\n=== DEBUG: updateUnifiedDeps ===`);
//     console.log(`Reading current deps from: ${unifiedDepsPath}`);
//     console.log(`Reading new deps from: ${newUnifiedDepsPath}`);
    
//     // Read the original file as text to preserve structure
//     const originalContent = fs.readFileSync(unifiedDepsPath, 'utf8');
    
//     // Parse new dependencies as simple text
//     let updatedDependencies = parseUnifiedDependencies(newUnifiedDepsPath);
//     console.log(`New dependencies count: ${updatedDependencies.length}`);

//     const updatedDependenciesStructure = await getDeps(updatedDependencies);
//     console.log(`New dependencies structure:`, Object.keys(updatedDependenciesStructure));

//     let updatedDeps = { added: [], removed: [] };

//     // Extract existing PackageVersion elements from the original content
//     const existingPackageVersions = [];
//     const lines = originalContent.split('\n');
    
//     for (const line of lines) {
//         const trimmedLine = line.trim();
//         if (trimmedLine.startsWith('<PackageVersion') && trimmedLine.includes('Include=')) {
//             existingPackageVersions.push(trimmedLine);
//         }
//     }
    
//     console.log(`Current dependencies count: ${existingPackageVersions.length}`);

//     // Step 1: Process existing dependencies - update versions and remove old configs
//     let processedDependencies = [];
//     const basicDepsForUpdate = Object.keys(updatedDependenciesStructure).map(dep => dep.toLowerCase());
    
//     for (const existingDep of existingPackageVersions) {
//         const [name] = await extractDependency(existingDep);
//         if (!name) {
//             processedDependencies.push(existingDep);
//             continue;
//         }
        
//         const basicName = name.toLowerCase();
//         const lowerName = name.toLowerCase();
        
//         // Check if this is a config (Node16/Node20) that should be removed
//         if (isIncludeButNotEqual(basicDepsForUpdate, basicName)) {
//             console.log(`Removing old config: ${name}`);
//             updatedDeps.removed.push(name);
//             continue; // Skip this dependency
//         }
        
//         // Check if this dependency needs to be updated
//         if (updatedDependenciesStructure.hasOwnProperty(lowerName)) {
//             console.log(`Updating existing dependency: ${name}`);
//             // Replace with new version
//             processedDependencies.push(updatedDependenciesStructure[lowerName].depStr);
            
//             // Add new configs (Node16/Node20) if they exist
//             if (updatedDependenciesStructure[lowerName].configs) {
//                 updatedDependenciesStructure[lowerName].configs
//                     .sort((a, b) => a.name > b.name)
//                     .forEach(config => {
//                         console.log(`Adding updated config: ${config.name}`);
//                         processedDependencies.push(config.depStr);
//                         updatedDeps.added.push(config.name);
//                     });
//             }
//         } else {
//             // Keep existing dependency as-is
//             processedDependencies.push(existingDep);
//         }
//     }

//     // Step 2: Find NEW dependencies that don't exist in the original file
//     const existingDepNames = new Set();
//     for (const dep of existingPackageVersions) {
//         const [name] = await extractDependency(dep);
//         if (name) {
//             existingDepNames.add(name.toLowerCase());
//         }
//     }
    
//     const newDependenciesToAdd = [];
//     for (const depKey in updatedDependenciesStructure) {
//         const dep = updatedDependenciesStructure[depKey];
        
//         // If this dependency doesn't exist in current file, prepare to add it
//         if (!existingDepNames.has(dep.name.toLowerCase())) {
//             console.log(`Preparing to add new dependency: ${dep.name}`);
            
//             // Add the main dependency
//             newDependenciesToAdd.push(dep.depStr);
//             updatedDeps.added.push(dep.name);
            
//             // Add its configs (Node16/Node20) if they exist
//             if (dep.configs) {
//                 dep.configs
//                     .sort((a, b) => a.name > b.name)
//                     .forEach(config => {
//                         console.log(`Preparing to add new config: ${config.name}`);
//                         newDependenciesToAdd.push(config.depStr);
//                         updatedDeps.added.push(config.name);
//                     });
//             }
//         }
//     }

//     console.log(`Dependencies to add: ${JSON.stringify(updatedDeps.added)}`);
//     console.log(`Dependencies to remove: ${JSON.stringify(updatedDeps.removed)}`);
    
//     // Step 3: Write the updated file
//     if (updatedDeps.added.length > 0 || updatedDeps.removed.length > 0) {
//         // Reconstruct the file with updated dependencies
//         const updatedLines = [];
//         let insideItemGroup = false;
//         let itemGroupIndent = '';
        
//         for (const line of lines) {
//             const trimmedLine = line.trim();
            
//             if (trimmedLine.includes('<ItemGroup>')) {
//                 insideItemGroup = true;
//                 // Detect the indentation level
//                 const match = line.match(/^(\s*)/);
//                 if (match) {
//                     itemGroupIndent = match[1] + '  '; // Add 2 spaces for PackageVersion elements
//                 }
//                 updatedLines.push(line);
//             } else if (trimmedLine.includes('</ItemGroup>')) {
//                 // Insert all processed dependencies before closing ItemGroup
//                 for (const dep of processedDependencies) {
//                     updatedLines.push(`${itemGroupIndent}${dep}`);
//                 }
//                 // Insert all new dependencies
//                 for (const dep of newDependenciesToAdd) {
//                     updatedLines.push(`${itemGroupIndent}${dep}`);
//                 }
//                 updatedLines.push(line);
//                 insideItemGroup = false;
//             } else if (insideItemGroup && trimmedLine.startsWith('<PackageVersion')) {
//                 // Skip existing PackageVersion elements - they're handled above
//                 continue;
//             } else {
//                 // Keep all other lines (comments, other elements, etc.)
//                 updatedLines.push(line);
//             }
//         }
        
//         fs.writeFileSync(unifiedDepsPath, updatedLines.join('\n'));
//         console.log('Updating Unified Dependencies file done.');
//     } else {
//         console.log('No changes detected, skipping file write.');
//     }
    
//     return updatedDeps;
// }








// Replace the updateUnifiedDeps function with this structure-preserving version:

async function updateUnifiedDeps(unifiedDepsPath, newUnifiedDepsPath) {
    console.log(`\n=== DEBUG: updateUnifiedDeps (Structure Preserving) ===`);
    console.log(`Reading current deps from: ${unifiedDepsPath}`);
    console.log(`Reading new deps from: ${newUnifiedDepsPath}`);
    
    // Read the original file as text to preserve structure
    const originalContent = fs.readFileSync(unifiedDepsPath, 'utf8');
    
    // Parse new dependencies
    let updatedDependencies = parseUnifiedDependencies(newUnifiedDepsPath);
    console.log(`New dependencies count: ${updatedDependencies.length}`);

    const updatedDependenciesStructure = await getDeps(updatedDependencies);
    console.log(`New dependencies structure:`, Object.keys(updatedDependenciesStructure));

    let updatedDeps = { added: [], removed: [] };
    const lines = originalContent.split('\n');
    const updatedLines = [];
    
    // Track dependencies that need to be added as new
    const newDependenciesToAdd = [];
    const existingDepNames = new Set();
    
    // First pass: collect existing dependency names
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('<PackageVersion') && trimmedLine.includes('Include=')) {
            const [name] = await extractDependency(trimmedLine);
            if (name) {
                existingDepNames.add(name.toLowerCase());
            }
        }
    }
    
    // Find truly new dependencies
    for (const depKey in updatedDependenciesStructure) {
        const dep = updatedDependenciesStructure[depKey];
        if (!existingDepNames.has(dep.name.toLowerCase())) {
            console.log(`Preparing to add new dependency: ${dep.name}`);
            newDependenciesToAdd.push(dep.depStr);
            updatedDeps.added.push(dep.name);
            
            if (dep.configs) {
                dep.configs
                    .sort((a, b) => a.name > b.name)
                    .forEach(config => {
                        console.log(`Preparing to add new config: ${config.name}`);
                        newDependenciesToAdd.push(config.depStr);
                        updatedDeps.added.push(config.name);
                    });
            }
        }
    }
    
    // Second pass: process each line individually
    let insideItemGroup = false;
    let itemGroupIndent = '';
    const basicDepsForUpdate = Object.keys(updatedDependenciesStructure).map(dep => dep.toLowerCase());
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (trimmedLine.includes('<ItemGroup>')) {
            insideItemGroup = true;
            const match = line.match(/^(\s*)/);
            if (match) {
                itemGroupIndent = match[1] + '  '; // Detect indentation
            }
            updatedLines.push(line);
            
        } else if (trimmedLine.includes('</ItemGroup>')) {
            // Add new dependencies before closing ItemGroup
            if (newDependenciesToAdd.length > 0) {
                for (const dep of newDependenciesToAdd) {
                    updatedLines.push(`${itemGroupIndent}${dep}`);
                }
            }
            updatedLines.push(line);
            insideItemGroup = false;
            
        } else if (insideItemGroup && trimmedLine.startsWith('<PackageVersion')) {
            // Process existing PackageVersion elements
            const [name] = await extractDependency(trimmedLine);
            
            if (!name) {
                // Keep malformed lines as-is
                updatedLines.push(line);
                continue;
            }
            
            const basicName = name.toLowerCase();
            const lowerName = name.toLowerCase();
            
            // Check if this is an old config that should be removed
            if (isIncludeButNotEqual(basicDepsForUpdate, basicName)) {
                console.log(`Removing old config: ${name}`);
                updatedDeps.removed.push(name);
                // Skip this line (remove it)
                continue;
            }
            
            // Check if this dependency needs version update
            if (updatedDependenciesStructure.hasOwnProperty(lowerName)) {
                console.log(`Updating existing dependency: ${name}`);
                // Replace with new version - preserve original indentation
                const originalIndent = line.match(/^(\s*)/)[1];
                updatedLines.push(`${originalIndent}${updatedDependenciesStructure[lowerName].depStr}`);
                
                // Add new configs right after the main dependency
                if (updatedDependenciesStructure[lowerName].configs) {
                    updatedDependenciesStructure[lowerName].configs
                        .sort((a, b) => a.name > b.name)
                        .forEach(config => {
                            console.log(`Adding updated config: ${config.name}`);
                            updatedLines.push(`${originalIndent}${config.depStr}`);
                            updatedDeps.added.push(config.name);
                        });
                }
            } else {
                // Keep existing dependency exactly as-is
                updatedLines.push(line);
            }
            
        } else {
            // Keep all other lines (comments, whitespace, other XML elements) exactly as-is
            updatedLines.push(line);
        }
    }

    console.log(`Dependencies to add: ${JSON.stringify(updatedDeps.added)}`);
    console.log(`Dependencies to remove: ${JSON.stringify(updatedDeps.removed)}`);
    
    // Only write if there are changes
    if (updatedDeps.added.length > 0 || updatedDeps.removed.length > 0) {
        fs.writeFileSync(unifiedDepsPath, updatedLines.join('\n'));
        console.log('Updating Unified Dependencies file done.');
    } else {
        console.log('No changes detected, skipping file write.');
    }
    
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
    // Ensure the Azure DevOps repository exists
    const repoPath = azureSourceFolder;
    ensureRepoExists(repoPath);
    
    // Update the unified dependencies
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
    
    // Commit and push changes if there are any updates
    if (depsToUpdate.added.length > 0 || depsToUpdate.removed.length > 0) {
        console.log(`Dependencies updated: ${depsToUpdate.added.length} added, ${depsToUpdate.removed.length} removed`);
        
        // Commit both the unified dependencies file and the TFS server file
        const filesToCommit = [
            path.relative(repoPath, unifiedDepsPath),
            path.relative(repoPath, pathToTfsCore)
        ].join(' ');
        
        commitAndPushChanges(repoPath, filesToCommit);
        console.log('Changes committed and pushed successfully.');
        
        // Output branch name for Azure Pipelines to use (in case it was modified)
        console.log(`##vso[task.setvariable variable=actualBranchName]${sourceBranch}`);
        
    } else {
        console.log('No dependency changes detected. Nothing to commit.');
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        console.log('Starting courtesy push process...');
        console.log(`Azure source folder: ${azureSourceFolder}`);
        console.log(`New dependencies file: ${newDeps}`);
        console.log(`Branch name: ${sourceBranch}`);
        console.log(`Dry run: ${dryrun}`);
        
        await updateTfsServerDeps(tfsServerPath);
        
        console.log('Courtesy push process completed successfully.');
    } catch (error) {
        console.error('Error during courtesy push process:', error.message);
        process.exit(1);
    }
}

// Execute the main function
main();
