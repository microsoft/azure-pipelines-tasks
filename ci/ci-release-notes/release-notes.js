const argv = require('minimist')(process.argv.slice(2));
const path = require('path');

const util = require('../ci-util');
const tempGen = require('./template-generator');

const { Octokit } = require('@octokit/rest');

const OWNER = 'microsoft';
const REPO = 'azure-pipelines-tasks';
const GIT = 'git';
const VALID_RELEASE_RE = /^[0-9]{1,3}$/;
// if (!argv.token) throw Error('token is required');

const octokit = new Octokit({ auth: argv.token });

/**
 * Function to verify that the new release tag is valid.
 * @param {string} newRelease  - Sprint version of the checked release
 * @returns {Promise<void>} - Exit from the program if the version already exists
 */
async function verifyNewReleaseTagOk(newRelease) {
    if (!newRelease || !newRelease.match(VALID_RELEASE_RE)) {
        console.log(`Invalid version '${newRelease}'. Version must be in the form of <major>.<minor>.<patch> where each level is 0-999`);
        process.exit(-1);
    }
    try {
        var tag = 'v' + newRelease;
        await octokit.repos.getReleaseByTag({
            owner: OWNER,
            repo: REPO,
            tag: tag
        });

        console.log(`Version ${newRelease} is already in use. Skipping`);
        process.exit(0);
    } catch (e) {
        console.log(`Version ${newRelease} is available for use`);
    }
}

/**
 * Function to check that the release branch has no changes.
 */
function checkGitStatus() {
    const diffString = util.run(`${GIT} diff --name-only ${util.genTaskPath} ${util.tasksSourcePath}`);
    if (diffString.trim().length) {
        console.log('You have uncommited changes in this clone. Aborting.');
        process.exit(-1);
    } else {
        console.log('Git repo is clean.');
    }
    return diffString;
}

/**
 * Function to get the PR from the branch started from date
 * @param {string} branch - Branch to check for PRs
 * @param {string} date - Date since which to check for PRs
 * @returns {Promise<*>} - PRs merged since date
 */
async function getPRsFromDate(branch, date) {
    const PRs = [];
    let page = 1;
    try {
        while (true) {
            const results = await octokit.search.issuesAndPullRequests({
                q: `type:pr+is:merged+repo:${OWNER}/${REPO}+base:${branch}+merged:>=${date}`,
                order: 'asc',
                sort: 'created',
                per_page: 100,
                page
            });

            page++;
            if (results.data.items.length == 0) break;

            PRs.push(...results.data.items);
        }

        return PRs;
    } catch (e) {
        console.log(`Error: Problem fetching PRs: ${e}`);
        process.exit(-1);
    }
}

/**
 * Function to fetch the PRs since the defined release (derivedFrom) based on branch
 * @param {string} branch - Branch to check for PRs
 * @param {string} derivedFrom - Version(tag) to check for PRs
 * @returns {Promise<*>} - PRs merged since derivedFrom was created
*/
async function fetchPRsSinceLastRelease(derivedFrom, branch) {
    console.log('Derived from %o', derivedFrom);
    try {
        var releaseInfo;

        if (derivedFrom !== 'latest') {
            var tag = 'v' + derivedFrom;

            console.log(`Getting release by tag ${tag}`);

            releaseInfo = await octokit.repos.getReleaseByTag({
                owner: OWNER,
                repo: REPO,
                tag: tag
            });
        } else {
            console.log('Getting latest release');

            releaseInfo = await octokit.repos.getLatestRelease({
                owner: OWNER,
                repo: REPO
            });
        }

        var lastReleaseDate = releaseInfo.data.published_at;
        console.log(`Fetching PRs merged since ${lastReleaseDate} on ${branch}`);
        try {
            return await getPRsFromDate(branch, lastReleaseDate);
        } catch (e) {
            console.log(`Error: Problem fetching PRs: ${e}`);
            process.exit(-1);
        }
    } catch (e) {
        console.log(e);
        console.log(`Error: Cannot find release ${derivedFrom}. Aborting.`);
        process.exit(-1);
    }
}

/**
 * Function to get the changed files for the PRs
 * @param {Array<Object>} PRs - PRs to get the changed files for
 * @returns {Array<Object>} - Modified files for the PRs which contains tasks options. 
 */
async function getPRsFiles(PRs) {
    for (let i = 0; i < PRs.length; i++) {
        const PR = PRs[i];
        const pull_number = PR.number;
        console.log(`Fetching files for PR ${pull_number}`);
        const response = await octokit.pulls.listFiles({
            owner: OWNER,
            repo: REPO,
            pull_number
        });

        const files = response.data.map(file => file.filename);

        for (let j = 0; j < files.length; j++) {
            const file = files[j];
            if (file.includes('Tasks') && !file.includes('Common')) {
                const task = file.split('/')[1];
                if (!PR.tasks) PR.tasks = new Set();

                PR.tasks.add(task);
            }
        }
    }

    return PRs;
}

/**
 * Function that create a release notes + tag for the new release
 * @param {string} releaseNotes - Release notes for the new release
 * @param {string} version - Version of the new release
 * @param {string} releaseBranch - Branch to create the release on
 */
async function createRelease(releaseNotes, version, releaseBranch) {
    const tag = 'v' + version;
    console.log(`Creating release ${tag} on ${releaseBranch}`);
    const newRelease = await octokit.repos.createRelease({
        owner: OWNER,
        repo: REPO,
        tag_name: tag,
        name: tag,
        body: releaseNotes,
        target_commitish: releaseBranch,
        generate_release_notes: false
    });

    console.log(`Release ${tag} created`);
    console.log(`Release URL: ${newRelease.data.html_url}`);
}

async function main() {
    const version = argv.version ? String(argv.version) : null;
    const derivedFrom = argv.derivedFrom || 'latest';
    const branch = argv.branch || 'master';
    const releaseBranch = argv.releaseBranch;

    console.log({version, derivedFrom, branch, releaseBranch});
    try {
        if (!version) {
            console.log('Error: You must supply a version');
            process.exit(-1);
        }

        if (!releaseBranch) {
            console.log('Error: You must supply a release branch');
            process.exit(-1);
        }

        await verifyNewReleaseTagOk(version);
        checkGitStatus();
        
        const data = await fetchPRsSinceLastRelease(derivedFrom, branch);
        console.log(`Found ${data.length} PRs`);

        const PRs = await getPRsFiles(data);
        const releaseNotes = tempGen.generateReleaseNotesForPRs(PRs, version);
        await createRelease(releaseNotes, version, releaseBranch);
    } catch (err) {
        throw err;
    }
}

// main();
checkGitStatus();
