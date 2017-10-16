import path = require('path');
import taskLib = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import toolLib = require('vsts-task-tool-lib/tool');

export class JavaFilesExtractor {
    public archiveFilePattern: string;
    public destinationFolder: string;
    public repoRoot: string;
    public win: RegExpMatchArray;

    // extractors
    public xpTarLocation: string;
    public xpUnzipLocation: string;
    // 7zip
    public xpSevenZipLocation: string;
    public winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

    constructor() {
        this.archiveFilePattern = taskLib.getInput('itemPattern', true);
        this.destinationFolder = path.normalize(taskLib.getPathInput('destinationFolder', true, false).trim());
        console.log("The default working directory is: " + taskLib.getVariable('System.DefaultWorkingDirectory'));
        this.repoRoot = taskLib.getInput('fromLocalMachine', true);
    
        this.win = taskLib.osType().match(/^Win/);
        taskLib.debug('win: ' + this.win);
    }

    private getSevenZipLocation(): string {
        if (this.win) {
            return this.winSevenZipLocation;
        } else {
            if (typeof this.xpSevenZipLocation == "undefined") {
                this.xpSevenZipLocation = taskLib.which('7z', true);
            }
            return this.xpSevenZipLocation;
        }
    }

    // This check only pertains to linux where the native unzip command is used instead of 7zip
    private isZip(file) {
        return file.endsWith('.zip')
            || file.endsWith('.jar')
            || file.endsWith('.war')
            || file.endsWith('.ear');
    }

    // This check pertains to linux so the native tar command is used, and on windows so the archive is decompressed and untared in two steps using 7zip.
    private isTar(file) {
        var name = this.win ? file.toLowerCase() : file;
        // standard gnu-tar extension formats with recognized auto compression formats
        // https://www.gnu.org/software/tar/manual/html_section/tar_69.html
        return name.endsWith('.tar')      // no compression
            || name.endsWith('.tar.gz')   // gzip
            || name.endsWith('.tgz')      // gzip
            || name.endsWith('.taz')      // gzip
            || name.endsWith('.tar.Z')    // compress
            || (this.win && name.endsWith('tar.z')) // no case comparison for win
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

    private unzipExtract(file, destinationFolder) {
        console.log(taskLib.loc('UnzipExtractFile', file));
        if (typeof this.xpUnzipLocation == "undefined") {
            this.xpUnzipLocation = taskLib.which('unzip', true);
        }
        var unzip = taskLib.tool(this.xpUnzipLocation);
        unzip.arg(file);
        unzip.arg('-d');
        unzip.arg(destinationFolder);
        return this.handleExecResult(unzip.execSync(), file);
    }

    private sevenZipExtract(file, destinationFolder) {
        console.log(taskLib.loc('SevenZipExtractFile', file));
        var sevenZip = taskLib.tool(this.getSevenZipLocation());
        sevenZip.arg('x');
        sevenZip.arg('-o' + destinationFolder);
        sevenZip.arg(file);
        console.log("inside sevenZipExtract");
        return this.handleExecResult(sevenZip.execSync(), file);
    }

    private tarExtract(file, destinationFolder) {
        console.log(taskLib.loc('TarExtractFile', file));
        if (typeof this.xpTarLocation == "undefined") {
            this.xpTarLocation = taskLib.which('tar', true);
        }
        var tar = taskLib.tool(this.xpTarLocation);
        tar.arg('-xvf'); // tar will correctly handle compression types outlined in isTar()
        tar.arg(file);
        tar.arg('-C');
        tar.arg(destinationFolder);
        return this.handleExecResult(tar.execSync(), file);
    }

    private handleExecResult(execResult: tr.IExecResult, file) {
        console.log("Inside handleExecResult");
        console.log('execResult: ' + JSON.stringify(execResult));
        if (execResult.code != taskLib.TaskResult.Succeeded) {
            taskLib.debug('execResult: ' + JSON.stringify(execResult));
            this.failTask(taskLib.loc('ExtractFileFailedMsg', file, execResult.code, execResult.stdout, execResult.stderr, execResult.error));
        }
    }

    private failTask(message: string) {
        taskLib.debug(message);
        taskLib.setResult(taskLib.TaskResult.Failed, message);
    }

    private extractFiles(file: string) {
        var stats = taskLib.stats(file);
        if (!stats) {
            this.failTask(taskLib.loc('ExtractNonExistFile', file));
        } else if (stats.isDirectory()) {
            this.failTask(taskLib.loc('ExtractDirFailed', file));
        }

        if (this.win) {
            if (this.isTar(file)) {
                if (file.endsWith('.tar')) { // a simple tar
                    //this.sevenZipExtract(file, this.destinationFolder); TODO
                    toolLib.extract7z(file, this.destinationFolder);

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
                    var tempFolder = path.normalize(this.destinationFolder + path.sep + '_' + shortFileName + '_');
                    if (!taskLib.exist(tempFolder)) {
                        console.log(taskLib.loc('CreateTempDir', tempFolder, file));
                        // 0 create temp folder
                        taskLib.mkdirP(tempFolder);
                        // 1 extract compressed tar

                        //this.sevenZipExtract(file, tempFolder); TODO
                        toolLib.extract7z(file, this.destinationFolder);
                        
                        console.log(taskLib.loc('TempDir', tempFolder));
                        var tempTar = tempFolder + path.sep + taskLib.ls('-A', [tempFolder])[0]; // should be only one
                        console.log(taskLib.loc('DecompressedTempTar', file, tempTar));
                       
                        // 2 expand extracted tar
                        //this.sevenZipExtract(tempTar, this.destinationFolder); TODO
                        toolLib.extract7z(file, this.destinationFolder);

                        // 3 cleanup temp folder
                        console.log(taskLib.loc('RemoveTempDir', tempFolder));
                        taskLib.rmRF(tempFolder);
                    } else {
                        this.failTask(taskLib.loc('ExtractFailedCannotCreate', file, tempFolder));
                    }
                }
            } else if (this.isZip(file)) {
                toolLib.extractZip(file);
            }else { // use sevenZip
                toolLib.extract7z(file, this.destinationFolder);
            }
        } else { // not windows
            if (this.isTar(file)) {
                //this.tarExtract(file, this.destinationFolder);
                toolLib.extractTar(file);
            } else if (this.isZip(file)) {
                //this.unzipExtract(file, this.destinationFolder);
                toolLib.extractZip(file);
            } else { // fall through and use sevenZip
                //this.sevenZipExtract(file, this.destinationFolder)
                toolLib.extract7z(file, this.destinationFolder);
            }
        }
    }

    public unzipJavaDownload() {
        try {
            // // Create the destination folder if it doesn't exist
            // console.log("inside unzipJavaDownload");
            // if (!taskLib.exist(this.destinationFolder)) {
            //     console.log("Folder didn't exists ha ha ha");
            //     console.log(taskLib.loc('CreateDestDir', this.destinationFolder));
            //     taskLib.mkdirP(this.destinationFolder);
            // }

            console.log("Uh oh...about to be normalized...........");
            var jdkFile = path.normalize(this.repoRoot);
            console.log("I've been normalized!!!!");
            var stats = taskLib.stats(jdkFile);
            if (stats.isFile()) {
                console.log("I'm a file!!!!");
                this.extractFiles(jdkFile);
                taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));
            }
        } catch (e) {
            taskLib.debug(e.message);
            taskLib._writeError(e);
            taskLib.setResult(taskLib.TaskResult.Failed, e.message);
        }
    }

}