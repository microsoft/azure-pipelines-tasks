const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const cp = require('child_process');


const newDeps = process.argv[2];
const msPrefix = 'Mseng.MS.TF.DistributedTask.Tasks.';

// Git configuration
const GIT = 'git';
const token = process.env.PAT || process.env.TOKEN;
const orgUrl= 'dev.azure.com/mseng'
const project = 'AzureDevOps';
const repo = 'AzureDevOps';
const username = process.env.USERNAME || 'azure-pipelines-bot';
const sourceBranch = process.env.BRANCH_NAME || `courtesy-push-${Date.now()}`;
const commitMessage = 'Update UnifiedDependencies.xml and TfsServer.hosted.xml';
const dryrun = process.env.DRYRUN === 'true';

// Validate required environment variables
if (!token) {
    console.error('Error: PAT or TOKEN environment variable is required for git authentication');
    process.exit(1);
}
if (!newDeps) {
    console.error('Usage: node courtesy-push.js <newDepsFile>');
    process.exit(1);
}

/**
 * Execute a command in the foreground
 * @param {string} command - The command to execute
 * @param {string} directory - The directory to execute the command in
 * @param {boolean} dryrun - Whether this is a dry run
 */
function execInForeground(command, directory) {
    directory = directory || '.';
    console.log(`% ${command}`);
    try {
        cp.execSync(command, { cwd: directory, stdio: [process.stdin, process.stdout, process.stderr] });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        throw error;
    }
}

/**
 * Configure git user settings
 */
function gitConfig() {
    try {
        execInForeground(`${GIT} config --global user.email "${username}@microsoft.com"`, null);
        execInForeground(`${GIT} config --global user.name "${username}"`, null);
    } catch (error) {
        console.warn('Warning: Could not configure git user settings. This might be expected if already configured.');
    }
}

/**
 * Clone the Azure DevOps repository if it doesn't exist
 * @param {string} repoPath - Path where the repo should be cloned
 */

function ensureRepoExists(repoPath) {
    const gitUrl = `https://${token}@${orgUrl}/${project}/_git/${repo}`;

    if (fs.existsSync(repoPath)) {
        console.log(`Removing existing repository at ${repoPath}`);
        fs.rmSync(repoPath, { recursive: true, force: true });
    }
    
    console.log(`Cloning Azure DevOps repository to ${repoPath}`);
    execInForeground(`${GIT} clone --depth 1 ${gitUrl} ${repoPath}`, null);
}

/**
 * Commit and push changes to the Azure DevOps repository
 * @param {string} repoPath - Path to the repository
 * @param {string} targetToCommit - Path to the files to commit
 */

function commitAndPushChanges(repoPath, targetToCommit) {
    console.log('Adding changes to git...');
    console.log('\n=== Git Status Before Add ===');
    try {
        const gitStatus = cp.execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf8' });
        console.log('Git status output:', gitStatus || '(no changes)');
        
        const diffOutput = cp.execSync('git diff --name-only', { cwd: repoPath, encoding: 'utf8' });
        console.log('Modified files:', diffOutput || '(no files)');
    } catch (error) {
        console.log('Could not get git status:', error.message);
    }
    
    execInForeground(`${GIT} add ${targetToCommit}`, repoPath, false);
    console.log('\n=== Git Status After Add ===');
    try {
        const gitStatusAfter = cp.execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf8' });
        console.log('Git status after add:', gitStatusAfter || '(no changes staged)');
    } catch (error) {
        console.log('Could not get git status after add:', error.message);
    }
    gitConfig();
    console.log(`Creating branch ${sourceBranch}...`);
    execInForeground(`${GIT} checkout -b ${sourceBranch}`, repoPath);
    console.log('Committing changes...');
    execInForeground(`${GIT} commit -m "${commitMessage}"`, repoPath);
    console.log('Pushing changes...');
    if(dryrun){
        console.log("SKIPPED THE PUSH COMMAND BECAUSE DRYRUN IS SET TO TRUE")
    }
    else{
        execInForeground(`${GIT} push origin ${sourceBranch}`, repoPath);
    }
}

/**
 * Create a Pull Request in Azure DevOps
 * @param {string} sourceBranch - The source branch name for the PR
 */
