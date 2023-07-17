import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as constants from './constants';
import { loadMinicondaRepo, MinicondaEntry } from './condarepo';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    try {
        let minicondaReleasesIndexUrl = "https://repo.anaconda.com/miniconda/";
        const condaRepoPromise = loadMinicondaRepo(minicondaReleasesIndexUrl);

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
            case tl.Platform.Linux:
                osTypeString = "Linux";
                fileExtension = "sh"
                installerOptions = `-b -f -p ${installPath}`;
                break;
            case tl.Platform.MacOS:
                osTypeString = "MacOSX";
                fileExtension = "sh"
                installerOptions = `-b -f -p ${installPath}`;
                break;
            case tl.Platform.Windows:
                osTypeString = "Windows";
                fileExtension = "exe"
                installerOptions = `/S /f /D=${installPath}`;
                break;
            default:
                throw new Error(tl.loc('UnsupportedOSPlatform', osTypeEnum, "Linux, Windows, MacOSX"));
        }

        // resolve which Miniconda version to download/install
        let condaRepo = await condaRepoPromise;

        let condaEntryToInstall: MinicondaEntry;
        if (installLatest) {
            condaEntryToInstall = condaRepo.getLatestEntry(pythonMajorVersion, osTypeString, processorArchitecture, fileExtension);
        } else {
            condaEntryToInstall = condaRepo.getEntry(pythonMajorVersion, pythonMinorVersion, condaVersion, osTypeString, processorArchitecture, fileExtension);
        }

        if (!condaEntryToInstall)
            throw new Error("Couldn't find conda entry that matches the given parameters.");

        // actually download/install Miniconda
        console.log("Downloading Conda from this URL: " + condaEntryToInstall.downloadUrl);
        const downloadPath = await condaEntryToInstall.download();

        console.log("file downloaded to: " + downloadPath);
        console.log("Installing conda at: " + installPath);
        console.log("Executing install artifact.");
        const exitCode = await tl.exec(downloadPath, installerOptions);

        if (exitCode === 0) {
            console.log("Conda install artifact ran successfully.");
        } else {
            throw new Error(tl.loc("FailedToRunCondaInstaller", exitCode));
        }

    }

    catch(error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToInstallConda"));
        return;
    }
}

main();