import * as tl from 'azure-pipelines-task-lib/task';
import tr = require('azure-pipelines-task-lib/toolrunner');
import * as path from 'path';
import * as models from './models';
import * as version from './vstestversion';
import * as utils from './helpers';
import * as ci from './cieventlogger';

const regedit = require('regedit');

export function getVsTestRunnerDetails(testConfig: models.TestConfigurations) {
    const vstestexeLocation = locateVSTestConsole(testConfig);

    // Temporary hack for 16.0. All this code will be removed once we migrate to the Hydra flow
    if (testConfig.vsTestVersion === '16.0') {
        testConfig.vsTestVersionDetails = new version.VSTestVersion(vstestexeLocation, 16, 0, 0);
        return;
    }

    const vstestLocationEscaped = vstestexeLocation.replace(/\\/g, '\\\\');
    const wmicTool = tl.tool('wmic');
    const wmicArgs = ['datafile', 'where', 'name=\''.concat(vstestLocationEscaped, '\''), 'get', 'Version', '/Value'];
    wmicTool.arg(wmicArgs);
    let output = wmicTool.execSync({ silent: true } as tr.IExecSyncOptions).stdout;

    if (utils.Helper.isNullOrWhitespace(output)) {
        tl.error(tl.loc('ErrorReadingVstestVersion'));
        throw new Error(tl.loc('ErrorReadingVstestVersion'));
    }
    output = output.trim();
    tl.debug('VSTest Version information: ' + output);
    const verSplitArray = output.split('=');
    if (verSplitArray.length !== 2) {
        tl.error(tl.loc('ErrorReadingVstestVersion'));
        throw new Error(tl.loc('ErrorReadingVstestVersion'));
    }

    const versionArray = verSplitArray[1].split('.');
    if (versionArray.length !== 4) {
        tl.warning(tl.loc('UnexpectedVersionString', output));
        throw new Error(tl.loc('UnexpectedVersionString', output));
    }

    const majorVersion = parseInt(versionArray[0]);
    const minorVersion = parseInt(versionArray[1]);
    const patchNumber = parseInt(versionArray[2]);

    ci.publishEvent({ testplatform: `${majorVersion}.${minorVersion}.${patchNumber}` });

    if (isNaN(majorVersion) || isNaN(minorVersion) || isNaN(patchNumber)) {
        tl.warning(tl.loc('UnexpectedVersionNumber', verSplitArray[1]));
        throw new Error(tl.loc('UnexpectedVersionNumber', verSplitArray[1]));
    }

    switch (majorVersion) {
        case 14:
            testConfig.vsTestVersionDetails = new version.Dev14VSTestVersion(vstestexeLocation, minorVersion, patchNumber);
            break;
        case 15:
            testConfig.vsTestVersionDetails = new version.Dev15VSTestVersion(vstestexeLocation, minorVersion, patchNumber);
            break;
        default:
            testConfig.vsTestVersionDetails = new version.VSTestVersion(vstestexeLocation, majorVersion, minorVersion, patchNumber);
            break;
    }
}

function locateVSTestConsole(testConfig: models.TestConfigurations): string {
    const vstestExeFolder = locateTestWindow(testConfig);
    let vstestExePath: string = vstestExeFolder;
    if (vstestExeFolder) {
        vstestExePath = path.join(vstestExeFolder, 'vstest.console.exe');
    }
    return vstestExePath;
}

