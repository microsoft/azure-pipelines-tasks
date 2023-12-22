var serverBuild = require('./serverBuild');

var util = require('../make-util');
var fail = util.fail;

var writeUpdatedsFromGenTasks = false;

/**
 * ex: node make.js build
 * ex: node make.js build --task ShellScript
 * @param {{ task: string }} argv
 */
function build(argv) {
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