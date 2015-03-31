var fs = require('fs');
var path = require('path');
var tl = require('vso-task-lib');

// Get configuration
var configuration = tl.getInput('configuration', true);
tl.debug('Configuration: ' + configuration);

// Get and check path to solution file (.sln)
var solutionPath = tl.getPathInput('solution', true, true);
tl.debug('Solution path: ' + solutionPath);

// Get whether to build for the iOS Simulator
var buildForSimulator = tl.getInput('forSimulator', false);
var device = (buildForSimulator == 'true') ? 'iPhoneSimulator' : 'iPhone';
tl.debug('Build for iOS Simulator: ' + buildForSimulator);
tl.debug('Device: ' + device);

// Get path to mdtool
var mdtoolPath = tl.getInput('mdtoolLocation', false);
if (!mdtoolPath) {
    // When no override location is provided, use the standard mdtool installation path
    mdtoolPath = '/Applications/Xamarin Studio.app/Contents/MacOS/mdtool';
}
tl.debug('mdtool path: ' + mdtoolPath);

// Check path to mdtool
if (!fs.existsSync(mdtoolPath)) {
    tl.error('The path to mdtool does not exist: ' + mdtoolPath);
    tl.exit(1);
}

// Prepare build command line
var mdtoolRunner = new tl.ToolRunner(mdtoolPath);
mdtoolRunner.arg('--verbose');
mdtoolRunner.arg('build');
mdtoolRunner.arg('--configuration:' + configuration + '|' + device);
mdtoolRunner.arg(solutionPath);

// Execute build
mdtoolRunner.exec()
.then(function (code) {
    // Executed successfully
    tl.exit(code);
})
.fail(function (err) {
    // Error executing
    tl.debug('ToolRunner execution error');
    tl.exit(1);
})