function locateTestWindow(testConfig: models.TestConfigurations): string {
    if (testConfig.vsTestLocationMethod === utils.Constants.vsTestLocationString) {
        if (utils.Helper.pathExistsAsFile(testConfig.vsTestLocation)) {
            return path.join(testConfig.vsTestLocation, '..');
        }

        if (utils.Helper.pathExistsAsDirectory(testConfig.vsTestLocation) &&
            utils.Helper.pathExistsAsFile(path.join(testConfig.vsTestLocation, 'vstest.console.exe'))) {
            return testConfig.vsTestLocation;
        }
        throw (new Error(tl.loc('VstestLocationDoesNotExist', testConfig.vsTestLocation)));
    }

    if (testConfig.vsTestVersion.toLowerCase() === 'latest') {
        // latest
        tl.debug('Searching for latest Visual Studio');
        
        let vstestconsolePath = getVSTestConsolePath('17.0', '18.0');
        if (vstestconsolePath) {
            testConfig.vsTestVersion = "17.0";
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }
         vstestconsolePath = getVSTestConsolePath('16.0', '17.0');
        if (vstestconsolePath) {
            testConfig.vsTestVersion = "16.0";
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }

        vstestconsolePath = getVSTestConsolePath('15.0', '16.0');
        if (vstestconsolePath) {
            testConfig.vsTestVersion = "15.0";
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'TestWindow');
        }

        // fallback
        tl.debug('Unable to find an instance of Visual Studio 2017..');
        tl.debug('Searching for Visual Studio 2015..');
        testConfig.vsTestVersion = "14.0";
        return getVSTestLocation(14);
    }

    const vsVersion: number = parseFloat(testConfig.vsTestVersion);

    if (vsVersion === 17.0) {                                                       //Visual Studio 2022
        const vstestconsolePath = getVSTestConsolePath('17.0', '18.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    if (vsVersion === 16.0) {
        const vstestconsolePath = getVSTestConsolePath('16.0', '17.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'Extensions', 'TestPlatform');
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    if (vsVersion === 15.0) {
        const vstestconsolePath = getVSTestConsolePath('15.0', '16.0');
        if (vstestconsolePath) {
            return path.join(vstestconsolePath, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'TestWindow');
        }
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }

    tl.debug('Searching for Visual Studio ' + vsVersion.toString());
    return getVSTestLocation(vsVersion);
}

export function getVSTestConsolePath(versionLowerLimit : string, versionUpperLimit : string): string {
    let vswhereTool = tl.tool(path.join(__dirname, 'vswhere.exe'));

    console.log(tl.loc('LookingForVsInstalltion', `[${versionLowerLimit},${versionUpperLimit})`));
    vswhereTool.line(`-version [${versionLowerLimit},${versionUpperLimit}) -latest -products * -requires Microsoft.VisualStudio.PackageGroup.TestTools.Core -property installationPath`);
    let vsPath = vswhereTool.execSync({ silent: true } as tr.IExecSyncOptions).stdout;
    vsPath = utils.Helper.trimString(vsPath);
    if (!utils.Helper.isNullOrWhitespace(vsPath)) {
        tl.debug('Visual Studio 15.0 or higher installed path: ' + vsPath);
        return vsPath;
    }

    // look for build tool installation if full VS not present
    console.log(tl.loc('LookingForBuildToolsInstalltion', `[${versionLowerLimit},${versionUpperLimit})`));
    vswhereTool = tl.tool(path.join(__dirname, 'vswhere.exe'));
    vswhereTool.line(`-version [${versionLowerLimit},${versionUpperLimit}) -latest -products * -requires Microsoft.VisualStudio.Component.TestTools.BuildTools -property installationPath`);
    vsPath = vswhereTool.execSync({ silent: true } as tr.IExecSyncOptions).stdout;
    vsPath = utils.Helper.trimString(vsPath);
    if (!utils.Helper.isNullOrWhitespace(vsPath)) {
        tl.debug('Build tools installed path: ' + vsPath);
        return vsPath;
    }

    return null;
}

export function getVSTestLocation(vsVersion: number): string {
    const vsCommon: string = tl.getVariable('VS' + vsVersion + '0COMNTools');
    if (!vsCommon) {
        throw (new Error(tl.loc('VstestNotFound', utils.Helper.getVSVersion(vsVersion))));
    }
    return path.join(vsCommon, '..\\IDE\\CommonExtensions\\Microsoft\\TestWindow');
}

function getFloatsFromStringArray(inputArray: string[]): number[] {
    const outputArray: number[] = [];
    let count;
    if (inputArray) {
        for (count = 0; count < inputArray.length; count++) {
            const floatValue = parseFloat(inputArray[count]);
            if (!isNaN(floatValue)) {
                outputArray.push(floatValue);
            }
        }
    }
    return outputArray;
}