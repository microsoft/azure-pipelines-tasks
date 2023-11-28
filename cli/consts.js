var path = require('path');

var buildPath = path.join(__dirname, '_build');
var testPath = path.join(__dirname, '_test');
var tasksPath = path.join(__dirname, 'Tasks');
var gendocsPath = path.join(__dirname, '_gendocs');
var packagePath = path.join(__dirname, '_package');
var makeOptionsPath = path.join(__dirname, 'make-options.json');
var baseConfigToolPath = path.join(__dirname, 'BuildConfigGen');
var genTaskPath = path.join(__dirname, '_generated');
var testsPath = path.join(__dirname, 'Tests');
var testsLegacyPath = path.join(__dirname, 'Tests-Legacy');

var genTaskCommonPath = path.join(genTaskPath, 'Common');

var buildTasksPath = path.join(buildPath, 'Tasks');
var buildTestsPath = path.join(buildPath, 'Tests');
var coverageTasksPath = path.join(buildPath, 'coverage');

var buildTasksCommonPath = path.join(buildTasksPath, 'Common');

var legacyTestTasksPath = path.join(testPath, 'Tasks');
var testTestsLegacyPath = path.join(testPath, 'Tests-Legacy');

var agentPluginTaskNames = ['Cache', 'CacheBeta', 'DownloadPipelineArtifact', 'PublishPipelineArtifact'];

module.exports = {
    buildPath,
    buildTasksPath,
    testPath,
    tasksPath,
    gendocsPath,
    packagePath,
    makeOptionsPath,
    baseConfigToolPath,
    genTaskPath,
    genTaskCommonPath,
    buildTasksCommonPath,
    buildTestsPath,
    testsPath,
    coverageTasksPath,
    testsLegacyPath,
    legacyTestTasksPath,
    testTestsLegacyPath,
    agentPluginTaskNames
}