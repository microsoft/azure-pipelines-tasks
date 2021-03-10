var fs = require('fs');
var path = require('path');
var process = require('process');
var syncRequest = require('sync-request');
var util = require('./util');

var downloadFile = function (url, downloadPath) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // skip if already downloaded
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'file', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!util.test('-f', marker)) {
        console.log('Downloading file: ' + url);

        // delete any previous partial attempt
        if (util.test('-f', targetPath)) {
            rm('-f', targetPath);
        }

        // download the file
        util.mkdir('-p', path.join(downloadPath, 'file'));
        var result = syncRequest('GET', url);
        fs.writeFileSync(targetPath, result.getBody());

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}

var downloadArchive = function (url, downloadPath) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    var isZip;
    var isTargz;
    if (url.match(/\.zip$/)) {
        isZip = true;
    }
    else if (url.match(/\.tar\.gz$/) && (process.platform == 'darwin' || process.platform == 'linux')) {
        isTargz = true;
    }
    else {
        throw new Error('Unexpected archive extension');
    }

    // skip if already downloaded and extracted
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');
    var targetPath = path.join(downloadPath, 'archive', scrubbedUrl);
    var marker = targetPath + '.completed';
    if (!util.test('-f', marker)) {
        // download the archive
        var archivePath = downloadFile(url, downloadPath);
        console.log('Extracting archive: ' + url);

        // delete any previously attempted extraction directory
        if (util.test('-d', targetPath)) {
            rm('-rf', targetPath);
        }

        // extract
        util.mkdir('-p', targetPath);
        if (isZip) {
            if (process.platform == 'win32') {
                let escapedFile = archivePath.replace(/'/g, "''").replace(/"|\n|\r/g, ''); // double-up single quotes, remove double quotes and newlines
                let escapedDest = targetPath.replace(/'/g, "''").replace(/"|\n|\r/g, '');

                let command = `$ErrorActionPreference = 'Stop' ; try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { } ; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}')`;
                util.run(`powershell -Command "${command}"`);
            } else {
                util.run(`unzip ${archivePath} -d ${targetPath}`);
            }
        }
        else if (isTargz) {
            var originalCwd = process.cwd();
            util.cd(targetPath);
            try {
                util.run(`tar -xzf "${archivePath}"`);
            }
            finally {
                util.cd(originalCwd);
            }
        }

        // write the completed marker
        fs.writeFileSync(marker, '');
    }

    return targetPath;
}

const args = process.argv.slice(2);
const archiveUrl = args[0];
const dest = args[1];

const targetPath = downloadArchive(archiveUrl, path.join('../_download', dest));
if (!fs.existsSync(dest)) {
    util.mkdir('-p', dest);
}
util.cp('-rf', path.join(targetPath, '*'), dest);

exports.downloadArchive=downloadArchive;