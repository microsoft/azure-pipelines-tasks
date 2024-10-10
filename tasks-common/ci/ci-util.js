var ncp = require('child_process');
var fs = require("fs");
var path = require('path');

//------------------------------------------------------------------------------
// global paths
//------------------------------------------------------------------------------

var commonPackagesSourcePath = path.join(__dirname, '..', 'common-npm-packages');
exports.commonPackagesSourcePath = commonPackagesSourcePath;

//------------------------------------------------------------------------------
// generic functions
//------------------------------------------------------------------------------

/**
 * Parses the content of specified source folder and returns the top-level nested directories
 * @param {String} source - The path to the source directory
 * @returns {Array} - The nested directories
 */
var getDirectories = source =>
  fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
exports.getDirectories = getDirectories;

/** 
 * Executes the specified command in system shell and returns the stdout from the command
 * @param {String} cl - The name or path of the executable file to run
 * @param {String} inheritStreams - Configure the pipes that are established between the parent and child process. Default value: pipe
 * @returns {String} - The stdout from the command
 */
var run = function (cl, inheritStreams) {
    console.log('');
    console.log(`> ${cl}`);
    var options = {
        stdio: inheritStreams ? 'inherit' : 'pipe'
    };
    
    var output;
    try {
        output = ncp.execSync(cl, options);
    }
    catch (err) {
        if (!inheritStreams) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        throw new Error(`The following command line failed: '${cl}'`);
    }

    output = (output || '').toString().trim();
    if (!inheritStreams) {
        console.log(output);
    }

    return output;
}
exports.run = run;
