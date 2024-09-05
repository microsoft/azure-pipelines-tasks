
require('shelljs');
var fs = require('fs');
var os = require('os');
var path = require('path');
var process = require('process');
var admZip = require('adm-zip');
const Downloader = require("nodejs-file-downloader");

var downloadPath = path.join(__dirname, '_download');
var testPath = path.join(__dirname, '_test');

var run = function (cl) {
    console.log('> ' + cl);
    var rc = exec(cl).code;
    if (rc !== 0) {
        echo('Exec failed with rc ' + rc);
        exit(rc);
    }
}
exports.run = run;

const getExternalsAsync = async () => {
    if (process.env['TF_BUILD']) {
        // skip adding node 5.10.1 to the PATH. the CI definition tests against node 5 and 6.
        return;
    }

    // determine the platform
    var platform = os.platform();
    if (platform != 'darwin' && platform != 'linux' && platform != 'win32') {
        throw new Error('Unexpected platform: ' + platform);
    }

    // download the same version of node used by the agent
    // and add node to the PATH
    var nodeUrl = process.env['TASK_NODE_URL'] || 'https://nodejs.org/dist';
    nodeUrl = nodeUrl.replace(/\/$/, '');  // ensure there is no trailing slash on the base URL
    var nodeVersion = 'v16.13.0';
    switch (platform) {
        case 'darwin':
            var nodeArchivePath = await downloadArchiveAsync(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-darwin-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-darwin-x64', 'bin'));
            break;
        case 'linux':
            var nodeArchivePath = await downloadArchiveAsync(nodeUrl + '/' + nodeVersion + '/node-' + nodeVersion + '-linux-x64.tar.gz');
            addPath(path.join(nodeArchivePath, 'node-' + nodeVersion + '-linux-x64', 'bin'));
            break;
        case 'win32':
            var [nodeExePath, nodeLibPath] = await Promise.all([
                downloadFileAsync(nodeUrl + '/' + nodeVersion + '/win-x64/node.exe'),
                downloadFileAsync(nodeUrl + '/' + nodeVersion + '/win-x64/node.lib')
            ]);

            var nodeDirectory = path.join(testPath, 'node');
            mkdir('-p', nodeDirectory);
            cp(nodeExePath, path.join(nodeDirectory, 'node.exe'));
            cp(nodeLibPath, path.join(nodeDirectory, 'node.lib'));
            addPath(nodeDirectory);
            break;
    }
}

exports.getExternalsAsync = getExternalsAsync


var downloadFileAsync = async function (url, fileName) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // skip if already downloaded
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    if (fileName === undefined) {
        fileName = scrubbedUrl;
    }
    var targetPath = path.join(downloadPath, 'file', fileName);
    var marker = targetPath + '.completed';
    if (test('-f', marker)) {
        console.log('File already exists: ' + targetPath);
        return targetPath;
    }

    console.log('Downloading file: ' + url);
    // delete any previous partial attempt
    if (test('-f', targetPath)) {
        rm('-f', targetPath);
    }

    // download the file
    mkdir('-p', path.join(downloadPath, 'file'));

    const downloader = new Downloader({
        url: url,
        directory: path.join(downloadPath, 'file'),
        fileName: fileName
    });

    const { filePath } = await downloader.download(); // Downloader.download() resolves with some useful properties.
    fs.writeFileSync(marker, '');
    return filePath;
};


var downloadArchiveAsync = async function (url, fileName) {
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // skip if already downloaded and extracted
    var scrubbedUrl = url.replace(/[\/\\:?]/g, '_');
    if (fileName !== undefined) {
        scrubbedUrl = fileName;
    }
    var targetPath = path.join(downloadPath, 'archive', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (test('-f', marker)) {
        return targetPath;
    }

    // download the archive
    var archivePath = await downloadFileAsync(url, scrubbedUrl);
    console.log('Extracting archive: ' + url);

    // delete any previously attempted extraction directory
    if (test('-d', targetPath)) {
        rm('-rf', targetPath);
    }

    // extract
    mkdir('-p', targetPath);

    if (targetPath.endsWith('.zip')) {
        var zip = new admZip(archivePath);
        zip.extractAllTo(targetPath);
    }
    else if (targetPath.endsWith('.tar.gz')) {
        run(`tar --extract --gzip --file="${archivePath}" --directory="${targetPath}"`);
    } else {
        throw new Error('Unsupported archive type: ' + targetPath);
    }

    // write the completed marker
    fs.writeFileSync(marker, '');

    return targetPath;
};


var addPath = function (directory) {
    var separator;
    if (os.platform() == 'win32') {
        separator = ';';
    }
    else {
        separator = ':';
    }

    var existing = process.env['PATH'];
    if (existing) {
        process.env['PATH'] = directory + separator + existing;
    }
    else {
        process.env['PATH'] = directory;
    }
}
exports.addPath = addPath;