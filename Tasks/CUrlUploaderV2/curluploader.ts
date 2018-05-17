import path = require('path');
import tl = require('vsts-task-lib/task');
import os = require('os');
import trm = require('vsts-task-lib/toolrunner');
import URL = require('url');

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
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        var isWin = os.type().match(/^Win/); 

        var filesPattern: string = tl.getInput('files', true);
        var redirectStderr: boolean = tl.getBoolInput('redirectStderr', false);
        var options: string = tl.getInput('options', false);

        let url: string = ''; 
        let username: string = '';
        let password: string = '';
        let authType: string = tl.getInput('authType', false);
        if (authType === 'ServiceEndpoint') {
            let serviceEndpointID: string = tl.getInput('serviceEndpoint', true);
            let serviceEndpoint: tl.EndpointAuthorization = tl.getEndpointAuthorization(serviceEndpointID, false);
            username = serviceEndpoint.parameters['username'];
            password = serviceEndpoint.parameters['password'];
            url = URL.format(URL.parse(tl.getEndpointUrl(serviceEndpointID, false))); // url has a / at the end
            if (!username || !password || !url) {
                throw new Error(tl.loc('IncompleteEndpoint'));
            }
        } else {
            username = tl.getInput('username', false);
            password = tl.getInput('password', false);
            url = tl.getInput('url', true); 
        }
        url = url.trim();

        let remotePath: string = tl.getInput('remotePath', false);
        if (remotePath) {
            if(authType === 'UserAndPass'){
                // slash should only be added when authType is UserAndPass
                // when authType is ServiceEndpoint there already is a slash
                url = url + "/";
            }
            url = url + remotePath.replace(/\\/gi, "/").trim();
        }

        // Find location of curl 
        var curlPath: string = tl.which('curl');
        if (!curlPath) {
            throw new Error(tl.loc('CurlNotFound'));
        }

        // Prepare curl upload command line
        var curlRunner: trm.ToolRunner = tl.tool('curl');

        // Resolve files for the specified value or pattern
        let uploadCount = 1;
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
            var uploadFilesList = tl.match(allFiles, filesPattern, undefined, {matchBase: true}).map( (s) => {
                // If running on Windows agent, normalize the Windows style file paths to use '/' rather than '\'.
                // If running on Linux or macOS, escape any '\' in filenames. This is necessary as curl.exe treats 
                // '\' in filenames as escape characters, preventing it from finding those files.
                return isWin ? s.replace(/\\/g, '/') : s.replace(/\\/g, '\\\\');
            });

            // Fail if no matching app files were found
            if (!uploadFilesList || uploadFilesList.length == 0) {
                throw new Error(tl.loc('NoMatchingFilesFound', filesPattern));
            }

            uploadCount = uploadFilesList.length;
            var uploadFiles = '{' + uploadFilesList.join(',') + '}'
        }
        tl.debug(tl.loc('UploadingFiles', uploadFiles));

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

        let output:string = '';
        curlRunner.on('stdout', (buffer: Buffer) => {
            process.stdout.write(buffer);
            output = output.concat(buffer ? buffer.toString() : '');
        });

        var code: number = await curlRunner.exec();
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('CurlReturnCode', code));

        let outputMatch:RegExpMatchArray = output.match(/[\n\r]100\s/g);
        let completed: number = outputMatch ? outputMatch.length : 0;
        tl.debug('Successfully uploaded: ' + completed);
        if (completed != uploadCount) {
            tl.debug('Tested output [' + output + ']');
            tl.warning(tl.loc('NotAllFilesUploaded', completed, uploadCount));
        }
    }
    catch(err) {
        tl.error(err.message);
        tl.setResult(tl.TaskResult.Failed, tl.loc('CurlFailed', err.message));
    }    
}

run();
