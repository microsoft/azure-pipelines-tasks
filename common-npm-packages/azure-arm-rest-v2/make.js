var path = require('path');
var util = require('./build-scripts/util');

var buildPath = './_build'

util.rm('-rf', buildPath)
util.run(path.join(__dirname, 'node_modules/.bin/tsc') + ' --outDir ' + buildPath);

util.cp(path.join(__dirname, 'package.json'), buildPath);
util.cp(path.join(__dirname, 'package-lock.json'), buildPath);
util.cp(path.join(__dirname, 'module.json'), buildPath);
util.cp(path.join('./Tests', 'package.json'), path.join(buildPath, 'Tests'));
util.cp(path.join('./Tests', 'package-lock.json'), path.join(buildPath, 'Tests'));
util.cp('-r', 'openssl', buildPath);
util.cp('-r', 'Strings', buildPath);
util.cp('-r', 'node_modules', buildPath);