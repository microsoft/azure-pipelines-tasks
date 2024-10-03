var admZip = require('adm-zip');
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var process = require('process');
var shell = require('shelljs');
const Downloader = require("nodejs-file-downloader");

// global paths
var downloadPath = path.join(__dirname, '_download');

//------------------------------------------------------------------------------
// shell functions
//------------------------------------------------------------------------------
var shellAssert = function () {
    var errMsg = shell.error();
    if (errMsg) {
        throw new Error(errMsg);
    }
}

var cp = function (options, source, dest) {
    if (dest) {
        shell.cp(options, source, dest);
    }
    else {
        shell.cp(options, source);
    }

    shellAssert();
}
exports.cp = cp;

var mkdir = function (options, target) {
    if (target) {
        shell.mkdir(options, target);
    }
    else {
        shell.mkdir(options);
    }

    shellAssert();
}
exports.mkdir = mkdir;

var rm = function (options, target) {
    if (target) {
        shell.rm(options, target);
    }
    else {
        shell.rm(options);
    }

    shellAssert();
}
exports.rm = rm;

var test = function (options, p) {
    var result = shell.test(options, p);
    shellAssert();
    return result;
}
exports.test = test;
//------------------------------------------------------------------------------

var run = function (cl, stdio) {
    console.log();
    console.log('> ' + cl);
    var options = {
        stdio: (stdio || 'inherit')
    };
    var rc = 0;
    var output;
    try {
        output = child_process.execSync(cl, options);
    }
    catch (err) {
        process.exit(1);
    }

    return (output || '').toString().trim();
}
exports.run = run;

var ensureTool = function (name, versionArgs, validate) {
    console.log(name + ' tool:');
    var toolPath = which(name);
    if (!toolPath) {
        throw new Error(name + ' not found.  might need to run npm install');
    }

    if (versionArgs) {
        var result = exec(name + ' ' + versionArgs);
        if (typeof validate == 'string') {
            if (result.stdout.trim() != validate) {
                throw new Error('expected version: ' + validate);
            }
        }
        else {
            validate(result.stdout.trim());
        }
    }

    console.log(toolPath + '');
}
exports.ensureTool = ensureTool;

const downloadFileAsync = async function (url, fileName) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // skip if already downloaded
    const scrubbedUrl = url.replace(/[/\:?]/g, '_');
    if (fileName === undefined) {
        fileName = scrubbedUrl;
    }
    const targetPath = path.join(downloadPath, 'file', fileName);
    const marker = targetPath + '.completed';
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

exports.downloadFileAsync = downloadFileAsync;

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
    var zip = new admZip(archivePath);
    zip.extractAllTo(targetPath);

    // write the completed marker
    fs.writeFileSync(marker, '');

    return targetPath;
};


exports.downloadArchiveAsync = downloadArchiveAsync;

