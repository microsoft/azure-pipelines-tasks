const ncp = require('child_process');
const Downloader = require('nodejs-file-downloader');
const path = require('path');
const fs = require('fs');
const { mkdir, rm, test, cd } = require('shelljs');
const crypto = require('crypto');

var repoPath = path.join(__dirname, '..');
var downloadPath = path.join(repoPath, '_download');

var downloadArchiveConcurrentAsync = async function (url, omitExtensionCheck) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    var isZip;
    var isTargz;
    if (omitExtensionCheck) {
        isZip = true;
    }
    else {
        if (url.match(/\.zip$/)) {
            isZip = true;
        }
        else if (url.match(/\.tar\.gz$/) && (process.platform == 'darwin' || process.platform == 'linux')) {
            isTargz = true;
        }
        else {
            throw new Error('Unexpected archive extension');
        }
    }

    // skip if already downloaded and extracted
    var scrubbedUrl = url.replace(/[/\:?]/g, '_');

    var newScrubbedUrl = crypto.createHash('sha256').update(scrubbedUrl).digest('hex');

    var targetPath = path.join(downloadPath, 'archive', newScrubbedUrl);
    var marker = targetPath + '.completed';
    
    if (test('-f', marker)) {
        return targetPath;
    }

    // Make extraction path unique per process to avoid race conditions
    var tempTargetPath = targetPath + '.tmp.' + process.pid;
    
    try {
        // download the archive
        var archivePath = await downloadFileAsync(url);
        console.log('Extracting archive: ' + url);

        // Clean up any previous temp attempt
        if (test('-d', tempTargetPath)) {
            rm('-rf', tempTargetPath);
        }

        // extract to process-specific temp directory
        mkdir('-p', tempTargetPath);
        if (isZip) {
            if (process.platform == 'win32') {
                let escapedFile = archivePath.replace(/'/g, "''").replace(/"|\n|\r/g, '');
                let escapedDest = tempTargetPath.replace(/'/g, "''").replace(/"|\n|\r/g, '');

                let command = `$ErrorActionPreference = 'Stop' ; try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { } ; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}')`;
                run(`powershell -Command "${command}"`);
            } else {
                run(`unzip ${archivePath} -d ${tempTargetPath}`);
            }
        }
        else if (isTargz) {
            var originalCwd = process.cwd();
            cd(tempTargetPath);
            try {
                run(`tar -xzf "${archivePath}"`);
            }
            finally {
                cd(originalCwd);
            }
        }

        // Atomically move to final location (only one process will succeed)
        try {
            fs.renameSync(tempTargetPath, targetPath);
            fs.writeFileSync(marker, '');
        } catch (renameError) {
            // Another process already completed - cleanup temp and check if final exists
            if (test('-d', tempTargetPath)) {
                rm('-rf', tempTargetPath);
            }
            if (!test('-f', marker)) {
                throw renameError; // Re-throw if the other process didn't actually complete
            }
        }

    } catch (error) {
        // Cleanup temp directory on any error
        if (test('-d', tempTargetPath)) {
            rm('-rf', tempTargetPath);
        }
        throw error;
    }

    return targetPath;
}
exports.downloadArchiveConcurrentAsync = downloadArchiveConcurrentAsync;

var downloadFileAsync = async function (url) {
    // validate parameters
    if (!url) {
        throw new Error('Parameter "url" must be set.');
    }

    // skip if already downloaded
    const scrubbedUrl = url.replace(/[/\:?]/g, '_');
    const targetPath = path.join(downloadPath, 'file', scrubbedUrl);
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
        fileName: scrubbedUrl,
        maxAttempts: 3,
        timeout: 60000,
        onProgress: function (percentage, chunk, remainingSize) {
            // check that we run inside pipeline
            if (process.env['AGENT_TEMPDIRECTORY']) {
                console.log(`##vso[task.setprogress value=${percentage};]Downloading file: ${scrubbedUrl}`)
            }
        },
    });

    const { filePath } = await downloader.download(); // Downloader.download() resolves with some useful properties.
    fs.writeFileSync(marker, '');
    return filePath;
}

var run = function (cl, inheritStreams, noHeader, throwOnError) {
    if (!noHeader) {
        console.log();
        console.log('> ' + cl);
    }

    var options = {
        stdio: inheritStreams ? 'inherit' : 'pipe'
    };
    var rc = 0;
    var output;
    try {
        output = ncp.execSync(cl, options);
    }
    catch (err) {
        if (!inheritStreams) {
            console.error(err.output ? err.output.toString() : err.message);
        }

        if (throwOnError)
        {
            throw new Error('Failed to run: ' + cl + ' exit code: ' + err.status);
        }
        else
        {
            process.exit(1);
        }
    }

    return (output || '').toString().trim();
}