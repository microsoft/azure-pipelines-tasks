// eslint-disable-next-line no-unused-vars
var serverBuild = require('./serverBuild');

var util = require('../make-util');
var fail = util.fail;

var writeUpdatedsFromGenTasks = false;

//
// ex: node make.js build
// ex: node make.js build --task ShellScript
//
function build(/** @type {{ task: string }} */ argv) {
    if (process.env.TF_BUILD) {
        fail('Please use serverBuild for CI builds for proper validation');
    }

    writeUpdatedsFromGenTasks = true;
    serverBuild.serverBuild({
        ...argv,
        writeUpdatedsFromGenTasks
    });
}

module.exports = build;