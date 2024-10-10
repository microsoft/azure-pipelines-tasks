const path = require('path')
const fs = require('fs');

const { Octokit } = require('@octokit/rest');

const util = require('./util');
const basePath = path.join(__dirname, '..');

const token = process.env['GH_TOKEN'];

if (!token) {
    throw new util.CreateReleaseError('GH_TOKEN is not defined');
}

const octokit = new Octokit({ auth: token });

const OWNER = 'microsoft';
const REPO = 'azure-pipelines-tasks-common-packages';

/**
 * The function looks for the date of the commit where the package version was bumped
 * @param {String} package - name of the package 
 */
async function getPreviousReleaseDate(package) {
    const packagePath =  path.join(basePath, package, 'package.json');
    const verRegExp = /"version":/;

    function getHashFromVersion(verRegExp, ignoreHash) {
        let blameResult = ''
        if (ignoreHash) {
            blameResult = util.run(`git blame -w --ignore-rev ${ignoreHash} -- ${packagePath}`);
        } else {
            blameResult = util.run(`git blame -w -- ${packagePath}`);
        }
        const blameLines = blameResult.split('\n');
        const blameLine = blameLines.find(line => verRegExp.test(line));
        const commitHash = blameLine.split(' ')[0];
        return commitHash;
    }

    if (!fs.existsSync(packagePath)) {
        throw new Error(`Package ${package} does not exist`);
    }

    const currentHash = getHashFromVersion(verRegExp);
    console.log(`Current version change for ${package} is ${currentHash}`);
    const prevHash = getHashFromVersion(verRegExp, currentHash);
    console.log(`Previous version change for ${package} is ${prevHash}`);

    const date = await getPRDateFromCommit(prevHash);
    console.log(`Previous version change date for ${package} is ${date}`);
    return date;
}


/**
 * Function to get the PR date from the commit hash
 * @param {string} sha1 - commit hash
 * @returns {Promise<string>} - date as a string with merged PR
 */
async function getPRDateFromCommit(sha1) {
    const response = await octokit.request('GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls', {
        owner: OWNER,
        repo: REPO,
        commit_sha: sha1,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
    });

    if (!response.data.length) {
        throw new Error(`No PRs found for commit ${sha1}`);
    }

    return response.data[0].merged_at;
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
                q: `type:pr+is:merged+repo:${OWNER}/${REPO}+base:${branch}+merged:>${date}`,
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
        throw new Error(e.message);
    }
}

/**
 * Function to get the changed files for the PRs
 * @param {Array<Object>} PRs - PRs to get the changed files for
 * @returns {Array<Object>} - Modified files for the PRs which contains packages options. 
 */
async function getPRsFiles(PRs, package) {
    for (let i = 0; i < PRs.length; i++) {
        const PR = PRs[i];
        const pull_number = PR.number;
        console.log(`Fetching files for PR ${pull_number}`);
        PR.packageExists = false;
        const response = await octokit.pulls.listFiles({
            owner: OWNER,
            repo: REPO,
            pull_number
        });

        const files = response.data.map(file => file.filename);

        for (let j = 0; j < files.length; j++) {
            const file = files[j];
            
            if (file.includes(package)) {
                PR.packageExists = true;
            }
        }
    }

    return PRs;
}

/**
 * Function that create a release notes + tag for the new release
 * @param {string} releaseNotes - Release notes for the new release
 * @param {string} package - The name of the package
 * @param {string} version - Version of the new release
 * @param {string} releaseBranch - Branch to create the release on
 */
async function createRelease(releaseNotes, package, version, releaseBranch) {
    const name = `Release ${package} ${version}`;
    const tagName = `${package}-${version}`;
    console.log(`Creating release ${tagName} on ${releaseBranch}`);

    const newRelease = await octokit.repos.createRelease({
        owner: OWNER,
        repo: REPO,
        tag_name: tagName,
        name: name,
        body: releaseNotes,
        target_commitish: releaseBranch,
        generate_release_notes: false
    });

    console.log(`Release ${tagName} created`);
    console.log(`Release URL: ${newRelease.data.html_url}`);
}

/**
 * Function to verify that the new release tag is valid.
 * @param {string} newRelease  - Sprint version of the checked release
 * @returns {Promise<boolean>} - true - release exists, false - release does not exist
 */
async function isReleaseTagExists(package, version) {
    try {
        const tagName = `${package}-${version}`;
        await octokit.repos.getReleaseByTag({
            owner: OWNER,
            repo: REPO,
            tag: tagName
        });

        return true;
    } catch (e) {
        return false
    }
}


async function createReleaseNotes(package, branch) {
    try {
        const version = util.getCurrentPackageVersion(package);
        const isReleaseExists = await isReleaseTagExists(package, version);
        if (isReleaseExists) {
            console.log(`Release ${package}-${version} already exists`);
            return;
        }


        const date = await getPreviousReleaseDate(package);
        const data = await getPRsFromDate(branch, date);
        console.log(`Found ${data.length} PRs`);

        const PRs = await getPRsFiles(data, package);
        const changes = util.getChangesFromPRs(PRs);
        if (!changes.length) {
            console.log(`No changes found for ${package}`);
            return;
        }

        const releaseNotes = changes.join('\n');
        await createRelease(releaseNotes, package, version, branch);
    } catch (e) {
        throw new util.CreateReleaseError(e.message);
    }
}
exports.createReleaseNotes = createReleaseNotes;