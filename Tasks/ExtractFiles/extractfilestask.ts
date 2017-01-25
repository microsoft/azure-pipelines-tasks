import path = require('path');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

// archiveFilePatterns is a multiline input containing glob patterns
var archiveFilePatterns: string[] = tl.getDelimitedInput('archiveFilePatterns', '\n', true);
var destinationFolder: string = path.normalize(tl.getPathInput('destinationFolder', true, false).trim());
var cleanDestinationFolder: boolean = tl.getBoolInput('cleanDestinationFolder', false);

var repoRoot: string = tl.getVariable('System.DefaultWorkingDirectory');
tl.debug('repoRoot: ' + repoRoot);

var win = tl.osType().match(/^Win/);
tl.debug('win: ' + win);

// extractors
var xpTarLocation: string;
var xpUnzipLocation: string;
// 7zip
var xpSevenZipLocation: string;
var winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

function getSevenZipLocation(): string {
    if (win) {
        return winSevenZipLocation;
    } else {
        if (typeof xpSevenZipLocation == "undefined") {
            xpSevenZipLocation = tl.which('7z', true);
        }
        return xpSevenZipLocation;
    }
}

function findFiles(): string[] {
    tl.debug('using: ' + archiveFilePatterns.length + ' archiveFilePatterns: ' + archiveFilePatterns + ' to search for archives.');

    // minimatch options
    var matchOptions = { matchBase: true };
    if (win) {
        matchOptions["nocase"] = true;
    }

    // use a set to avoid duplicates
    var Set = require('collections/set');
    var matchingFilesSet = new Set();

    for (var i = 0; i < archiveFilePatterns.length; i++) {
        tl.debug('searching for archives, pattern[' + i + ']: ' + archiveFilePatterns[i]);

        var normalizedPattern: string = path.normalize(archiveFilePatterns[i]);
        tl.debug('normalizedPattern= ' + normalizedPattern);

        var parseResult = parsePattern(normalizedPattern);

        if (parseResult.file != null) {
            try {
                var stats = tl.stats(parseResult.file);
                if (stats.isFile()) {
                    if (matchingFilesSet.add(parseResult.file)) {
                        tl.debug('adding file: ' + parseResult.file);
                    }
                    matchingFilesSet.add(parseResult.file);
                } else if (stats.isDirectory()) { // most likely error scenario is user specified a directory
                    failTask(tl.loc('ExtractDirFailedinFindFiles', parseResult.file));
                } else { // other error scenarios -- less likely
                    failTask(tl.loc('ExtractNotFileFailed', parseResult.file));
                }
            } catch (e) { // typically because it does not exist
                failTask(tl.loc('ExtractNotAccessibleFile', parseResult.file, e));
            }
        } else {
            console.log(tl.loc('SearchInDir', parseResult.search, parseResult.directory));

            var stats = tl.stats(parseResult.directory);

            if (!stats) {
                failTask(tl.loc('SearchNonExistDir', parseResult.directory));
            } else if (!stats.isDirectory()) {
                failTask(tl.loc('SearchNonDir', parseResult.directory));
            }

            var allFiles = tl.find(parseResult.directory);
            tl.debug('Candidates found for match: ' + allFiles.length);

            var matched = tl.match(allFiles, parseResult.search, matchOptions);

            // ensure only files are added, since our search results may include directories
            for (var j = 0; j < matched.length; j++) {
                var match = path.normalize(matched[j]);
                var stats = tl.stats(match);
                if (stats.isFile()) {
                    if (matchingFilesSet.add(match)) {
                        tl.debug('adding file: ' + match);
                    }
                }
            }
        }
    }

    return matchingFilesSet.toArray();
}

