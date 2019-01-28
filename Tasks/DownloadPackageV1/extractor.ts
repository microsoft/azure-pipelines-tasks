import * as os from "os";
import * as taskLib from "vsts-task-lib/task";
import * as toolLib from "vsts-task-tool-lib/tool";
import * as path from "path";

export class Extractor {
    public readonly win: boolean;

    // 7zip
    public xpSevenZipLocation: string;
    public winSevenZipLocation: string = path.join(__dirname, "7zip/7z.exe");
    private zipLocation: string;
    private unzipLocation: string;
    constructor(zipLocation: string, unzipLocation: string) {
        this.zipLocation = zipLocation;
        this.unzipLocation = unzipLocation;
        this.win = os.platform() === "win32";
        taskLib.debug("win: " + this.win);
    }

    private getSevenZipLocation(): string {
        if (this.win) {
            return this.winSevenZipLocation;
        } else {
            if (typeof this.xpSevenZipLocation === "undefined") {
                this.xpSevenZipLocation = taskLib.which("7z", true);
            }
            return this.xpSevenZipLocation;
        }
    }

    private isTar(file): boolean {
        const name = file.toLowerCase();
        // standard gnu-tar extension formats with recognized auto compression formats
        // https://www.gnu.org/software/tar/manual/html_section/tar_69.html
        return (
            name.endsWith(".tar") || // no compression
            name.endsWith(".tar.gz") || // gzip
            name.endsWith(".tgz") || // gzip
            name.endsWith(".taz") || // gzip
            name.endsWith(".tar.z") || // compress
            name.endsWith(".tar.bz2") || // bzip2
            name.endsWith(".tz2") || // bzip2
            name.endsWith(".tbz2") || // bzip2
            name.endsWith(".tbz") || // bzip2
            name.endsWith(".tar.lz") || // lzip
            name.endsWith(".tar.lzma") || // lzma
            name.endsWith(".tlz") || // lzma
            name.endsWith(".tar.lzo") || // lzop
            name.endsWith(".tar.xz") || // xz
            name.endsWith(".txz")
        ); // xz
    }

    private sevenZipExtract(file: string, destinationFolder: string) {
        //We have to create our own 7Zip extract function as the vsts-task-tool-lib
        //method uses 7zDec, which only decodes .7z archives
        console.log(taskLib.loc("SevenZipExtractFile", file));
        const sevenZip = taskLib.tool(this.getSevenZipLocation());
        sevenZip.arg("x");

        sevenZip.arg("-o" + destinationFolder);
        sevenZip.arg(file);
        const execResult = sevenZip.execSync();
        if (execResult.code != taskLib.TaskResult.Succeeded) {
            taskLib.debug("execResult: " + JSON.stringify(execResult));
        }
    }

    async extractFile(): Promise<void> {
        const stats = await taskLib.stats(this.zipLocation);
        console.log("hello " + stats);

        const fileEnding = path.parse(this.zipLocation).ext;

        if (!stats) {
            throw new Error(taskLib.loc("ExtractNonExistFile", this.zipLocation));
        } else if (stats.isDirectory()) {
            throw new Error(taskLib.loc("ExtractDirFailed", this.zipLocation));
        }

        if (this.win) {
            if (".tar" === fileEnding) {
                // a simple tar
                return this.sevenZipExtract(this.zipLocation, this.unzipLocation);
            } else if (this.isTar(this.zipLocation)) {
                // a compressed tar, e.g. 'fullFilePath/test.tar.gz'
                // e.g. 'fullFilePath/test.tar.gz' --> 'test.tar.gz'
                const shortFileName = path.basename(this.zipLocation);
                // e.g. 'destinationFolder/_test.tar.gz_'
                const tempFolder = path.normalize(this.unzipLocation + path.sep + "_" + shortFileName + "_");
                console.log(taskLib.loc("CreateTempDir", tempFolder, this.zipLocation));

                // 0 create temp folder
                taskLib.mkdirP(tempFolder);
                console.log("Temp folder is " + tempFolder);
                console.log(taskLib.stats(tempFolder));
                // 1 extract compressed tar
                this.sevenZipExtract(this.zipLocation, tempFolder);

                console.log(taskLib.loc("TempDir", tempFolder));
                const tempTar = tempFolder + path.sep + taskLib.ls("-A", [tempFolder])[0]; // should be only one
                console.log(taskLib.loc("DecompressedTempTar", this.zipLocation, tempTar));

                // 2 expand extracted tar
                this.sevenZipExtract(tempTar, this.unzipLocation);

                // 3 cleanup temp folder
                console.log(taskLib.loc("RemoveTempDir", tempFolder));
                taskLib.rmRF(tempFolder);
            } else {
                // use sevenZip
                this.sevenZipExtract(this.zipLocation, this.unzipLocation);
            }
        } else {
            // not windows
            if (".tar" === fileEnding || ".tar.gz" === fileEnding) {
                await toolLib.extractTar(this.zipLocation);
            } else if (".zip" === fileEnding) {
                await toolLib.extractZip(this.zipLocation);
            } else {
                // fall through and use sevenZip
                this.sevenZipExtract(this.zipLocation, this.unzipLocation);
            }
        }
    }
}
