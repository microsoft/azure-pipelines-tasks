import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

var firstWildcardIndex = function (str) {
    var idx = str.indexOf('*');

    var idxOfWildcard = str.indexOf('?');
    if (idxOfWildcard > -1) {
        if (idx > -1) {
            idx = Math.min(idx, idxOfWildcard);
        } else {
            idx = idxOfWildcard; 
        }
    }

    return idx;
}

async function run() {
    try {
        var filesPattern: string = tl.getInput('files', true);
        var username: string = tl.getInput('username', false);
        var password: string = tl.getInput('password', false);
        var url: string = tl.getInput('url', true); 
        var redirectStderr: boolean = tl.getBoolInput('redirectStderr', false);
        var options: string = tl.getInput('options', false);

        // Find location of curl 
        var curlPath: string = tl.which('curl');
        if (!curlPath) {
            throw new Error('curl was not found in the path.');
        }

        // Prepare curl upload command line
        var curlRunner: trm.ToolRunner = tl.tool('curl');

        // Resolve files for the specified value or pattern
        if (filesPattern.indexOf('*') == -1 && filesPattern.indexOf('?') == -1) {
            // No pattern found, check literal path to a single file
            tl.checkPath(filesPattern, "filesPattern");

            // Use the specified single file
            var uploadFiles = filesPattern;
        } 
        else {
            // Find app files matching the specified pattern
            tl.debug('Matching glob pattern: ' + filesPattern);

            // First find the most complete path without any matching patterns
            var idx = firstWildcardIndex(filesPattern);
            tl.debug('Index of first wildcard: ' + idx);

            var findPathRoot = path.dirname(filesPattern.slice(0, idx));
            tl.debug('find root dir: ' + findPathRoot);

            // Now we get a list of all files under this root
            var allFiles = tl.find(findPathRoot);

            // Now matching the pattern against all files
            var uploadFilesList = tl.match(allFiles, filesPattern, {matchBase: true});

            // Fail if no matching app files were found
            if (!uploadFilesList || uploadFilesList.length == 0) {
                throw new Error('No matching files were found with search pattern: ' + filesPattern);
            }

            var uploadFiles = '{' + uploadFilesList.join(',') + '}'
        }
        tl.debug("uploading file(s): " + uploadFiles);

        curlRunner.arg('-T')
        // arrayify the arg so vsts-task-lib does not try to break args at space
        // this is required for any file input that could potentially contain spaces
        curlRunner.arg([uploadFiles]);

        curlRunner.arg(url);

        if (redirectStderr) {
            curlRunner.arg('--stderr');
            curlRunner.arg('-');
        }

        if (options) {
            curlRunner.line(options);
        }

        if (username || password) {
            var userPassCombo = "";
            if (username) {
                userPassCombo += username;
            }

            userPassCombo += ":";

            if (password) {
                userPassCombo += password;
            }

            curlRunner.arg('-u');
            curlRunner.arg(userPassCombo);
        }

        var code: number = await curlRunner.exec();
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('CurlReturnCode', code));
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('CurlFailed', err.message));
    }    
}