function parsePattern(normalizedPattern: string): { file: string, directory: string, search: string } {
    tl.debug('parsePattern: ' + normalizedPattern);

    // the first occurance of a wild card, * or ?
    var firstWildIndex = normalizedPattern.indexOf('*');
    var questionIndex = normalizedPattern.indexOf('?');
    if (questionIndex > -1 && (firstWildIndex == -1 || questionIndex < firstWildIndex)) {
        firstWildIndex = questionIndex;
    }

    // no wildcards
    if (firstWildIndex == -1) {
        return {
            file: makeAbsolute(normalizedPattern),
            directory: null,
            search: null
        };
    }

    // search backwards from the first wild card char for the nearest path separator
    for (var i = firstWildIndex - 1; i > -1; i--) {
        if (normalizedPattern.charAt(i) == path.sep) {
            return {
                file: null,
                directory: makeAbsolute(normalizedPattern.substring(0, i + 1)),
                search: normalizedPattern.substring(i + 1, normalizedPattern.length)
            };
        }
    }

    console.log(tl.loc('NoSearchPatternPath', normalizedPattern, repoRoot));

    return {
        file: null,
        directory: repoRoot,
        search: normalizedPattern
    };
}

function makeAbsolute(normalizedPath: string): string {
    tl.debug('makeAbsolute:' + normalizedPath);

    var result = normalizedPath;
    if (!path.isAbsolute(normalizedPath)) {
        result = path.join(repoRoot, normalizedPath);
        console.log(tl.loc('ResolveRelativePath', normalizedPath, result));
    }
    return result;
}

// This check only pertains to linux where the native unzip command is used instead of 7zip
function isZip(file) {
    return file.endsWith('.zip')
        || file.endsWith('.jar')
        || file.endsWith('.war')
        || file.endsWith('.ear');
}

// This check pertains to linux so the native tar command is used, and on windows so the archive is decompressed and untared in two steps using 7zip.
function isTar(file) {
    var name = win ? file.toLowerCase() : file;
    // standard gnu-tar extension formats with recognized auto compression formats
    // https://www.gnu.org/software/tar/manual/html_section/tar_69.html
    return name.endsWith('.tar')      // no compression
        || name.endsWith('.tar.gz')   // gzip
        || name.endsWith('.tgz')      // gzip
        || name.endsWith('.taz')      // gzip
        || name.endsWith('.tar.Z')    // compress
        || (win && name.endsWith('tar.z')) // no case comparison for win
        || name.endsWith('.taZ')      // compress // no case for win already handled above
        || name.endsWith('.tar.bz2')  // bzip2
        || name.endsWith('.tz2')      // bzip2
        || name.endsWith('.tbz2')     // bzip2
        || name.endsWith('.tbz')      // bzip2
        || name.endsWith('.tar.lz')   // lzip
        || name.endsWith('.tar.lzma') // lzma
        || name.endsWith('.tlz')      // lzma
        || name.endsWith('.tar.lzo')  // lzop
        || name.endsWith('.tar.xz')   // xz
        || name.endsWith('.txz');     // xz
}

function unzipExtract(file, destinationFolder) {
    console.log(tl.loc('UnzipExtractFile', file));
    if (typeof xpUnzipLocation == "undefined") {
        xpUnzipLocation = tl.which('unzip', true);
    }
    var unzip = tl.tool(xpUnzipLocation);
    unzip.arg(file);
    unzip.arg('-d');
    unzip.arg(destinationFolder);
    return handleExecResult(unzip.execSync(), file);
}

function sevenZipExtract(file, destinationFolder) {
    console.log(tl.loc('SevenZipExtractFile', file));
    var sevenZip = tl.tool(getSevenZipLocation());
    sevenZip.arg('x');
    sevenZip.arg('-o' + destinationFolder);
    sevenZip.arg(file);
    return handleExecResult(sevenZip.execSync(), file);
}

function tarExtract(file, destinationFolder) {
    console.log(tl.loc('TarExtractFile', file));
    if (typeof xpTarLocation == "undefined") {
        xpTarLocation = tl.which('tar', true);
    }
    var tar = tl.tool(xpTarLocation);
    tar.arg('-xvf'); // tar will correctly handle compression types outlined in isTar()
    tar.arg(file);
    tar.arg('-C');
    tar.arg(destinationFolder);
    return handleExecResult(tar.execSync(), file);
}

