var path = require('path');

var base = path.join(__dirname, '..');
var buildPath = path.join(base, '_build');
var testPath = path.join(base, '_test');
var tasksPath = path.join(base, 'Tasks');
var gendocsPath = path.join(base, '_gendocs');
var packagePath = path.join(base, '_package');
var makeOptionsPath = path.join(base, 'make-options.json');
var baseConfigToolPath = path.join(base, 'BuildConfigGen');
var genTaskPath = path.join(base, '_generated');
var testsPath = path.join(base, 'Tests');
var testsLegacyPath = path.join(base, 'Tests-Legacy');

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