var fs = require('fs');
var glob = require('glob');
var tl = require('vso-task-lib');

// Define error handler
var onError = function (errorMsg) {
    tl.error(errorMsg);
    tl.exit(1);
}

// Get files to be uploaded 
var files = tl.getInput('files', true);
tl.debug('files: ' + files);

// Get username for server authentication
var username = tl.getInput('username', false);
tl.debug('user: ' + username);

// Get password for server authentication
var password = tl.getInput('password', false);
tl.debug('password nil?: ' + !(password));

// Get where to upload
var url = tl.getInput('url', true);
tl.debug('URL: ' + url);

var options = tl.getInput('options', false);
tl.debug("options: " + options);

// Find location of curl 
var curlPath = tl.which('curl');
if (!curlPath) {
    onError('curl was not found in the path.');
}

// Resolve files for the specified value or pattern
if (files.indexOf('*') == -1 && files.indexOf('?') == -1) {
    // Check literal path to a single file
    if (!fs.existsSync(files)) {
        onError('The specified file does not exist: ' + files);
    }

    // Use the single specified app file
    var uploadFiles = files;
}
else {
    // Find app files matching the specified pattern
    tl.debug('Invoking glob with path: ' + files);
    var uploadFilesList = glob.sync(files);

    // Fail if no matching app files were found
    if (!uploadFilesList || uploadFilesList.length == 0) {
        onError('No matching files were found with search pattern: ' + files);
    }

    var uploadFiles = "{" + uploadFilesList.join(",") + "}"
}
tl.debug("upload files: " + uploadFiles);


// Prepare curl upload command line
var curlRunner = new tl.ToolRunner('curl');

if (options) {
    curlRunner.arg(options);
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
