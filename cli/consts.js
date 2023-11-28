var path = require('path');

var buildPath = path.join(__dirname, '_build');
var buildTasksPath = path.join(__dirname, '_build', 'Tasks');
var testPath = path.join(__dirname, '_test');
var tasksPath = path.join(__dirname, 'Tasks');
var gendocsPath = path.join(__dirname, '_gendocs');
var packagePath = path.join(__dirname, '_package');
var makeOptionsPath = path.join(__dirname, 'make-options.json');
var baseConfigToolPath = path.join(__dirname, 'BuildConfigGen');
var genTaskPath = path.join(__dirname, '_generated');
var genTaskCommonPath = path.join(__dirname, '_generated', 'Common');
var buildTasksCommonPath = path.join(__dirname, '_build', 'Tasks', 'Common');
var buildTestsPath = path.join(__dirname, '_build', 'Tests');
var testsPath = path.join(__dirname, 'Tests');
var coverageTasksPath = path.join(buildPath, 'coverage');
var testsLegacyPath = path.join(__dirname, 'Tests-Legacy');
var legacyTestTasksPath = path.join(__dirname, '_test', 'Tasks');
var testTestsLegacyPath = path.join(__dirname, '_test', 'Tests-Legacy');

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