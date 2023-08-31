import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';

const supportedFileEndings: string[] = ['.tar', '.tar.gz', '.zip', '.7z', '.dmg', '.pkg'];

export const BIN_FOLDER: string = 'bin';

interface IDirectoriesDictionary {
    [key: string]: null
}

export class JavaFilesExtractor {
    private readonly ERR_SHARE_ACCESS = -4094;
    public destinationFolder: string;
    public readonly win: boolean;

    // 7zip
    public xpSevenZipLocation: string;
    public winSevenZipLocation: string = path.join(__dirname, '7zip/7z.exe');

    constructor() {
        this.win = (os.platform() === 'win32');
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

    private static isTar(file: string): boolean {
        const name: string = file.toLowerCase();
        // standard gnu-tar extension formats with recognized auto compression formats
        // https://www.gnu.org/software/tar/manual/html_section/tar_69.html
        return name.endsWith('.tar')      // no compression
            || name.endsWith('.tar.gz')   // gzip
            || name.endsWith('.tgz')      // gzip
            || name.endsWith('.taz')      // gzip
            || name.endsWith('.tar.z')    // compress
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

    private sevenZipExtract(file: string, destinationFolder: string) {
        //We have to create our own 7Zip extract function as the vsts-task-tool-lib
        //method uses 7zDec, which only decodes .7z archives
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

    /**
     * Get file ending if it is supported. Otherwise throw an error.
     * Find file ending, not extension. For example, there is supported .tar.gz file ending but the extension is .gz.
     * @param file Path to a file.
     * @returns string
     */
    public static getSupportedFileEnding(file: string): string {
        const fileEnding: string = supportedFileEndings.find(ending => file.endsWith(ending)); 
        
        if (fileEnding) {
            return fileEnding;
        } else {
            throw new Error(taskLib.loc('UnsupportedFileExtension'));
        }
    }

    private async extractFiles(file: string, fileEnding: string): Promise<void> {
        const stats = taskLib.stats(file);
        if (!stats) {
            throw new Error(taskLib.loc('ExtractNonExistFile', file));
        } else if (stats.isDirectory()) {
            throw new Error(taskLib.loc('ExtractDirFailed', file));
        }

        if (this.win) {
            if ('.tar' === fileEnding) { // a simple tar
                this.sevenZipExtract(file, this.destinationFolder);
            } else if (JavaFilesExtractor.isTar(file)) { // a compressed tar, e.g. 'fullFilePath/test.tar.gz'
                // e.g. 'fullFilePath/test.tar.gz' --> 'test.tar.gz'
                const shortFileName = path.basename(file);
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
            } else { // use sevenZip
                this.sevenZipExtract(file, this.destinationFolder);
            }
        } else { // not windows
            if ('.tar' === fileEnding || '.tar.gz' === fileEnding) {
                await toolLib.extractTar(file, this.destinationFolder);
            } else if ('.zip' === fileEnding) {
                await toolLib.extractZip(file, this.destinationFolder);
            } else { // fall through and use sevenZip
                this.sevenZipExtract(file, this.destinationFolder);
            }
        }
    }

    // This method recursively finds all .pack files under fsPath and unpacks them with the unpack200 tool
    public static unpackJars(fsPath: string, javaBinPath: string): void {
        if (fs.existsSync(fsPath)) {
            if (fs.lstatSync(fsPath).isDirectory()) {
                fs.readdirSync(fsPath).forEach(function(file){
                    const curPath = path.join(fsPath, file);
                    JavaFilesExtractor.unpackJars(curPath, javaBinPath);
                });
            } else if (path.extname(fsPath).toLowerCase() === '.pack') {
                // Unpack the pack file synchronously
                const p = path.parse(fsPath);
                const toolName = process.platform.match(/^win/i) ? 'unpack200.exe' : 'unpack200'; 
                const args = process.platform.match(/^win/i) ? '-r -v -l ""' : '';
                const name = path.join(p.dir, p.name);
                taskLib.execSync(path.join(javaBinPath, toolName), `${args} "${name}.pack" "${name}.jar"`); 
            }
        }    
    }

    /**
     * Creates a list of directories on the root level of structure.
     * @param pathsArray - contains paths to all the files inside the structure
     * @param root - path to the directory we want to get the structure of
     */
    public static sliceStructure(pathsArray: Array<string>, root: string = pathsArray[0]): Array<string>{
        const dirPathLength = root.length;
        const structureObject: IDirectoriesDictionary = {};
        for(let i = 0; i < pathsArray.length; i++){
            const pathStr = pathsArray[i];
            const cleanPathStr = pathStr.slice(dirPathLength + 1);
            if (cleanPathStr === '') {
                continue;
            }
            const dirPathArray = cleanPathStr.split(path.sep);
            // Create the list of unique values
            structureObject[dirPathArray[0]] = null;
        }
        return Object.keys(structureObject);
    }

    /**
     * Returns name w/o file ending
     * @param name - name of the file
     */
    public static getStrippedName(name: string): string {
        const fileBaseName: string = path.basename(name);
        const fileEnding: string = JavaFilesExtractor.getSupportedFileEnding(fileBaseName);
        return fileBaseName.substring(0, fileBaseName.length - fileEnding.length);
    }

    /**
     * Returns path to JAVA_HOME, or throw exception if the extracted archive isn't valid
     * @param pathToStructure - path to files extracted from the JDK archive
     */
    public static getJavaHomeFromStructure(pathToStructure): string {
        const structure: Array<string> = taskLib.find(pathToStructure);
        const rootItemsArray: Array<string> = JavaFilesExtractor.sliceStructure(structure);
        const rootDirectoriesArray: Array<string> = new Array<string>();
        // it is allowed to have extra files in extraction directory, but we shouldn't have more than 1 directory here
        rootItemsArray.forEach(rootItem => {
            if (fs.lstatSync(path.join(pathToStructure, rootItem)).isDirectory()) {
                rootDirectoriesArray.push(rootItem);
            }
        });
        if(rootDirectoriesArray.length == 0) {
            throw new Error(taskLib.loc('WrongArchiveFile'));
        }
        let jdkDirectory: string;
        if (rootDirectoriesArray.find(dir => dir === BIN_FOLDER)){
            jdkDirectory = pathToStructure;
        } else {
            jdkDirectory = path.join(pathToStructure, rootDirectoriesArray[0]);
            const ifBinExistsInside: boolean = fs.existsSync(path.join(jdkDirectory, BIN_FOLDER));
            if (rootDirectoriesArray.length > 1 || !ifBinExistsInside){
                throw new Error(taskLib.loc('WrongArchiveStructure'));
            }
        }
        return jdkDirectory;
    }

    /**
     * Validate files structure if it can be a JDK, then set JAVA_HOME and returns it.
     * @param pathToExtractedJDK - path to files extracted from the JDK archive
     * @param withValidation - validate files and search bin inside
     */
    public static setJavaHome(pathToExtractedJDK: string, withValidation: boolean = true): string {
        let jdkDirectory: string = withValidation ?
            JavaFilesExtractor.getJavaHomeFromStructure(pathToExtractedJDK) :
            pathToExtractedJDK;
        console.log(taskLib.loc('SetJavaHome', jdkDirectory));
        taskLib.setVariable('JAVA_HOME', jdkDirectory);
        return jdkDirectory;
    }

    public async unzipJavaDownload(repoRoot: string, fileEnding: string, extractLocation: string): Promise<string> {
        this.destinationFolder = extractLocation;

        // Create the destination folder if it doesn't exist
        if (!taskLib.exist(this.destinationFolder)) {
            console.log(taskLib.loc('CreateDestDir', this.destinationFolder));
            taskLib.mkdirP(this.destinationFolder);
        }

        const jdkFile = path.normalize(repoRoot);
        let stats: taskLib.FsStats;
        try {
            stats = taskLib.stats(jdkFile);
        } catch (error) {
            if (error.errno === this.ERR_SHARE_ACCESS) {
                throw new Error(taskLib.loc('ShareAccessError', error.path));
            }
            throw(error);
        }
        if (stats.isFile()) {
            await this.extractFiles(jdkFile, fileEnding);
        }
        const jdkDirectory: string = JavaFilesExtractor.getJavaHomeFromStructure(this.destinationFolder);
        JavaFilesExtractor.unpackJars(jdkDirectory, path.join(jdkDirectory, BIN_FOLDER));
        return jdkDirectory;
    }
}
