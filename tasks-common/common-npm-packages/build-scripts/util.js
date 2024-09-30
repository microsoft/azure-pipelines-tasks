var fs = require('fs');
var ncp = require('child_process');
var path = require('path');
var process = require('process');
var shell = require('shelljs');
const { exception } = require('console');

var shellAssert = function () {
    var errMsg = shell.error();
    if (errMsg) {
        throw new Error(errMsg);
    }
}
/**
 * Function to run command line via child_process.execSync
 * @param {*} cl Command line to run
 * @param {*} inheritStreams - Inherit/pipe stdio streams
 * @param {*} noHeader - Don't print command line header
 * @returns 
 */
var run = function (cl, inheritStreams, noHeader) {
    if (!noHeader) {
        console.log();
        console.log('> ' + cl);
    }

    var options = {
        stdio: inheritStreams ? 'inherit' : 'pipe'
    };
    var rc = 0;
    var output;
    try {
        output = ncp.execSync(cl, options);
    }
    catch (err) {
        if (!inheritStreams) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        throw new Error(`Command '${cl}' failed`)
    }

    return (output || '').toString().trim();
}
exports.run = run;

/**
 * cd unix command via shelljs, with logging
 * change process.cwd() to dir
 * @param {String} dir - Directory path
 */
var cd = function (dir) {
    var cwd = process.cwd();
    if (cwd != dir) {
        console.log('');
        console.log(`> cd ${path.relative(cwd, dir)}`);
        shell.cd(dir);
        shellAssert();
    }
}
exports.cd = cd;

/**
 * mkdir unix command via shelljs
 * @param {String} options - Command options
 * @param {String} source - Source folder path
 * @param {String} dest - Destination folder path
 */
var cp = function (options, source, dest) {
    if (dest) {
        shell.cp(options, source, dest);
    }
    else {
        shell.cp(options, source);
    }

    shellAssert();
}
exports.cp = cp;

/**
 * mkdir unix command via shelljs
 * @param {String} options - Command options
 * @param {String} target - Destination path
 */
var mkdir = function (options, target) {
    if (target) {
        shell.mkdir(options, target);
    }
    else {
        shell.mkdir(options);
    }

    shellAssert();
}
exports.mkdir = mkdir;

/**
 * test unix command via shelljs
 * @param {String} options - Command options
 * @param {String} p - Destination path
 * @returns 
 */
var test = function (options, p) {
    var result = shell.test(options, p);
    shellAssert();
    return result;
}
exports.test = test;

/**
 * rm unix command via shelljs
 * @param {String} options - Command options
 * @param {String} target - Destination path
 */
var rm = function (options, target) {
    if (target) {
        shell.rm(options, target);
    }
    else {
        shell.rm(options);
    }

    shellAssert();
}
exports.rm = rm;

/**
 * Function to create mocha options, return empty string if params not passed
 * @param {String} reporterPath - Path/name to reporter
 * @param {String} baseOutput - Output folder
 * @param {String} reportName - Report name
 * @returns {String} - Mocha options
 */
const createMochaOptions = function (reporterPath, baseOutput, reportName) {
    if (!reporterPath || !baseOutput || !reportName) return '';

    const mochaFile = path.join(baseOutput, reportName + '.xml');
    return `-R ${reporterPath} -O mochaFile=${mochaFile}`
}
exports.createMochaOptions = createMochaOptions;

/**
 * Function to remove folder content
 * @param {String} folder - Path to folder
 * @param {Array} excludedNames - Array of excluded names
 */
const cleanFolder = function (folder, excludedNames) {
    if (!fs.existsSync(folder)) return;
    
    const stack = [folder];
    const excluded = excludedNames || [];

    while (stack.length > 0) {
        const currentFolder = stack.pop();

        try {
            const files = fs.readdirSync(currentFolder);
            if (files.length === 0) {
                fs.rmdirSync(currentFolder);
            } else {
                files.forEach(file => {
                    if (excluded.indexOf(file) === -1) {
                        const filePath = path.join(currentFolder, file);
                        const fileStat = fs.statSync(filePath);
                        if (fileStat.isDirectory()) {
                            stack.push(filePath);
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    }
                });
            }
        } catch (err) {
            console.error(err);
        }
    }
}
exports.cleanFolder = cleanFolder;

/**
 * Function to rename file in folder
 * @param {String} folderPath - Path to folder
 * @param {String} oldName - Old file name
 * @param {String} newName - New file name
 * @returns void
 */
var renameFile = function (folderPath, oldName, newName) {
    try {
        if (!fs.existsSync(folderPath)) return;
        const oldFile = path.join(folderPath, oldName);
        const newFile = path.join(folderPath, newName);
        if (fs.existsSync(oldFile)) {
            fs.renameSync(oldFile, newFile);
        }
    } catch (e) {
        console.log(e)
    }
}
exports.renameFile = renameFile;

class CreateReleaseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CreateReleaseError';
        Error.captureStackTrace(this, CreateReleaseError)
    }
}

exports.CreateReleaseError = CreateReleaseError;
/**
 * Function to form task changes from PRs
 * @param {Array<object>} PRs - PRs to get the release notes for
 * @returns {Object} - Object containing the task changes where key is a task and values - changes for the task
 */
function getChangesFromPRs(PRs) {
    const changes = [];
    PRs.forEach(PR => {
        if (!PR.packageExists) return;

        const closedDate = PR.pull_request.merged_at;
        const date = new Date(closedDate).toISOString().split('T')[0];
        changes.push(` - ${PR.title} (#${PR.number}) (${date})`);
    });
    
    return changes;
}
exports.getChangesFromPRs = getChangesFromPRs;

/**
 * Function to get current version of the package
 * @param {String} package - Package name
 * @returns {String} - version of the package
 **/

function getCurrentPackageVersion(package) {
    const packagePath = path.join(__dirname, '..', package, 'package.json');
    if (!fs.existsSync(packagePath)) {
        throw new CreateReleaseError(`package.json for Package ${package} not found.`)
    }
    const packageJson = require(packagePath);
    return packageJson.version;
}
exports.getCurrentPackageVersion = getCurrentPackageVersion;
