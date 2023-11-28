var path = require('path');
var fs = require('fs');

var util = require('../make-util');
var rm = util.rm;
var mkdir = util.mkdir;

var buildPath = path.join(__dirname, '_build');
var buildTasksPath = path.join(__dirname, '_build', 'Tasks');
var testPath = path.join(__dirname, '_test');

function ensureBuildTasksAndRemoveTestPath() {
  if (!fs.existsSync(buildTasksPath)) {
      mkdir('-p', buildTasksPath);
  }
  rm('-Rf', testPath);
}

function clean() {
    rm('-Rf', buildPath);
    ensureBuildTasksAndRemoveTestPath();
}

module.exports = {
  clean: clean,
  ensureBuildTasksAndRemoveTestPath: ensureBuildTasksAndRemoveTestPath
};