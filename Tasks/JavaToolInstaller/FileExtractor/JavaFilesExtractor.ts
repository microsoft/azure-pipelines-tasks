import path = require('path');
import taskLib = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import toolLib = require('vsts-task-tool-lib/tool');

export class JavaFilesExtractor {
    public destinationFolder: string;
    public win: RegExpMatchArray;

    // 7zip
    public xpSevenZipLocation: string;
    public winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

    constructor() {
        this.destinationFolder = path.normalize(taskLib.getPathInput('destinationFolder', true, false).trim());
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

    private async unzipExtract(file, destinationFolder) {
        console.log(taskLib.loc('UnzipExtractFile', file));
        if (process.platform == 'win32') {
            // build the powershell command
            let escapedFile = file.replace(/'/g, "''").replace(/"|\n|\r/g, ''); // double-up single quotes, remove double quotes and newlines
            let escapedDest = destinationFolder.replace(/'/g, "''").replace(/"|\n|\r/g, '');
            let command: string = `$ErrorActionPreference = 'Stop' ; try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { } ; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}')`;
    
            // change the console output code page to UTF-8.
            let chcpPath = path.join(process.env.windir, "system32", "chcp.com");
            await taskLib.exec(chcpPath, '65001');
    
            // run powershell
            let powershell: tr.ToolRunner = taskLib.tool('powershell')
                .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
                .arg(command);
            await powershell.exec();
        }
        else {
            let unzip: tr.ToolRunner = taskLib.tool('unzip')
                .arg(file);
            await unzip.exec(<tr.IExecOptions>{ cwd: destinationFolder });
        }
    }

    private async sevenZipExtract(file, destinationFolder) {
        console.log(taskLib.loc('SevenZipExtractFile', file));
        var sevenZip = taskLib.tool(this.getSevenZipLocation());
        sevenZip.arg('x');
        sevenZip.arg('-o' + destinationFolder);
        sevenZip.arg(file);
        var execResult = sevenZip.execSync();
        if (execResult.code != taskLib.TaskResult.Succeeded) {
            taskLib.debug('execResult: ' + JSON.stringify(execResult));
        }
    }

    private async tarExtract(file, destinationFolder) {
        console.log(taskLib.loc('TarExtractFile', file));
        let tr: tr.ToolRunner = taskLib.tool('tar');
        tr.arg(['xzC', destinationFolder, '-f', file]);
        tr.exec();
    }

    private failTask(message: string) {
        taskLib.debug(message);
        taskLib.setResult(taskLib.TaskResult.Failed, message);
    }

    private extractFiles(file: string, fileEnding: string) {
        var stats = taskLib.stats(file);
        if (!stats) {
            this.failTask(taskLib.loc('ExtractNonExistFile', file));
        } else if (stats.isDirectory()) {
            this.failTask(taskLib.loc('ExtractDirFailed', file));
        }

        if (this.win) {
            if (".tar" == fileEnding) { // a simple tar
                    this.sevenZipExtract(file, this.destinationFolder);
            } else if (".tar.gz" == fileEnding) { // a compressed tar, e.g. 'fullFilePath/test.tar.gz'
                    // e.g. 'fullFilePath/test.tar.gz' --> 'test.tar.gz'
                    var shortFileName = file.substring(file.lastIndexOf(path.sep) + 1, file.length);
                    // e.g. 'destinationFolder/_test.tar.gz_'
                    var tempFolder = path.normalize(this.destinationFolder + path.sep + '_' + shortFileName + '_');
                    console.log(taskLib.loc('CreateTempDir', tempFolder, file));

                    // 0 create temp folder
                    taskLib.mkdirP(tempFolder);

                    // 1 extract compressed tar
                    this.sevenZipExtract(file, tempFolder);
                    console.log(taskLib.loc('TempDir', tempFolder));
                    var tempTar = tempFolder + path.sep + taskLib.ls('-A', [tempFolder])[0]; // should be only one
                    console.log(taskLib.loc('DecompressedTempTar', file, tempTar));
                       
                    // 2 expand extracted tar
                    this.sevenZipExtract(tempTar, this.destinationFolder);

                    // 3 cleanup temp folder
                    console.log(taskLib.loc('RemoveTempDir', tempFolder));
                    taskLib.rmRF(tempFolder);
            } else if (".zip" == fileEnding) {
                this.unzipExtract(file, this.destinationFolder);
            } else { // use sevenZip
                this.sevenZipExtract(file, this.destinationFolder);
            }
        } else { // not windows
            if (".tar" == fileEnding || ".tar.gz" == fileEnding) {
                this.tarExtract(file, this.destinationFolder);
            } else if (".zip" == fileEnding) {
                this.unzipExtract(file, this.destinationFolder);
            } else { // fall through and use sevenZip
                this.sevenZipExtract(file, this.destinationFolder);
            }
        }
    }

    public unzipJavaDownload(repoRoot: string, fileEnding: string) {
        try {
            // Create the destination folder if it doesn't exist
            if (!taskLib.exist(this.destinationFolder)) {
                console.log(taskLib.loc('CreateDestDir', this.destinationFolder));
                taskLib.mkdirP(this.destinationFolder);
            }

            var jdkFile = path.normalize(repoRoot);
            var stats = taskLib.stats(jdkFile);
            if (stats.isFile()) {
                this.extractFiles(jdkFile, fileEnding);
                taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));
            }
        } catch (e) {
            taskLib.debug(e.message);
            taskLib.error(e.message);
            taskLib.setResult(taskLib.TaskResult.Failed, e.message);
        }
    }

}