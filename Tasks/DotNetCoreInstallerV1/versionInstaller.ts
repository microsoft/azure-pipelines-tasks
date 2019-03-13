import * as path from 'path';
import * as fs from "fs";
import * as url from "url";

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
            throw tl.loc("UnableToAccessPath", installationPath, JSON.stringify(ex));
        }

        this.packageType = packageType;
        this.installationPath = installationPath;
    }

    public async downloadAndInstall(versionInfo: VersionInfo, downloadUrl: string): Promise<void> {
        if (!versionInfo || !versionInfo.version || !url.parse(downloadUrl)) {
            throw tl.loc("VersionCanNotBeDownloadedFromUrl", versionInfo, downloadUrl);
        }

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
            var allRootLevelEnteriesInDir: string[] = tl.ls("", [extPath]).map(name => path.join(extPath, name));
            var directoriesTobeCopied: string[] = allRootLevelEnteriesInDir.filter(path => fs.lstatSync(path).isDirectory());
            directoriesTobeCopied.forEach((directoryPath) => {
                tl.cp(directoryPath, this.installationPath, "-rf", false);
            });

            // Copy files
            try {
                if (this.isLatestInstalledVersion(version)) {
                    tl.debug(tl.loc("CopyingFilesIntoPath", this.installationPath));
                    var filesToBeCopied = allRootLevelEnteriesInDir.filter(path => !fs.lstatSync(path).isDirectory());
                    filesToBeCopied.forEach((filePath) => {
                        tl.cp(filePath, this.installationPath, "-f", false);
                    });
                }
            }
            catch (ex) {
                tl.warning(tl.loc("FailedToCopyTopLevelFiles", this.installationPath, JSON.stringify(ex)));
            }

            // Cache tool
            this.createInstallationCompleteFile(versionInfo);

            console.log(tl.loc("SuccessfullyInstalled", this.packageType, version));
        }
        catch (ex) {
            throw tl.loc("FailedWhileInstallingVersionAtPath", version, this.installationPath, JSON.stringify(ex));
        }
        finally {
            //todo: Release Lock and stop timer
        }

        //todo: in case of failure due to: unable to acquire lock or timeout, 3 retries to install.
    }

    public isVersionInstalled(version: string): boolean {
        if (!toolLib.isExplicitVersion(version)) {
            throw tl.loc("ExplicitVersionRequired", version);
        }

        var isInstalled: boolean = false;
        if (this.packageType == utils.Constants.sdk) {
            isInstalled = tl.exist(path.join(this.installationPath, utils.Constants.relativeSdkPath, version)) && tl.exist(path.join(this.installationPath, utils.Constants.relativeSdkPath, `${version}.complete`));
        }
        else {
            isInstalled = tl.exist(path.join(this.installationPath, utils.Constants.relativeRuntimePath, version)) && tl.exist(path.join(this.installationPath, utils.Constants.relativeRuntimePath, `${version}.complete`));
        }

        isInstalled ? console.log(tl.loc("VersionFoundInCache", version)) : console.log(tl.loc("VersionNotFoundInCache", version));
        return isInstalled;
    }

    private createInstallationCompleteFile(versionInfo: VersionInfo): void {
        tl.debug(tl.loc("CreatingInstallationCompeleteFile", versionInfo.version, this.packageType));
        // always add for runtime as it is installed with sdk as well.
        var pathToVersionCompleteFile: string = "";
        if (this.packageType == utils.Constants.sdk) {
            let sdkVersion = versionInfo.version;
            pathToVersionCompleteFile = path.join(this.installationPath, utils.Constants.relativeSdkPath, `${sdkVersion}.complete`);
            tl.writeFile(pathToVersionCompleteFile, `{ "version": "${sdkVersion}" }`);
        }

        let runtimeVersion = VersionInfo.getRuntimeVersion(versionInfo, this.packageType);
        if (runtimeVersion) {
            pathToVersionCompleteFile = path.join(this.installationPath, utils.Constants.relativeRuntimePath, `${runtimeVersion}.complete`);
            tl.writeFile(pathToVersionCompleteFile, `{ "version": "${runtimeVersion}" }`);
        }
        else if (this.packageType == "runtime") {
            throw tl.loc("CannotFindRuntimeVersionForCompletingInstallation", this.packageType, versionInfo.version);
        }
    }

    private isLatestInstalledVersion(version: string): boolean {
        var pathTobeChecked = this.packageType == utils.Constants.sdk ? path.join(this.installationPath, utils.Constants.relativeSdkPath) : path.join(this.installationPath, utils.Constants.relativeRuntimePath);
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

        isLatest ? tl.debug(tl.loc("VersionIsLocalLatest", version, this.installationPath)) : tl.debug(tl.loc("VersionIsNotLocalLatest", version, this.installationPath));
        return isLatest;
    }

    private getVersionCompleteFileName(name: string): string {
        if (name && name.endsWith(".complete")) {
            var parts = name.split('.');
            var fileNameWithoutExtensionLength = name.length - (parts[parts.length - 1].length + 1);
            if (fileNameWithoutExtensionLength > 0) {
                return name.substr(0, fileNameWithoutExtensionLength);
            }
        }

        throw tl.loc("FileNameNotCorrectCompleteFileName", name);
    }

    private packageType: string;
    private installationPath: string;
}