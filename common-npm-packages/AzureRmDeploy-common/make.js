var path = require('path');
var util = require('../build-scripts/util');

var buildPath = './_build'

util.rm('-rf', buildPath)
util.run(path.join(__dirname, 'node_modules/.bin/tsc') + ' --outDir ' + buildPath);

util.cp(path.join(__dirname, 'package.json'), buildPath);
util.cp(path.join(__dirname, 'package-lock.json'), buildPath);
util.cp(path.join(__dirname, 'module.json'), buildPath);
util.cp('-r', 'azure-arm-rest', buildPath);
util.cp('-r', 'node_modules', buildPath);
util.cp('-r', 'operations', buildPath);
util.cp('-r', 'Strings', buildPath);
util.cp('-r', 'Tests', buildPath);
util.cp('-r', 'webdeployment-common', buildPath);
util.cp('-r', 'openssl', buildPath);
util.cp('-r', 'openssl', path.join(buildPath, 'azure-arm-rest'));
util.cp('-r', 'webdeployment-common/WebConfigTemplates', buildPath);
