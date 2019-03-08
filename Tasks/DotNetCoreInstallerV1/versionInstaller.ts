import * as path from 'path';
import * as fs from "fs";

import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';

import * as utils from "./versionUtilities";
import { VersionInfo } from './versionFetcher';

export class VersionInstaller {
    constructor(packageType: string, installationPath: string) {
        try {
            fs.existsSync(installationPath) || fs.mkdirSync(installationPath);
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
            tl.warning(tl.loc("CouldNotDownload", downloadUrl, JSON.stringify(error)));
        }

        try {
            //todo: if installation path is outside agents directory, acquire Lock for installation and start timer of 10-20 minutes, after which lock shall be auto released.

            //todo when lock work is done: Check if already installed
            // this.isVersionInstalled(version);

            // Extract
            console.log(tl.loc("ExtractingPackage", downloadPath));
            let extPath: string = tl.osType().match(/^Win/) ? await toolLib.extractZip(downloadPath) : await toolLib.extractTar(downloadPath);

            // Copy folders
            console.log(tl.loc("InstallingDotNetVersion", version, this.installationPath));
            tl.debug(tl.loc("CopyingFoldersIntoPath", this.installationPath));
            var allEnteriesInDir: string[] = fs.readdirSync(extPath).map(name => path.join(extPath, name));
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
        var isInstalled: boolean = false;
        if (this.packageType == "sdk") {
            isInstalled = toolLib.isExplicitVersion(version) && fs.existsSync(path.join(this.installationPath, "sdk", version)) && fs.existsSync(path.join(this.installationPath, "sdk", `${version}.complete`));
        }
        else {
            isInstalled = toolLib.isExplicitVersion(version) && fs.existsSync(path.join(this.installationPath, "shared", "Microsoft.NETCore.App", version)) && fs.existsSync(path.join(this.installationPath, "shared", "Microsoft.NETCore.App", `${version}.complete`));
        }

        isInstalled ? console.log(tl.loc("VersionFoundInToolCache")) : console.log(tl.loc("VersionNotFoundInToolCache", version));
        return isInstalled;
    }

    private createInstallationCompleteFile(versionInfo: VersionInfo): void {
        let version = versionInfo.version;
        tl.debug(tl.loc("CreatingInstallationCompeleteFile", version, this.packageType));
        // always add for runtime as it is installed with SDK as well.
        var pathToVersionCompleteFile: string = "";
        if (this.packageType == "sdk") {
            pathToVersionCompleteFile = path.join(this.installationPath, "sdk");
            fs.writeFileSync(path.join(pathToVersionCompleteFile, `${version}.complete`), `{ "version": "${version}" }`);
        }

        pathToVersionCompleteFile = path.join(this.installationPath, "shared", "Microsoft.NETCore.App");
        fs.writeFileSync(path.join(pathToVersionCompleteFile, `${VersionInfo.getRuntimeVersion(versionInfo)}.complete`), `{ "version": "${VersionInfo.getRuntimeVersion(versionInfo)}" }`);
    }

    private isLatestInstalledVersion(version: string): boolean {
        var pathTobeChecked = this.packageType == "sdk" ? path.join(this.installationPath, "sdk") : path.join(this.installationPath, "host", "fxr");
        if (!fs.existsSync(pathTobeChecked)) {
            throw tl.loc("PathNotFoundException", pathTobeChecked);
        }

        var allEnteries: string[] = fs.readdirSync(pathTobeChecked).map(name => path.join(pathTobeChecked, name));
        var folderPaths: string[] = allEnteries.filter(element => fs.lstatSync(element).isDirectory());
        var isLatest: boolean = folderPaths.findIndex(folderPath => utils.versionCompareFunction(path.basename(folderPath), version) > 0) < 0;
        var filePaths: string[] = allEnteries.filter(element => !fs.lstatSync(element).isDirectory());
        isLatest = isLatest && filePaths.findIndex(filePath => utils.versionCompareFunction(this.getVersionCompleteFileName(path.basename(filePath)), version) > 0) < 0;

        isLatest ? tl.debug(tl.loc("VersionIsLocalLatest")) : tl.debug(tl.loc("VersionIsNotLocalLatest"));
        return isLatest;
    }

    private getVersionCompleteFileName(name: string): string {
        var parts = name.split('.');
        return name.substr(0, name.length - (parts[parts.length - 1].length + 1));
    }


    private packageType: string;
    private installationPath: string;
}