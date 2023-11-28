var path = require('path');

var util = require('../make-util');
var banner = util.banner;

var consts = require('./consts');
//
// node make.js package
// This will take the built tasks and create the files we need to publish them.
//
function _package() {
    banner('Starting package process...')

    // START LOCAL CONFIG
    // console.log('> Cleaning packge path');
    // rm('-Rf', packagePath);
    // TODO: Only need this when we run locally
    //var layoutPath = util.createNonAggregatedZip(buildPath, packagePath);
    // END LOCAL CONFIG
    // Note: The local section above is needed when running layout locally due to discrepancies between local build and
    //       slicing in CI. This will get cleaned up after we fully roll out and go to build only changed.

    var layoutPath = path.join(consts.packagePath, 'milestone-layout');
    util.createNugetPackagePerTask(consts.packagePath, layoutPath);
}

module.exports = _package;