async function createPullRequest(sourceBranch) {
    console.log('\n=== Creating Pull Request ===');
    
    try {
        const azdev = require('azure-devops-node-api');
        
        if (!token) {
            console.error('No token provided for PR creation');
            return;
        }
        const authHandler = azdev.getPersonalAccessTokenHandler(token);

        const refs = {
            sourceRefName: `refs/heads/${sourceBranch}`,
            targetRefName: 'refs/heads/main' // Change to 'refs/heads/master' if your repo uses master
        };

        const pullRequestToCreate = {
            ...refs,
            title: 'Courtesy Bump of Tasks',
            description: `Autogenerated PR to bump the versions of tasks
            
This PR was automatically created by the courtesy push process to update:
- Directory.Packages.props with new task dependencies
- TfsServer.hosted.xml with new task configurations

Branch: ${sourceBranch}
Generated: ${new Date().toISOString()}`
        };

        if(!dryrun){

        console.log('Getting Azure DevOps connection...');
        const connection = new azdev.WebApi(`https://${orgUrl}`, authHandler);
        
        console.log('Getting Git API...');
        const gitApi = await connection.getGitApi();
        
        console.log('Checking if an active pull request already exists...');
        let existingPRs = await gitApi.getPullRequests(repo, refs, project);
        let PR = existingPRs[0];

        if (PR) {
            console.log(`PR already exists: ${PR.pullRequestId}`);
        } else {
            console.log('Creating new pull request...');
            PR = await gitApi.createPullRequest(pullRequestToCreate, repo, project);
            console.log(`Successfully created PR: ${PR.pullRequestId}`);
        }

        const prLink = `https://${orgUrl}/${project}/_git/${repo}/pullrequest/${PR.pullRequestId}`;
        console.log(`Link to the PR: ${prLink}`);
        
        // Set Azure Pipeline variables
        console.log(`##vso[task.setvariable variable=PR_ID]${PR.pullRequestId}`);
        console.log(`##vso[task.setvariable variable=PR_LINK]${prLink}`);
        
        return {
            prId: PR.pullRequestId,
            prLink: prLink
        };
     }else{
        console.log("================Printing the PR details:================")
        console.log(`   Source Branch: ${sourceBranch}`);
        console.log(`   Target Branch: main`);
        console.log(`   Title: Courtesy Bump of Tasks`);
        console.log(`   Organization: ${orgUrl}`);
        console.log(`   Project: ${project}`);
        console.log(`   Repository: ${repo}`);
        console.log(`   Pull-Request description:${JSON.stringify(pullRequestToCreate,null,2)}`)
        console.log('DRYRUN set to true-skipping actual PR creation...')
     }

        
    } catch (error) {
        console.error('Error creating pull request:', error.message);
        throw error;
    }
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

    for (let i = 0; i < depArr.length; i++) {
        const newDep = depArr[i];
        var [ name, version ] = await extractDependency(newDep);
        const lowercasedName = name.toLowerCase();
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
        
        const lowerName = name && name.toLowerCase();
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
 * The main function for unified dependencies update
 * The function parses unified dependencies file and updates it with new dependencies/remove unused
 * Since the generated tasks can only be used and build with default version, if unified_deps.xml doesn't contain
 * the default version, the specific config (e.g. Node16) will be removed from the list of dependencies
 * @param {String} unifiedDepsPath - path to UnifiedDependencies.xml
 * @param {String} newUnifiedDepsPath - path to unified_deps.xml which contains dependencies updated on current week
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
async function updateTfsServerDeps() {
    const repoName='AzureDevops'
    const agentTempDir=process.env.AGENT_TEMPDIRECTORY;
    const repoPath=path.join(agentTempDir, repoName);
    
    ensureRepoExists(repoPath);

    const unifiedDepsPath = path.join(repoPath, 'Directory.Packages.props');
    const tfsServerPath = path.join(repoPath, 'Tfs', 'Service', 'Deploy', 'components', 'TfsServer.hosted.xml');
    const pathToTfsCore=tfsServerPath
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
        if(!dryrun)
        console.log('Changes committed and pushed successfully.');
        else{
            console.log('Changes committed but not pushed because DRYRUN is set to true')
        }
        
        // Output branch name for Azure Pipelines to use (in case it was modified)
        console.log(`##vso[task.setvariable variable=actualBranchName]${sourceBranch}`);

        // Create Pull Request
        const prResult = await createPullRequest(sourceBranch);
        if (prResult) {
            console.log(`Pull Request created successfully: ${prResult.prLink}`);
        } else {
            console.log('Pull Request creation failed or skipped');
        }
        
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
        console.log(`New dependencies file: ${newDeps}`);
        console.log(`Branch name: ${sourceBranch}`);
        console.log(`Dry run: ${dryrun}`);
        await updateTfsServerDeps();
        
        console.log('Courtesy push process completed successfully.');
    } catch (error) {
        console.error('Error during courtesy push process:', error.message);
        process.exit(1);
    }
}

// Execute the main function
main();
