import fs = require('fs');
import path = require('path');
import taskLib = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

export class JavaFilesExtractor {
    public destinationFolder: string;
    public win: RegExpMatchArray;

    // 7zip
    public xpSevenZipLocation: string;
    public winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

    constructor() {
        this.win = taskLib.osType().match(/^Win/);
        taskLib.debug('win: ' + this.win);
    }

    private getSevenZipLocation(): string {
        if (this.win) {
            return this.winSevenZipLocation;
        } else {
            if (typeof this.xpSevenZipLocation === "undefined") {
                this.xpSevenZipLocation = taskLib.which('7z', true);
            }
            return this.xpSevenZipLocation;
        }
    }

    private async unzipExtract(file, destinationFolder) {
        console.log(taskLib.loc('UnzipExtractFile', file));
        if (process.platform === 'win32') {
            // build the powershell command
            const escapedFile = file.replace(/'/g, "''").replace(/"|\n|\r/g, ''); // double-up single quotes, remove double quotes and newlines
            const escapedDest = destinationFolder.replace(/'/g, "''").replace(/"|\n|\r/g, '');
            const command: string = `$ErrorActionPreference = 'Stop' ; try { Add-Type -AssemblyName System.IO.Compression.FileSystem } catch { } ; [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}')`;
    
            // change the console output code page to UTF-8.
            const chcpPath = path.join(process.env.windir, "system32", "chcp.com");
            await taskLib.exec(chcpPath, '65001');
    
            // run powershell
            const powershell: tr.ToolRunner = taskLib.tool('powershell')
                .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
                .arg(command);
            await powershell.exec();
        } else {
            const unzip: tr.ToolRunner = taskLib.tool('unzip')
                .arg(file);
            await unzip.exec(<tr.IExecOptions>{ cwd: destinationFolder });
        }
    }

    private async sevenZipExtract(file, destinationFolder) {
        console.log(taskLib.loc('SevenZipExtractFile', file));
        const sevenZip = taskLib.tool(this.getSevenZipLocation());
        sevenZip.arg('x');
        sevenZip.arg('-o' + destinationFolder);
        sevenZip.arg(file);
        const execResult = sevenZip.execSync();
        if (execResult.code != taskLib.TaskResult.Succeeded) {
            taskLib.debug('execResult: ' + JSON.stringify(execResult));
        }
    }

    private async tarExtract(file, destinationFolder) {
        console.log(taskLib.loc('TarExtractFile', file));
        const tr: tr.ToolRunner = taskLib.tool('tar');
        tr.arg(['xzC', destinationFolder, '-f', file]);
        tr.exec();
    }

    private extractFiles(file: string, fileEnding: string) {
        const stats = taskLib.stats(file);
        if (!stats) {
            throw new Error(taskLib.loc('ExtractNonExistFile', file));
        } else if (stats.isDirectory()) {
            throw new Error(taskLib.loc('ExtractDirFailed', file));
        }

        if (this.win) {
            if ('.tar' === fileEnding) { // a simple tar
                this.sevenZipExtract(file, this.destinationFolder);
            } else if ('.tar.gz' === fileEnding) { // a compressed tar, e.g. 'fullFilePath/test.tar.gz'
                // e.g. 'fullFilePath/test.tar.gz' --> 'test.tar.gz'
                const shortFileName = file.substring(file.lastIndexOf(path.sep) + 1, file.length);
                // e.g. 'destinationFolder/_test.tar.gz_'
                const tempFolder = path.normalize(this.destinationFolder + path.sep + '_' + shortFileName + '_');
                console.log(taskLib.loc('CreateTempDir', tempFolder, file));

                // 0 create temp folder
                taskLib.mkdirP(tempFolder);

                // 1 extract compressed tar
                this.sevenZipExtract(file, tempFolder);
                console.log(taskLib.loc('TempDir', tempFolder));
                const tempTar = tempFolder + path.sep + taskLib.ls('-A', [tempFolder])[0]; // should be only one
                console.log(taskLib.loc('DecompressedTempTar', file, tempTar));
                    
                // 2 expand extracted tar
                this.sevenZipExtract(tempTar, this.destinationFolder);

                // 3 cleanup temp folder
                console.log(taskLib.loc('RemoveTempDir', tempFolder));
                taskLib.rmRF(tempFolder);
            } else if ('.zip' === fileEnding) {
                this.unzipExtract(file, this.destinationFolder);
            } else { // use sevenZip
                this.sevenZipExtract(file, this.destinationFolder);
            }
        } else { // not windows
            if ('.tar' === fileEnding || '.tar.gz' === fileEnding) {
                this.tarExtract(file, this.destinationFolder);
            } else if ('.zip' === fileEnding) {
                this.unzipExtract(file, this.destinationFolder);
            } else { // fall through and use sevenZip
                this.sevenZipExtract(file, this.destinationFolder);
            }
        }
    }

    // This method recursively finds all .pack files under fsPath and unpacks them with the unpack200 tool
    private unpackJars(fsPath, javaBinPath) {
        if (fs.existsSync(fsPath)) {
            if (fs.lstatSync(fsPath).isDirectory()) {
                let self = this;
                fs.readdirSync(fsPath).forEach(function(file,index){
                    const curPath = path.join(fsPath, file);
                    self.unpackJars(curPath, javaBinPath);
                });
            } else if (path.extname(fsPath).toLowerCase() === '.pack') {
                // Unpack the pack file synchonously
                const p = path.parse(fsPath);
                const toolName = process.platform.match(/^win/i) ? 'unpack200.exe' : 'unpack200'; 
                const args = process.platform.match(/^win/i) ? '-r -v -l ""' : '';            
                const name = path.join(p.dir, p.name);
                taskLib.execSync(path.join(javaBinPath, toolName), `${args} "${name}.pack" "${name}.jar"`); 
            }
        }    
    }

    public unzipJavaDownload(repoRoot: string, fileEnding: string, extractLocation: string): string {
        this.destinationFolder = extractLocation;
        let initialDirectoriesList: string[];
        let finalDirectoriesList: string[];
        let jdkDirectory: string;

        // Create the destination folder if it doesn't exist
        if (!taskLib.exist(this.destinationFolder)) {
            console.log(taskLib.loc('CreateDestDir', this.destinationFolder));
            taskLib.mkdirP(this.destinationFolder);
        }

        initialDirectoriesList = taskLib.find(this.destinationFolder).filter(x => taskLib.stats(x).isDirectory());

        const jdkFile = path.normalize(repoRoot);
        const stats = taskLib.stats(jdkFile);
        if (stats.isFile()) {
            this.extractFiles(jdkFile, fileEnding);
            finalDirectoriesList = taskLib.find(this.destinationFolder).filter(x => taskLib.stats(x).isDirectory());
            taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));
            jdkDirectory = finalDirectoriesList.filter(dir => initialDirectoriesList.indexOf(dir) < 0)[0];
            this.unpackJars(jdkDirectory, path.join(jdkDirectory, 'bin'));
            return jdkDirectory;
        }
    }

}
