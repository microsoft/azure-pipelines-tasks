import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');
import models = require('./models')
import utils = require('./helpers');

var regedit = require('regedit');
var xml2js = require('xml2js');

export async function locateVSTestConsole(testConfig): Promise<string> {
    let deferred = Q.defer<string>();
    let vstestExeFolder = await locateTestWindow(testConfig);
        
    var vstestExePath = vstestExeFolder;
    if(vstestExeFolder){
        vstestExePath = path.join(vstestExeFolder, "vstest.console.exe");
    }

    return Promise.resolve(vstestExePath);
}

export class VSTestVersion {

    constructor(public vstestExeLocation: string, public majorVersion: number, public minorversion: number, public patchNumber: number) {
    }

    isTestImpactSupported(): boolean {
        return (this.majorVersion >= 15);
    }

    vstestDiagSupported(): boolean {
        return (this.majorVersion >= 15);
    }

    isPrivateDataCollectorNeededForTIA(): boolean {
        return false;
    }

    isRunInParallelSupported(): boolean {
        return (this.majorVersion >= 15);
    }
}


export class Dev14VSTestVersion extends VSTestVersion {
    constructor(runnerLocation: string, minorVersion: number, patchNumber: number) {
        super(runnerLocation, 14, minorVersion, patchNumber);
    }

    isTestImpactSupported(): boolean {
        return (this.patchNumber >= 25420);
    }

    isRunInParallelSupported(): boolean {
        return (this.patchNumber >= 25420);
    }

    isPrivateDataCollectorNeededForTIA(): boolean {
        return true;
    }
}

export class Dev15VSTestVersion extends VSTestVersion {
    constructor(runnerLocation: string, minorVersion: number, patchNumber: number) {
        super(runnerLocation, 15, minorVersion, patchNumber);
    }

    isTestImpactSupported(): boolean {
        return (this.patchNumber >= 25727);
    }

    vstestDiagSupported(): boolean {
        return (this.patchNumber > 25428);
    }
}

function locateTestWindow(testConfig: models.TestConfigurations): Promise<string> {
    let deferred = Q.defer<string>();
    let vsVersion: number = parseFloat(testConfig.vsTestVersion);
    if(testConfig.vsTestLocationMethod === utils.Constants.vsTestLocationString) {
        if (utils.Helper.pathExistsAsFile(testConfig.vsTestLocation)) {
            return Promise.resolve(path.join(testConfig.vsTestLocation,".."));
        } 
        
        if (utils.Helper.pathExistsAsDirectory(testConfig.vsTestLocation) && 
            utils.Helper.pathExistsAsFile(path.join(testConfig.vsTestLocation, 'vstest.console.exe'))) {
            return Promise.resolve(testConfig.vsTestLocation);
        } 

        throw (new Error(tl.loc('PathDoesNotExist', testConfig.vsTestLocation)));
    } 

    if (isNaN(vsVersion)) {
        // latest
        tl.debug('Searching for latest Visual Studio');
        let vstestconsole15Path = getVSTestConsole15Path();
        if (vstestconsole15Path) {
            return Promise.resolve(vstestconsole15Path);
        } 

        // fallback
        tl.debug('Unable to find an instance of Visual Studio 2017');
        return getLatestVSTestConsolePathFromRegistry();
    }
    
    if (vsVersion === 15.0) {
        let vstestconsole15Path = getVSTestConsole15Path();
        if (vstestconsole15Path) {
            return Promise.resolve(vstestconsole15Path);
        }

        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }
    

    tl.debug('Searching for Visual Studio ' + vsVersion.toString());
    return Promise.resolve(getVSTestLocation(vsVersion));
}

function getLatestVSTestConsolePathFromRegistry(): Promise<string> {
    let deferred = Q.defer<string>();
    let regPath = 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio';
    regedit.list(regPath).on('data', (entry) => {
        let subkeys = entry.data.keys;
        let versions = getFloatsFromStringArray(subkeys);
        if (versions && versions.length > 0) {
            versions.sort((a, b) => a - b);
            let selectedVersion = versions[versions.length - 1];
            tl.debug('Registry entry found. Selected version is ' + selectedVersion.toString());
            return Promise.resolve(getVSTestLocation(selectedVersion));
        } 

        tl.debug('No Registry entry found under VisualStudio node');
        return Promise.resolve(null);
    }).on('error', () => {
        tl.debug('Registry entry not found under VisualStudio node');
        return Promise.resolve(null);
    });
    
    return Promise.resolve(null);
}

function getVSTestConsole15Path(): string {
    const vswhereTool = tl.tool(path.join(__dirname, 'vswhere.exe'));
    vswhereTool.line('-latest -products * -requires Microsoft.VisualStudio.PackageGroup.TestTools.Core -property installationPath')
    return vswhereTool.execSync().stdout;
}

function getVSTestLocation(vsVersion: number): string {
    let vsCommon: string = tl.getVariable('VS' + vsVersion + '0COMNTools');
    if (!vsCommon) {
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    } 

    return path.join(vsCommon, '..\\IDE\\CommonExtensions\\Microsoft\\TestWindow');
}

function getFloatsFromStringArray(inputArray: string[]): number[] {
    var outputArray: number[] = [];
    var count;
    if (inputArray) {
        for (count = 0; count < inputArray.length; count++) {
            var floatValue = parseFloat(inputArray[count]);
            if (!isNaN(floatValue)) {
                outputArray.push(floatValue);
            }
        }
    }
    
    return outputArray;
}