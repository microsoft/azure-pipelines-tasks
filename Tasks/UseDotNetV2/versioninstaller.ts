"use strict";
import * as path from 'path';
import * as fs from "fs";
import * as url from "url";

import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';

import * as utils from "./versionutilities";
import { VersionInfo } from "./models"
import { DotNetCoreVersionFetcher } from './versionfetcher';

export class VersionInstaller {
    private versionFetcher: DotNetCoreVersionFetcher = new DotNetCoreVersionFetcher();
    constructor(packageType: string, installationPath: string) {
        try {
            taskLib.exist(installationPath) || taskLib.mkdirP(installationPath);
        }
        catch (ex) {
            throw taskLib.loc("UnableToAccessPath", installationPath, JSON.stringify(ex));
        }

        this.packageType = packageType;
        this.installationPath = installationPath;
    }

    /**
     * Install many versions at the same time
     * @param versionInfos all versions you want to install.
     */
    public async downloadAndInstallVersions(versionInfos: VersionInfo[]){
        for (let index = 0; index < versionInfos.length; index++) {
            const version = versionInfos[index];
            await this.downloadAndInstall(version);            
        }
    }

    /**
     * Install a single version from a versionInfo
     * @param versionInfo the versionInfo object with all information from the version
     * @param downloadUrl optional a downloadUrl if you have your own custom download url of the sdk / runtime.
     */
    public async downloadAndInstall(versionInfo: VersionInfo, downloadUrl: string | null = null): Promise<void> {
        if(downloadUrl == null){
            downloadUrl = this.versionFetcher.getDownloadUrl(versionInfo);
        }
        if (!versionInfo || !versionInfo.getVersion() || !downloadUrl || !url.parse(downloadUrl)) {
            throw taskLib.loc("VersionCanNotBeDownloadedFromUrl", versionInfo, downloadUrl);
        }

        let version = versionInfo.getVersion();

        try {
            try {
                var downloadPath = await toolLib.downloadTool(downloadUrl)
            }
            catch (ex) {
                throw taskLib.loc("CouldNotDownload", downloadUrl, ex);
            }

            // Extract
            console.log(taskLib.loc("ExtractingPackage", downloadPath));
            try {
                var extPath = taskLib.osType().match(/^Win/) ? await toolLib.extractZip(downloadPath) : await toolLib.extractTar(downloadPath);
            }
            catch (ex) {
                throw taskLib.loc("FailedWhileExtractingPacakge", ex);
            }

            // Copy folders
            taskLib.debug(taskLib.loc("CopyingFoldersIntoPath", this.installationPath));
            var allRootLevelEnteriesInDir: string[] = taskLib.ls("", [extPath]).map(name => path.join(extPath, name));
            var directoriesTobeCopied: string[] = allRootLevelEnteriesInDir.filter(path => fs.lstatSync(path).isDirectory());
            directoriesTobeCopied.forEach((directoryPath) => {
                taskLib.cp(directoryPath, this.installationPath, "-rf", false);
            });

            // Copy files
            try {
                if (this.packageType == utils.Constants.sdk && this.isLatestInstalledVersion(version)) {
                    taskLib.debug(taskLib.loc("CopyingFilesIntoPath", this.installationPath));
                    var filesToBeCopied = allRootLevelEnteriesInDir.filter(path => !fs.lstatSync(path).isDirectory());
                    filesToBeCopied.forEach((filePath) => {
                        taskLib.cp(filePath, this.installationPath, "-f", false);
                    });
                }
            }
            catch (ex) {
                taskLib.warning(taskLib.loc("FailedToCopyTopLevelFiles", this.installationPath, ex));
            }

            // Cache tool
            this.createInstallationCompleteFile(versionInfo);

            console.log(taskLib.loc("SuccessfullyInstalled", this.packageType, version));
        }
        catch (ex) {
            throw taskLib.loc("FailedWhileInstallingVersionAtPath", version, this.installationPath, ex);
        }
    }

