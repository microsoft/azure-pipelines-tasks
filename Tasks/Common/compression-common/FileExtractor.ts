import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';

enum CompressedFile {
    Tar,
    Tarball,
    Zip,
    SevenZip
}

function compressedFileType(file: string): CompressedFile {
    if (file.endsWith('.tar')) {
        return CompressedFile.Tar;
    } else if (file.endsWith('.tar.gz') || file.endsWith('.tgz')) {
        return CompressedFile.Tarball;
    } else if (file.endsWith('.zip')) {
        return CompressedFile.Zip;
    } else if (file.endsWith('.7z')) {
        CompressedFile.SevenZip;
    } else {
        throw new Error(tl.loc('UnsupportedFileExtension'));
    }
}

type Extractor = (file: string, destination: string) => Promise<void>;

export class FileExtractor {
    private isWindows: boolean;

    constructor() {
        this.isWindows = os.type() === 'Windows_NT';
        tl.debug('isWindows: ' + this.isWindows);
    }

    /** Extract a zip file with the 'unzip' utility. */
    private async unzipExtract(file: string, destination: string): Promise<void> {
        console.log(tl.loc('UnzipExtractFile', file));

        const unzip: tr.ToolRunner = tl.tool('unzip');
        unzip.arg(file);
        await unzip.exec(<tr.IExecOptions>{ cwd: destination });
    }

    /** Extract a zip file using PowerShell. */
    private async powershellExtract(file: string, destination: string): Promise<void> {
        console.log(tl.loc('UnzipExtractFile', file));

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

        // change the console output code page to UTF-8
        const chcpPath = path.join(process.env.windir, "system32", "chcp.com");
        await tl.exec(chcpPath, '65001');

        // run powershell
        const powershell: tr.ToolRunner = tl.tool('powershell')
            .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
            .arg(command);
        await powershell.exec();
    }

    /** Extract a file using 7zip. */
    private async sevenZipExtract(file: string, destination: string): Promise<void> {
        console.log(tl.loc('SevenZipExtractFile', file));

        const sevenZipLocation = this.isWindows ? path.join(__dirname, '7zip/7z.exe') : tl.which('7z', true);
        const sevenZip = tl.tool(sevenZipLocation);

        sevenZip.arg('x');
        sevenZip.arg('-o' + destination);
        sevenZip.arg(file);

        const execResult = sevenZip.execSync();
        if (execResult.code !== tl.TaskResult.Succeeded) {
            tl.debug('execResult: ' + JSON.stringify(execResult));
        }
    }

    /* Extract a compressed tar archive using the 'tar' utiltity. */
    private async tarExtract(file: string, destination: string): Promise<void> {
        console.log(tl.loc('TarExtractFile', file));
        const tr: tr.ToolRunner = tl.tool('tar');
        tr.arg(['xzC', destination, '-f', file]);
        tr.exec();
    }

    /** Choose an extractor function based on the file type and agent's operating system. */
    private pickExtractor(fileType: CompressedFile): Extractor {
        if (this.isWindows) {
            switch (fileType) {
                case CompressedFile.Tar:
                case CompressedFile.SevenZip:
                    return this.sevenZipExtract;
                case CompressedFile.Tarball:
                    return async (file: string, destination: string) => {
                        // e.g. 'fullFilePath/test.tar.gz' --> 'test.tar.gz'
                        const shortFileName = file.substring(file.lastIndexOf(path.sep) + 1, file.length);
                        // e.g. 'destination/_test.tar.gz_'
                        const tempFolder = path.normalize(path.join(destination, `_${shortFileName}_`));
                        console.log(tl.loc('CreateTempDir', tempFolder, file));

                        // create temp folder
                        tl.mkdirP(tempFolder);

                        // extract compressed tar
                        await this.sevenZipExtract(file, tempFolder);
                        console.log(tl.loc('TempDir', tempFolder));
                        const tempTar = path.join(tempFolder, tl.ls('-A', [tempFolder])[0]); // should be only one
                        console.log(tl.loc('DecompressedTempTar', file, tempTar));

                        // expand extracted tar
                        await this.sevenZipExtract(tempTar, destination);

                        // clean up temp folder
                        console.log(tl.loc('RemoveTempDir', tempFolder));
                        tl.rmRF(tempFolder);
                    };
                case CompressedFile.Zip:
                    return this.powershellExtract;
                default:
                    throw new Error(tl.loc('UnsupportedFileExtension'));
            }
        } else { // not Windows
            switch (fileType) {
                case CompressedFile.Tar:
                case CompressedFile.Tarball:
                    return this.tarExtract;
                case CompressedFile.Zip:
                    return this.unzipExtract;
                case CompressedFile.SevenZip:
                    return this.sevenZipExtract;
                default:
                    throw new Error(tl.loc('UnsupportedFileExtension'));
            }
        }
    }

    /**
     * Decompress `compressedFile` to `destination`.
     * This method will choose an appropriate decompression tool based on the file type and host OS.
     */
    public async extractCompressedFile(compressedFile: string, destination: string): Promise<string> {
        compressedFile = path.normalize(compressedFile);

        if (!fs.existsSync(compressedFile)) {
            throw new Error(tl.loc('ExtractNonExistFile', compressedFile));
        } else if (!fs.statSync(compressedFile).isFile()) {
            throw new Error(tl.loc('ExtractNonFileFailed', compressedFile));
        }

        // Create the destination folder if it doesn't exist
        if (!fs.existsSync(destination)) {
            console.log(tl.loc('CreateDestDir', destination));
            tl.mkdirP(destination);
        }

        // Take a snapshot of the directories we have right now
        // TODO have `Extractor` return `Promise<string>` with the directory containing the extracted files
        const initialDirectoriesList = tl.find(destination).filter(x => fs.statSync(x).isDirectory());
        tl.debug(`initial directories list: ${initialDirectoriesList}`);

        const fileType = compressedFileType(compressedFile);
        const extractor = this.pickExtractor(fileType);
        await extractor(compressedFile, destination);

        const finalDirectoriesList = tl.find(destination).filter(x => fs.statSync(x).isDirectory());
        tl.debug(`final directories list: ${finalDirectoriesList}`);

        // Find the first one that wasn't there to begin with
        return finalDirectoriesList.filter(x => initialDirectoriesList.indexOf(x) < 0)[0];
    }
}
