import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import Q = require('q');
import fs = require('fs');
import tr = require('azure-pipelines-task-lib/toolrunner');

var DecompressZip = require('decompress-zip');
var archiver = require('archiver');

const deleteDir = (path: string) => tl.exist(path) && tl.rmRF(path);

const extractWindowsZip = async (fromFile: string, toDir: string, usePowerShell?: boolean) => {    
    let forceUsePSUnzip: string = process.env['ADO_FORCE_USE_PSUNZIP'] || 'false'
    tl.debug(`ADO_FORCE_USE_PSUNZIP = '${forceUsePSUnzip}'`)
    if (forceUsePSUnzip.toLowerCase() === 'true') {
        await extractUsingPowerShell(fromFile, toDir);
    } else {
        await extractUsing7zip(fromFile, toDir);
    }
}

const extractUsingPowerShell = async (fromFile: string, toDir: string) => {
    tl.debug(`Using PowerShell for extracting zip ${fromFile}`);
    let command = `Expand-Archive -Path "${fromFile}" -DestinationPath "${toDir}" -Force`;
    tl.debug(`Command to execute: '${command}'`)
    let powershellPath: string = ''
    let packageSizeInMB: number = 0

    try {
        let packageStats: fs.Stats = fs.statSync(fromFile)
        // size in mb
        packageSizeInMB = Math.floor(packageStats.size / 1024 / 1024)
    }
    catch (error) {
        tl.debug("Error occurred while trying to calculate package size in MB.")
        tl.debug(error)
        packageSizeInMB = -1
    }

    tl.debug(`Package Size = '${packageSizeInMB}' MB`)

    // We prefer to decompress usng powershell core (pwsh.exe) rather than windows powershell (powershell.exe)
    // because of pwsh offers significantly better performance. But on private agents, the presence of pwsh
    // is not guaranteed. And so, if we are not able to find pwsh.exe, we fall back to powershell.exe
    try {
        powershellPath = tl.which('pwsh', true)
    }
    catch (error) {
        tl.debug(`Tool 'pwsh' not found. Error: ${error}`)
        tl.debug("PowerShell core is not available on agent machine. Falling back to using Windows PowerShell.")
        console.log(tl.loc('PwshNotAvailable'))
        powershellPath = tl.which('powershell', true)
    }

    tl.debug(`Powershell path: '${powershellPath}'`)

    let powershell = tl.tool(powershellPath)
                        .arg('-NoLogo')
                        .arg('-NoProfile')
                        .arg('-NonInteractive')
                        .arg('-Command')
                        .arg(command);
    
    let options = <tr.IExecOptions>{
        failOnStdErr: false,
        errStream: process.stdout,
        outStream: process.stdout,
        ignoreReturnCode: true
    };

    let startTimeInSeconds: number = 0
    let endTimeInSeconds: number = 0

    startTimeInSeconds = Math.round(Date.now() / 1000)
    let exitCode: number = await powershell.exec(options);
    endTimeInSeconds = Math.round(Date.now() / 1000)
    let timeToExtractInSeconds: number = endTimeInSeconds - startTimeInSeconds
    tl.debug(`Time to extract msbuild package in seconds = '${timeToExtractInSeconds}'`)

    let telemetry: string = `{ "PackageSizeInMB": "${packageSizeInMB}", "TimeToExtractInSeconds": "${timeToExtractInSeconds}" }`
    tl.debug(`telemetry = '${telemetry}'`)

    console.log(`##vso[telemetry.publish area=TaskHub;feature=MSBuildPackageExtraction]${telemetry}`)

    if (exitCode !== 0) {
        throw("Archive extraction using powershell failed.");
    }
}

const extractUsing7zip = async (fromFile: string, toDir: string) => {
    tl.debug('Using 7zip tool for extracting');
    var win7zipLocation = path.join(__dirname, '7zip/7zip/7z.exe');
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

export async function unzip(zipFileLocation: string, unzipDirLocation: string) {
    deleteDir(unzipDirLocation);
    
    const isWin = tl.getPlatform() === tl.Platform.Windows;
    tl.debug('windows platform: ' + isWin);

    tl.debug('extracting ' + zipFileLocation + ' to ' + unzipDirLocation);    
    if (isWin) {
        await extractWindowsZip(zipFileLocation, unzipDirLocation);
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

