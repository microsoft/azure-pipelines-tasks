import * as path from 'path';
import * as fs from "fs";

import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';

import * as utils from "./versionUtilities";
import { VersionInfo } from './versionFetcher';

export class VersionInstaller {
    constructor(packageType: string, installationPath: string) {
        try {
            tl.exist(installationPath) || tl.mkdirP(installationPath);
        }
        catch (ex) {
            throw tl.loc("UnableToAccessPath", installationPath, ex);
        }

        this.packageType = packageType;
        this.installationPath = installationPath;
    }

    public async downloadAndInstall(versionInfo: VersionInfo, downloadUrl: string): Promise<void> {
        let downloadPath = "";
        let version = versionInfo.version;

        try {
            downloadPath = await toolLib.downloadTool(downloadUrl);
        } catch (error) {
            throw tl.loc("CouldNotDownload", downloadUrl, JSON.stringify(error));
        }

        try {
            //todo: if installation path is outside agents directory, acquire Lock for installation and start timer of 10-20 minutes, after which lock shall be auto released.

            //todo when lock work is done: Check if already installed
            // this.isVersionInstalled(version);

            // Extract
            console.log(tl.loc("ExtractingPackage", downloadPath));
            let extPath: string = tl.osType().match(/^Win/) ? await toolLib.extractZip(downloadPath) : await toolLib.extractTar(downloadPath);

            // Copy folders
            tl.debug(tl.loc("CopyingFoldersIntoPath", this.installationPath));
            var allEnteriesInDir: string[] = tl.ls("", [extPath]).map(name => path.join(extPath, name));
            var directoriesTobeCopied: string[] = allEnteriesInDir.filter(path => fs.lstatSync(path).isDirectory());
            directoriesTobeCopied.forEach((directoryPath) => {
                tl.cp(directoryPath, this.installationPath, "-rf", false);
            });

            // Copy files
            try {
                if (this.isLatestInstalledVersion(version)) {
                    tl.debug(tl.loc("CopyingFilesIntoPath", this.installationPath));
                    var filesToBeCopied = allEnteriesInDir.filter(path => !fs.lstatSync(path).isDirectory());
                    filesToBeCopied.forEach((filePath) => {
                        tl.cp(filePath, this.installationPath, "-f", false);
                    });
                }
            }
            catch (ex) {
                tl.warning(tl.loc("FailedToCopyTopLevelFiles", ex));
            }

            // Cache tool
            this.createInstallationCompleteFile(versionInfo);

            console.log(tl.loc("SuccessfullyInstalled", this.packageType, version));
        }
        catch (ex) {
            throw tl.loc("FailedWhileInstallingVersionAtPath", version, this.installationPath, ex);
        }
        finally {
            //todo: Release Lock and stop timer
        }

        //todo: in case of failure due to: unable to acquire lock or timeout, 3 retries to install.
    }

    public isVersionInstalled(version: string): boolean {
        if (!toolLib.isExplicitVersion(version)) {
            throw tl.loc("VersionNotAllowed", version);
        }

        var isInstalled: boolean = false;
        if (this.packageType == "sdk") {
            isInstalled = tl.exist(path.join(this.installationPath, "sdk", version)) && tl.exist(path.join(this.installationPath, "sdk", `${version}.complete`));
        }
        else {
            isInstalled = tl.exist(path.join(this.installationPath, "shared", "Microsoft.NETCore.App", version)) && tl.exist(path.join(this.installationPath, "shared", "Microsoft.NETCore.App", `${version}.complete`));
        }

        isInstalled ? console.log(tl.loc("VersionFoundInToolCache")) : console.log(tl.loc("VersionNotFoundInToolCache", version));
        return isInstalled;
    }

    private createInstallationCompleteFile(versionInfo: VersionInfo): void {
        tl.debug(tl.loc("CreatingInstallationCompeleteFile", versionInfo.version, this.packageType));
        // always add for runtime as it is installed with SDK as well.
        var pathToVersionCompleteFile: string = "";
        if (this.packageType == "sdk") {
            let sdkVersion = versionInfo.version;
            pathToVersionCompleteFile = path.join(this.installationPath, "sdk");
            tl.writeFile(path.join(pathToVersionCompleteFile, `${sdkVersion}.complete`), `{ "version": "${sdkVersion}" }`);
        }

        let runtimeVersion = VersionInfo.getRuntimeVersion(versionInfo, this.packageType);
        if (runtimeVersion) {
            pathToVersionCompleteFile = path.join(this.installationPath, "shared", "Microsoft.NETCore.App");
            tl.writeFile(path.join(pathToVersionCompleteFile, `${runtimeVersion}.complete`), `{ "version": "${runtimeVersion}" }`);
        }
        else if (this.packageType == "runtime") {
            throw tl.loc("CannotFindRuntimeVersionForCompletingInstllation", versionInfo.version, this.packageType);
        }
    }

    private isLatestInstalledVersion(version: string): boolean {
        var pathTobeChecked = this.packageType == "sdk" ? path.join(this.installationPath, "sdk") : path.join(this.installationPath, "shared", "Microsoft.NETCore.App");
        if (!tl.exist(pathTobeChecked)) {
            throw tl.loc("PathNotFoundException", pathTobeChecked);
        }

        var allEnteries: string[] = tl.ls("", [pathTobeChecked]).map(name => path.join(pathTobeChecked, name));
        var folderPaths: string[] = allEnteries.filter(element => fs.lstatSync(element).isDirectory());
        var isLatest: boolean = folderPaths.findIndex(folderPath => {
            try {
                return utils.versionCompareFunction(path.basename(folderPath), version) > 0;
            }
            catch (ex) {
                // no op, folder name might not be in version format
            }
        }) < 0;

        var filePaths: string[] = allEnteries.filter(element => !fs.lstatSync(element).isDirectory());
        isLatest = isLatest && filePaths.findIndex(filePath => {
            try {
                return utils.versionCompareFunction(this.getVersionCompleteFileName(path.basename(filePath)), version) > 0
            }
            catch (ex) {
                // no op, file name might not be in version format
            }
        }) < 0;

        isLatest ? tl.debug(tl.loc("VersionIsLocalLatest")) : tl.debug(tl.loc("VersionIsNotLocalLatest"));
        return isLatest;
    }

    private getVersionCompleteFileName(name: string): string {
        var parts = name.split('.');
        var fileNameWithoutExtensionLength = name.length - (parts[parts.length - 1].length + 1);
        if (fileNameWithoutExtensionLength > 0) {
            return name.substr(0, fileNameWithoutExtensionLength);
        }

        throw "Not correct Complete marker file name: " + name;
    }

    private packageType: string;
    private installationPath: string;
}