var fs = require('fs');
var path = require('path');

var util = require('../make-util');

var assert = util.assert;
var banner = util.banner;
var fail = util.fail;
var ensureTool = util.ensureTool;
var test = util.test;
var run = util.run;

var consts = require('./consts');

// used by CI that does official publish
function publish(/** @type {{ server: string; task: string }} */ argv) {
    var server = argv.server;
    assert(server, 'server');

    // if task specified, skip
    if (argv.task) {
        banner('Task parameter specified. Skipping publish.');
        return;
    }

    // get the branch/commit info
    var refs = util.getRefs();

    // test whether to publish the non-aggregated tasks zip
    // skip if not the tip of a release branch
    var release = refs.head.release;
    var commit = refs.head.commit;
    if (!release ||
        !refs.releases[release] ||
        commit != refs.releases[release].commit) {

        // warn not publishing the non-aggregated
        console.log(`##vso[task.logissue type=warning]Skipping publish for non-aggregated tasks zip. HEAD is not the tip of a release branch.`);
    } else {
        // store the non-aggregated tasks zip
        var nonAggregatedZipPath = path.join(consts.packagePath, 'non-aggregated-tasks.zip');
        util.storeNonAggregatedZip(nonAggregatedZipPath, release, commit);
    }

    // resolve the nupkg path
    var nupkgFile;
    var nupkgDir = path.join(consts.packagePath, 'pack-target');
    if (!test('-d', nupkgDir)) {
        fail('nupkg directory does not exist');
    }

    var fileNames = fs.readdirSync(nupkgDir);
    if (fileNames.length != 1) {
        fail('Expected exactly one file under ' + nupkgDir);
    }

    nupkgFile = path.join(nupkgDir, fileNames[0]);

    // publish the package
    ensureTool('nuget3.exe');
    run(`nuget3.exe push ${nupkgFile} -Source ${server} -apikey Skyrise`);
}

module.exports = publish;