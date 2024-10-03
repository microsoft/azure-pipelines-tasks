var path = require('path');
var fs = require('fs');
var util = require('../build-scripts/util');
var { downloadArchive } = require('../build-scripts/downloadArchive');

var buildPath = './_build'
var toolPath = './tools'
var zipUrl = 'https://vstsagenttools.blob.core.windows.net/tools/7zip/5/7zip.zip'

const targetPath = downloadArchive(zipUrl, path.join('../_download', toolPath));
if (!fs.existsSync(toolPath)) {
    util.mkdir('-p', toolPath);
}

util.cp('-rf', path.join(targetPath, '*'), toolPath);

util.rm('-rf', buildPath)
util.run(path.join(__dirname, 'node_modules/.bin/tsc') + ' --outDir ' + buildPath);

util.cp(path.join(__dirname, 'package.json'), buildPath);
util.cp(path.join(__dirname, 'package-lock.json'), buildPath);
util.cp(path.join(__dirname, 'module.json'), buildPath);
util.cp('-r', 'tools', buildPath);
util.cp('-r', 'Strings', buildPath);
util.cp('-r', 'node_modules', buildPath);