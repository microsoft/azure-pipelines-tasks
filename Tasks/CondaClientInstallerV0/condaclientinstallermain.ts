import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as rp from 'request-promise';
import * as fs from 'fs'
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as pkgLocationUtils from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import * as url from 'url';
import * as constants from './constants';
import { MinicondaRepo, AnacondaRepo, CondaEntry } from './condarepo';

import { Platform, exec } from 'azure-pipelines-task-lib/task';
// import { request } from 'http';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    try {
        let minicondaReleasesIndexUrl = "https://repo.anaconda.com/miniconda/";
        let anacondaReleasesIndexUrl = "https://repo.anaconda.com/archive/";
        
        let distributionType = tl.getInput(constants.CondaInstallTaskInput.DistributionType);

        const condaRepoPromise = distributionType === "Anaconda" ? AnacondaRepo.loadVersionsFromRepo(anacondaReleasesIndexUrl) : MinicondaRepo.loadVersionsFromRepo(minicondaReleasesIndexUrl);

        let installLatest = tl.getBoolInput(constants.CondaInstallTaskInput.InstallLatest);
        let pythonMajorVersion = tl.getInput(constants.CondaInstallTaskInput.PythonMajorVersion);
        let pythonMinorVersion = tl.getInput(constants.CondaInstallTaskInput.PythonMinorVersion);
        let condaVersion = tl.getInput(constants.CondaInstallTaskInput.CondaVersion);
        let processorArchitecture = tl.getInput(constants.CondaInstallTaskInput.ProcessorArchitecture);
        let installPath = tl.getInput(constants.CondaInstallTaskInput.InstallPath);

        const osTypeEnum = tl.getPlatform();
        let osTypeString = "";
        let fileExtension = "";
        let installerOptions = "";
        switch(osTypeEnum)
        {
            case Platform.Linux:
                osTypeString = "Linux";
                fileExtension = "sh"
                installerOptions = `-p ${installPath}`;
                break;
            case Platform.Windows:
                osTypeString = "Windows";
                fileExtension = "exe"
                installerOptions = `/D=${installPath}`;
                break;
            case Platform.MacOS:
                osTypeString = "MacOSX";
                fileExtension = "sh"
                installerOptions = `-p ${installPath}`;
                break;
            default:
                throw new Error(tl.loc('Error_UnsupportedOSPlatform', osTypeEnum));
        }

        let condaRepo = await condaRepoPromise;

        let condaEntryToInstall: CondaEntry;
        if (installLatest) {
            condaEntryToInstall = condaRepo.getLatestEntry(pythonMajorVersion, osTypeString, processorArchitecture, fileExtension);
        } else if (distributionType === "Anaconda") {
            condaRepo = <AnacondaRepo> condaRepo;
            condaEntryToInstall = condaRepo.getEntry(pythonMajorVersion, condaVersion, osTypeString, processorArchitecture, fileExtension);
        } else {
            condaRepo = <MinicondaRepo> condaRepo;
            condaEntryToInstall = condaRepo.getEntry(pythonMajorVersion, pythonMinorVersion, condaVersion, osTypeString, processorArchitecture, fileExtension);
        }

        if (!condaEntryToInstall)
            throw new Error("Couldn't find conda entry that matches the given parameters.");

        //actually download/install it
        console.log("Downloading Conda from this URL: " + condaEntryToInstall.downloadUrl);
        const downloadPath = await condaEntryToInstall.download();

        console.log("file downloaded to: " + downloadPath);
        console.log("Executing install artifact.");
        const exitCode = await exec(downloadPath, installerOptions);

        if (exitCode === 0) {
            console.log("Conda install artifact ran successfully.")
        } else {
            throw new Error(`Conda install exited with error code: ${exitCode}`);
        }
    }

    catch(error) {
        tl.error(error);
        tl.error(error.stack);
        tl.setResult(tl.TaskResult.Failed, "FailedToInstallConda");
        // tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToInstallConda"));
        return;
    }
}

main();