    /**
     * This checks if an explicit version is installed.
     * This doesn't work with a search pattern like 1.0.x.
     * @param version An explicit version. Like 1.0.1
     */
    public isVersionInstalled(version: string): boolean {
        if (!toolLib.isExplicitVersion(version)) {
            throw taskLib.loc("ExplicitVersionRequired", version);
        }

        var isInstalled: boolean = false;
        if (this.packageType == utils.Constants.sdk) {
            isInstalled = taskLib.exist(path.join(this.installationPath, utils.Constants.relativeSdkPath, version)) && taskLib.exist(path.join(this.installationPath, utils.Constants.relativeSdkPath, `${version}.complete`));
        }
        else {
            isInstalled = taskLib.exist(path.join(this.installationPath, utils.Constants.relativeRuntimePath, version)) && taskLib.exist(path.join(this.installationPath, utils.Constants.relativeRuntimePath, `${version}.complete`));
        }

        isInstalled ? console.log(taskLib.loc("VersionFoundInCache", version)) : console.log(taskLib.loc("VersionNotFoundInCache", version));
        return isInstalled;
    }

    private createInstallationCompleteFile(versionInfo: VersionInfo): void {
        taskLib.debug(taskLib.loc("CreatingInstallationCompeleteFile", versionInfo.getVersion(), this.packageType));
        // always add for runtime as it is installed with sdk as well.
        var pathToVersionCompleteFile: string = "";
        if (this.packageType == utils.Constants.sdk) {
            let sdkVersion = versionInfo.getVersion();
            pathToVersionCompleteFile = path.join(this.installationPath, utils.Constants.relativeSdkPath, `${sdkVersion}.complete`);
            taskLib.writeFile(pathToVersionCompleteFile, `{ "version": "${sdkVersion}" }`);
        }

        let runtimeVersion = versionInfo.getRuntimeVersion();
        if (runtimeVersion) {
            pathToVersionCompleteFile = path.join(this.installationPath, utils.Constants.relativeRuntimePath, `${runtimeVersion}.complete`);
            taskLib.writeFile(pathToVersionCompleteFile, `{ "version": "${runtimeVersion}" }`);
        }
        else if (this.packageType == utils.Constants.runtime) {
            throw taskLib.loc("CannotFindRuntimeVersionForCompletingInstallation", this.packageType, versionInfo.getVersion());
        }
    }

    private isLatestInstalledVersion(version: string): boolean {
        var pathTobeChecked = this.packageType == utils.Constants.sdk ? path.join(this.installationPath, utils.Constants.relativeSdkPath) : path.join(this.installationPath, utils.Constants.relativeRuntimePath);
        if (!taskLib.exist(pathTobeChecked)) {
            throw taskLib.loc("PathNotFoundException", pathTobeChecked);
        }

        var allEnteries: string[] = taskLib.ls("", [pathTobeChecked]).map(name => path.join(pathTobeChecked, name));
        var folderPaths: string[] = allEnteries.filter(element => fs.lstatSync(element).isDirectory());
        var isLatest: boolean = folderPaths.findIndex(folderPath => {
            try {
                let versionFolderName = path.basename(folderPath);
                taskLib.debug(taskLib.loc("ComparingInstalledFolderVersions", version, versionFolderName));
                return utils.versionCompareFunction(versionFolderName, version) > 0;
            }
            catch (ex) {
                // no op, folder name might not be in version format
            }
        }) < 0;

        var filePaths: string[] = allEnteries.filter(element => !fs.lstatSync(element).isDirectory());
        isLatest = isLatest && filePaths.findIndex(filePath => {
            try {
                var versionCompleteFileName = this.getVersionCompleteFileName(path.basename(filePath));
                taskLib.debug(taskLib.loc("ComparingInstalledFileVersions", version, versionCompleteFileName));
                return utils.versionCompareFunction(versionCompleteFileName, version) > 0
            }
            catch (ex) {
                // no op, file name might not be in version format
            }
        }) < 0;

        isLatest ? taskLib.debug(taskLib.loc("VersionIsLocalLatest", version, this.installationPath)) : taskLib.debug(taskLib.loc("VersionIsNotLocalLatest", version, this.installationPath));
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

        throw taskLib.loc("FileNameNotCorrectCompleteFileName", name);
    }

    private packageType: string;
    private installationPath: string;
}