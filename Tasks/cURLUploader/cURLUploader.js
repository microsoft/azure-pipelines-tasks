var tl = require('vso-task-lib');
var path = require('path');

// Define error handler
var onError = function (errorMsg) {
    tl.error(errorMsg);
    tl.exit(1);
}

var firstWildcardIndex = function (str) {
    var idx = str.indexOf('*');

    var idxOfWildcard = str.indexOf('?');
    if (idxOfWildcard > -1) {
        if (idx > -1) {
            idx = Math.min(idx, idxOfWildcard);
        } else {
            idx = idxOfWildCard; 
        }
    }

    return idx;
}

// Get files to be uploaded 
var filesPattern = tl.getInput('files', true);
tl.debug('filesPattern: ' + filesPattern); 

// Get username for server authentication
var username = tl.getInput('username', false);
tl.debug('user: ' + username);

// Get password for server authentication
var password = tl.getInput('password', false);
tl.debug('password nil?: ' + !(password));

// Get where to upload
var url = tl.getInput('url', true);
tl.debug('URL: ' + url);

// Should redirect stderr to stdout (curl by defaults write progress bar to stderr, and they show up as error text) 
var redirectStderr = tl.getInput('redirectStderr', false);
tl.debug('redirectStderr: ' + redirectStderr);

var options = tl.getInput('options', false);
tl.debug("options: " + options);

// Find location of curl 
var curlPath = tl.which('curl');
if (!curlPath) {
    onError('curl was not found in the path.');
}

// Resolve files for the specified value or pattern
if (filesPattern.indexOf('*') == -1 && filesPattern.indexOf('?') == -1) {
    // No pattern found, check literal path to a single file
    tl._checkPath(filesPattern);

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
        onError('No matching files were found with search pattern: ' + filesPattern);
    }

    var uploadFiles = '{"' + uploadFilesList.join('","') + '"}'
}
tl.debug("upload files: " + uploadFiles);


// Prepare curl upload command line
var curlRunner = new tl.ToolRunner('curl');

if (redirectStderr === 'true') {
    curlRunner.arg('--stderr -');
}

if (options) {
    curlRunner.arg(options);
}

if (username || password) {
    var userPassCombo = "";
    if (username) {
        userPassCombo += '"' + username + '"';
    }

    userPassCombo += ":";

    if (password) {
        userPassCombo += '"' + password + '"';
    }

    curlRunner.arg('-u');
    curlRunner.arg(userPassCombo);
}

curlRunner.arg('-T')
curlRunner.arg(uploadFiles);

curlRunner.arg(url);

// Execute build
curlRunner.exec()
.then(function (code) {
    // Executed successfully
    tl.exit(code);
})
.fail(function (err) {
    // Error executing
    tl.debug('ToolRunner execution failure: ' + err);
    tl.exit(1);
})