function handleExecResult(execResult: tr.IExecResult, file) {
    if (execResult.code != tl.TaskResult.Succeeded) {
        tl.debug('execResult: ' + JSON.stringify(execResult));
        failTask(tl.loc('ExtractFileFailedMsg', file, execResult.code, execResult.stdout, execResult.stderr, execResult.error));
    }
}

function failTask(message: string) {
    throw new FailTaskError(message);
}

export class FailTaskError extends Error {
}

function extractFiles(files: string[]) {
    // Extract the archive files on a single thread for two reasons:
    // 1 - Multiple threads munge the log messages
    // 2 - Everything is going to be blocked by I/O anyway.
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var stats = tl.stats(file);
        if (!stats) {
            failTask(tl.loc('ExtractNonExistFile', file));
        } else if (stats.isDirectory()) {
            failTask(tl.loc('ExtractDirFailed', file));
        }

        if (win) {
            if (isTar(file)) {
                if (file.endsWith('.tar')) { // a simple tar
                    sevenZipExtract(file, destinationFolder);
                } else { // a compressed tar, e.g. 'fullFilePath/test.tar.bz2'
                    // 7zip can not decompress and expand in one step, so it is necessary
                    // to do this in multiple steps as follows:
                    // 0. create a temporary location to decompress the tar to
                    // 1. decompress the tar to the temporary location
                    // 2. expand the decompressed tar to the output folder
                    // 3. remove the temporary location

                    // e.g. 'fullFilePath/test.tar.bz2' --> 'test.tar.bz2'
                    var shortFileName = file.substring(file.lastIndexOf(path.sep) + 1, file.length);
                    // e.g. 'destinationFolder/_test.tar.bz2_'
                    var tempFolder = path.normalize(destinationFolder + path.sep + '_' + shortFileName + '_');
                    if (!tl.exist(tempFolder)) {
                        console.log(tl.loc('CreateTempDir', tempFolder, file));
                        // 0 create temp folder
                        tl.mkdirP(tempFolder);
                        // 1 extract compressed tar
                        sevenZipExtract(file, tempFolder);
                        console.log(tl.loc('TempDir', tempFolder));
                        var tempTar = tempFolder + path.sep + tl.ls('-A', [tempFolder])[0]; // should be only one
                        console.log(tl.loc('DecompressedTempTar', file, tempTar));
                        // 2 expand extracted tar
                        sevenZipExtract(tempTar, destinationFolder);
                        // 3 cleanup temp folder
                        console.log(tl.loc('RemoveTempDir', tempFolder));
                        tl.rmRF(tempFolder, false);
                    } else {
                        failTask(tl.loc('ExtractFailedCannotCreate', file, tempFolder));
                    }
                }
            } else { // not a tar, so use sevenZip
                sevenZipExtract(file, destinationFolder);
            }
        } else { // not windows
            if (isTar(file)) {
                tarExtract(file, destinationFolder);
            } else if (isZip(file)) {
                unzipExtract(file, destinationFolder);
            } else { // fall through and use sevenZip
                sevenZipExtract(file, destinationFolder)
            }
        }
    }
}

function doWork() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        // Find matching archive files
        var files: string[] = findFiles();
        console.log(tl.loc('FoundFiles', files.length));
        for (var i = 0; i < files.length; i++) {
            console.log(files[i]);
        }

        // Clean the destination folder before extraction?
        if (cleanDestinationFolder && tl.exist(destinationFolder)) {
            console.log(tl.loc('CleanDestDir', destinationFolder));
            tl.rmRF(destinationFolder, false);
        }

        // Create the destination folder if it doesn't exist
        if (!tl.exist(destinationFolder)) {
            console.log(tl.loc('CreateDestDir', destinationFolder));
            tl.mkdirP(destinationFolder);
        }

        extractFiles(files);
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('SucceedMsg'));
    } catch (e) {
        tl.debug(e.message);
        tl._writeError(e);
        tl.setResult(tl.TaskResult.Failed, e.message);
    }
}

doWork();