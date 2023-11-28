var fs = require('fs');

var util = require('../make-util');
var rm = util.rm;
var mkdir = util.mkdir;

var consts = require('./consts');

function ensureBuildTasksAndRemoveTestPath() {
  if (!fs.existsSync(consts.buildTasksPath)) {
      mkdir('-p', consts.buildTasksPath);
  }
  rm('-Rf', consts.testPath);
}

function clean() {
    rm('-Rf', consts.buildPath);
    ensureBuildTasksAndRemoveTestPath();
}

module.exports = {
  clean: clean,
  ensureBuildTasksAndRemoveTestPath: ensureBuildTasksAndRemoveTestPath
};