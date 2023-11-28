var serverBuild = require('./serverBuild');
// eslint-disable-next-line no-unused-vars
var writeUpdatedsFromGenTasks = false;
var util = require('../make-util');
var fail = util.fail;

//
// ex: node make.js build
// ex: node make.js build --task ShellScript
//
function build(/** @type {{ task: string }} */ argv) {
    if (process.env.TF_BUILD) {
        fail('Please use serverBuild for CI builds for proper validation');
    }

    writeUpdatedsFromGenTasks = true;
    serverBuild({
        ...argv,
        writeUpdatedsFromGenTasks
    });
}

module.exports = build;