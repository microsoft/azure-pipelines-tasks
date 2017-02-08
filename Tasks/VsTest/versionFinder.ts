import tl = require('vsts-task-lib/task');
import path = require('path');
import Q = require('q');
import models = require('./models')

var regedit = require('regedit');
var xml2js = require('xml2js');

export function locateVSTestConsole(testConfig): Q.Promise<models.ExecutabaleInfo> {
    let deferred = Q.defer<models.ExecutabaleInfo>();
    locateTestWindow(testConfig).
        then( function(exeInfo) {
            var vstestConsoleInfo = exeInfo;
            if(exeInfo){
                vstestConsoleInfo.location = path.join(exeInfo.location, "vstest.console.exe");
            }            
            deferred.resolve(vstestConsoleInfo);
        });
    return deferred.promise;
}

export function locateTestWindow(testConfig: models.TestConfigurations): Q.Promise<models.ExecutabaleInfo> {
    let deferred = Q.defer<models.ExecutabaleInfo>();
    let vsVersion: number = parseFloat(testConfig.vsTestVersion);

    if (isNaN(vsVersion) || vsVersion === 15.0) {
        // latest
        tl.debug('Searching for latest Visual Studio');
        let vstestconsole15Path = getVSTestConsole15Path(testConfig.vs15HelperPath);
        if (vstestconsole15Path) {
            deferred.resolve({ version: 15.0, location: vstestconsole15Path });
        } else {
            // fallback
            tl.debug('Unable to find an instance of Visual Studio 2017');
            return getLatestVSTestConsolePathFromRegistry();
        }
    } else {
        tl.debug('Searching for Visual Studio ' + vsVersion.toString());
        deferred.resolve({ version: vsVersion, location: getVSTestLocation(vsVersion) });
    }
    return deferred.promise;
}

function getLatestVSTestConsolePathFromRegistry(): Q.Promise<models.ExecutabaleInfo> {
    let deferred = Q.defer<models.ExecutabaleInfo>();
    let regPath = 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio';
    regedit.list(regPath).on('data', (entry) => {
        let subkeys = entry.data.keys;
        let versions = getFloatsFromStringArray(subkeys);
        if (versions && versions.length > 0) {
            versions.sort((a, b) => a - b);
            let selectedVersion = versions[versions.length - 1];
            tl.debug('Registry entry found. Selected version is ' + selectedVersion.toString());
            deferred.resolve({ version: selectedVersion, location: getVSTestLocation(selectedVersion) });
        } else {
            deferred.resolve(null);
        }
    }).on('error', () => {
        tl.debug('Registry entry not found under VisualStudio node');
        deferred.resolve(null);
    });
    return deferred.promise;
}

function getVSTestConsole15Path(vs15HelperPath: string): string {
    let powershellTool = tl.tool('powershell');
    let powershellArgs = ['-NonInteractive', '-ExecutionPolicy', 'Unrestricted', '-file', vs15HelperPath]
    powershellTool.arg(powershellArgs);
    let xml = powershellTool.execSync().stdout;
    let deferred = Q.defer<string>();
    let vstestconsolePath: string = null;
    xml2js.parseString(xml, (err, result) => {
        if (result) {
            try {
                let vs15InstallDir = result['Objs']['S'][0];
                vstestconsolePath = path.join(vs15InstallDir, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'TestWindow');
            } catch (e) {
                tl.debug('Unable to read Visual Studio 2017 installation path');
                tl.debug(e);
                vstestconsolePath = null;
            }
        }
    })
    return vstestconsolePath;
}

function getVSTestLocation(vsVersion: number): string {
    let vsCommon: string = tl.getVariable('VS' + vsVersion + '0COMNTools');
    if (!vsCommon) {
        throw (new Error(tl.loc('VstestNotFound', vsVersion)));
    } else {
        return path.join(vsCommon, '..\\IDE\\CommonExtensions\\Microsoft\\TestWindow');
    }
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
