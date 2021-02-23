import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import Q = require('q');
import fs = require('fs');

var DecompressZip = require('decompress-zip');
var archiver = require('archiver');

const deleteDir = (path: string) => tl.exist(path) && tl.rmRF(path);

const extractWindowsZip = async (fromFile: string, toDir: string, usePowerShell?: boolean) => {
    if (usePowerShell) {
        extractUsingPowerShell(fromFile, toDir);
    }
    else {
        await extractUsing7zip(fromFile, toDir);
    }
}

const extractUsingPowerShell = (fromFile: string, toDir: string) => {
    tl.debug(`Using PowerShell for extracting zip ${fromFile}`);
    tl.execSync(`powershell.exe`, `Expand-Archive -Path ${fromFile} -DestinationPath ${toDir}`);
}

const extractUsing7zip = async (fromFile: string, toDir: string) => {
    tl.debug('Using 7zip tool for extracting');
    var win7zipLocation = path.join(__dirname, '7zip/7z.exe');
    await tl.tool(win7zipLocation)
        .arg([ 'x', `-o${toDir}`, fromFile ])
        .exec();
}

const extractUsingUnzip = async (fromFile: string, toDir: string) => {
    tl.debug('Using unzip tool for extracting');
    var unzipToolLocation = tl.which('unzip', true);
    await tl.tool(unzipToolLocation)
        .arg([ fromFile, '-d', toDir ])
        .exec();
}

const isMSBuildPackageZip = async (packageZipPath: string): Promise<boolean> => {
    let pacakgeComponent = await getArchivedEntries(packageZipPath);
    if (((pacakgeComponent["entries"].indexOf("parameters.xml") > -1) || (pacakgeComponent["entries"].indexOf("Parameters.xml") > -1)) && 
        ((pacakgeComponent["entries"].indexOf("systemInfo.xml") > -1) || (pacakgeComponent["entries"].indexOf("systeminfo.xml") > -1)
        || (pacakgeComponent["entries"].indexOf("SystemInfo.xml") > -1))) {
        return true;
    }

    return false;
}

export async function unzip(zipFileLocation: string, unzipDirLocation: string) {
    deleteDir(unzipDirLocation);
    
    const isWin = tl.getPlatform() === tl.Platform.Windows;
    tl.debug('windows platform: ' + isWin);

    tl.debug('extracting ' + zipFileLocation + ' to ' + unzipDirLocation);    
    if (isWin) {
        let isMSBuildPackage = await isMSBuildPackageZip(zipFileLocation);
        await extractWindowsZip(zipFileLocation, unzipDirLocation, isMSBuildPackage);
    } 
    else{
        await extractUsingUnzip(zipFileLocation, unzipDirLocation);
    }

    tl.debug('extracted ' + zipFileLocation + ' to ' + unzipDirLocation + ' Successfully');
}

export async function archiveFolder(folderPath, targetPath, zipName) {
    var defer = Q.defer();
    tl.debug('Archiving ' + folderPath + ' to ' + zipName);
    var outputZipPath = path.join(targetPath, zipName);
    var output = fs.createWriteStream(outputZipPath);
    var archive = archiver('zip');
    output.on('close', function () {
        tl.debug('Successfully created archive ' + zipName);
        defer.resolve(outputZipPath);
    });

    output.on('error', function(error) {
        defer.reject(error);
    });

    archive.pipe(output);
    archive.directory(folderPath, '/');
    archive.finalize();

    return defer.promise;
}

/**
 *  Returns array of files present in archived package
 */
export async function getArchivedEntries(archivedPackage: string)  {
    var deferred = Q.defer();
    var unzipper = new DecompressZip(archivedPackage);
    unzipper.on('error', function (error) {
        deferred.reject(error);
    });
    unzipper.on('list', function (files) {
        var packageComponent = {
            "entries":files
        };
        deferred.resolve(packageComponent); 
    });
    unzipper.list();
    return deferred.promise;
}
