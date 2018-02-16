import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as taskLib from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';

type Extractor = (file: string, destination: string) => Promise<void>;

export class FileExtractor {
    private isWindows: boolean;

    constructor() {
        this.isWindows = os.type() === 'Windows_NT';
        taskLib.debug('isWindows: ' + this.isWindows);
    }

    /** Extract a zip file with the 'unzip' utility. */
    private async unzipExtract(file: string, destination: string): Promise<void> {
        console.log(taskLib.loc('UnzipExtractFile', file));

        const unzip: tr.ToolRunner = taskLib.tool('unzip');
        unzip.arg(file);
        await unzip.exec(<tr.IExecOptions>{ cwd: destination });
    }

    /** Extract a zip file using PowerShell. */
    private async powershellExtract(file: string, destination: string): Promise<void> {
        console.log(taskLib.loc('UnzipExtractFile', file));

        // build the powershell command
        const escapedFile = file.replace(/'/g, "''").replace(/"|\n|\r/g, ''); // double-up single quotes, remove double quotes and newlines
        const escapedDest = destination.replace(/'/g, "''").replace(/"|\n|\r/g, '');
        const command = `
            $ErrorActionPreference = 'Stop';
            try
            {
                Add-Type -AssemblyName System.IO.Compression.FileSystem
            }
            catch { };
            [System.IO.Compression.ZipFile]::ExtractToDirectory('${escapedFile}', '${escapedDest}')`;

        // change the console output code page to UTF-8.
        const chcpPath = path.join(process.env.windir, "system32", "chcp.com");
        await taskLib.exec(chcpPath, '65001');

        // run powershell
        const powershell: tr.ToolRunner = taskLib.tool('powershell')
            .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
            .arg(command);
        await powershell.exec();
    }

    private async sevenZipExtract(file: string, destination: string): Promise<void> {
        console.log(taskLib.loc('SevenZipExtractFile', file));

        const sevenZipLocation = this.isWindows ? path.join(__dirname, '7zip/7z.exe') : taskLib.which('7z', true);
        const sevenZip = taskLib.tool(sevenZipLocation);

        sevenZip.arg('x');
        sevenZip.arg('-o' + destination);
        sevenZip.arg(file);

        const execResult = sevenZip.execSync();
        if (execResult.code !== taskLib.TaskResult.Succeeded) {
            taskLib.debug('execResult: ' + JSON.stringify(execResult));
        }
    }

    /* Extract a compressed tar archive using the 'tar' utiltity. */
    private async tarExtract(file: string, destination: string): Promise<void> {
        console.log(taskLib.loc('TarExtractFile', file));
        const tr: tr.ToolRunner = taskLib.tool('tar');
        tr.arg(['xzC', destination, '-f', file]);
        tr.exec();
    }

    /** Choose an extractor function based on the file type and agent's operating system. */
    private pickExtractor(file: string, fileEnding: string, destination: string): Extractor {
        const stats = taskLib.stats(file);
        if (!stats) {
            throw new Error(taskLib.loc('ExtractNonExistFile', file));
        } else if (stats.isDirectory()) {
            throw new Error(taskLib.loc('ExtractDirFailed', file));
        }

        if (this.isWindows) {
            switch (fileEnding) {
                case '.tar':
                case '.7z':
                    return this.sevenZipExtract;
                case '.tar.gz':
                case '.tgz':
                    return async (file: string, destination: string) => {
                        // e.g. 'fullFilePath/test.tar.gz' --> 'test.tar.gz'
                        const shortFileName = file.substring(file.lastIndexOf(path.sep) + 1, file.length);
                        // e.g. 'destination/_test.tar.gz_'
                        const tempFolder = path.normalize(destination + path.sep + '_' + shortFileName + '_');
                        console.log(taskLib.loc('CreateTempDir', tempFolder, file));

                        // create temp folder
                        taskLib.mkdirP(tempFolder);

                        // extract compressed tar
                        await this.sevenZipExtract(file, tempFolder);
                        console.log(taskLib.loc('TempDir', tempFolder));
                        const tempTar = tempFolder + path.sep + taskLib.ls('-A', [tempFolder])[0]; // should be only one TODO
                        console.log(taskLib.loc('DecompressedTempTar', file, tempTar));

                        // expand extracted tar
                        await this.sevenZipExtract(tempTar, destination);

                        // clean up temp folder
                        console.log(taskLib.loc('RemoveTempDir', tempFolder));
                        taskLib.rmRF(tempFolder);
                    };
                case '.zip':
                    return this.powershellExtract;
                default:
                    throw new Error(taskLib.loc('UnrecognizedCompressedFileType', fileEnding)); // TODO
            }
        } else { // not Windows
            switch (fileEnding) {
                case '.tar':
                case '.tar.gz':
                case '.tgz':
                    return this.tarExtract;
                case '.zip':
                    return this.unzipExtract;
                case '.7z':
                    return this.sevenZipExtract;
                default:
                    throw new Error(taskLib.loc('UnsupportedFileExtension'));
            }
        }
    }

    public async extractCompressedFile(compressedFile: string, fileEnding: string, destination: string): Promise<string> {
        compressedFile = path.normalize(compressedFile);

        // Create the destination folder if it doesn't exist
        if (!taskLib.exist(destination)) {
            console.log(taskLib.loc('CreateDestDir', destination));
            taskLib.mkdirP(destination);
        }

        if (taskLib.stats(compressedFile).isFile()) {
            const extractor = this.pickExtractor(compressedFile, fileEnding, destination);
            await extractor(compressedFile, destination);

            const finalDirectoriesList = taskLib.find(destination).filter(x => taskLib.stats(x).isDirectory());
            taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg'));

            // Find the first one that wasn't there to begin with
            const initialDirectoriesList = taskLib.find(destination).filter(x => taskLib.stats(x).isDirectory());
            return finalDirectoriesList.filter(x => initialDirectoriesList.indexOf(x) < 0)[0];
        }
    }
}
