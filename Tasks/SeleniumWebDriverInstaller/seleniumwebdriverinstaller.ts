import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as os from 'os';
import * as path from 'path';
import * as enums from './enums';
import downloadutility = require("utility-common/downloadutility");

const osPlat: string = os.platform();
const ChromeDriverName = 'ChromeWebDriver';
const GeckoDriverName = 'GeckoWebDriver';
const IEDriverName = 'IEWebDriver';
const EdgeDriverName = 'EdgeWebDriver';
const ChromeDriverExeName = 'chromedriver.exe'
const GeckoDriverExeName = 'geckodriver.exe';
const IEDriverExeName = 'IEDriverServer.exe';
const EdgeDriverExeName = 'MicrosoftWebDriver.exe';

async function startInstaller() {
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    if (osPlat !== 'win32') {
        // Fail the task if os is not windows
        tl.setResult(tl.TaskResult.Failed, tl.loc('OnlyWindowsOsSupported'));
        return;
    }

    try {
        console.log(tl.loc('StartingInstaller'));
        console.log('==============================================================================');

        // Read task inputs.
        const chromeDriver = tl.getBoolInput('chromeDriver', false);
        const chromeDriverVersion = tl.getInput('chromeDriverVersion', false);
        const firefoxDriver = tl.getBoolInput('firefoxDriver', false);
        const firefoxDriverVersion = tl.getInput('firefoxDriverVersion', false);
        const ieDriver = tl.getBoolInput('ieDriver', false);
        const ieDriverVersion = tl.getInput('ieDriverVersion', false);
        const edgeDriver = tl.getBoolInput('edgeDriver', false);
        const edgeDriverVersion = tl.getInput('edgeDriverVersion', false);

        // Acquire and cache the user specified drivers.
        if (chromeDriver) {
            await acquireAndCacheDriverVersion(enums.Driver.ChromeWebDriver, chromeDriverVersion);
        }
        if (firefoxDriver) {
            await acquireAndCacheDriverVersion(enums.Driver.GeckoWebDriver, firefoxDriverVersion);
        }
        if (ieDriver) {
            await acquireAndCacheDriverVersion(enums.Driver.IEWebDriver, ieDriverVersion);
        }
        if (edgeDriver) {
            await acquireAndCacheDriverVersion(enums.Driver.EdgeWebDriver, edgeDriverVersion);
        }
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error.message);
    }
}

async function acquireAndCacheDriverVersion(driver: enums.Driver, driverVersion: string) {
    let driverName = getDriverName(driver);
    console.log(tl.loc('AcquiringDriver', driverName, driverVersion));

    driverVersion = toolLib.cleanVersion(driverVersion);
    if (driverVersion === undefined || driverVersion === null) {
        throw new Error(tl.loc('InvalidVersion'));
    }
    let driverArch = getDriverArch(driver);
    tl.debug(`Semantic version: ${driverVersion}, Architecture: ${driverArch}`);

    let toolPath = toolLib.findLocalTool(driverName, driverVersion, driverArch);

    if (!toolPath || toolPath === 'undefined') {
        tl.debug(`Could not find version ${driverVersion} of driver ${driverName}, will download it.`);
        let driverPath = getDownloadUrl(driver, driverVersion);
        let downloadDir = path.join(tl.getVariable('Agent.TempDirectory'));
        let downloadPath = path.join(downloadDir, getDriverExeName(driver));
        try {
            tl.debug(`Attempting download from ${driverPath} to ${downloadPath}`);
            await downloadutility.download(driverPath, downloadPath);
            tl.debug(`File downloaded to ${downloadPath}`);
        }
        catch (error) {
            tl.error(error.message);
            throw new Error(tl.loc('FailedToAcquireDriver'));
        }
        toolPath = await toolLib.cacheDir(downloadDir, driverName, driverVersion, driverArch);
        tl.debug(`Driver has been cached to ${toolPath}`);
    }
    else {
        tl.debug(`Found version ${driverVersion} of driver ${driverName} in cache.`);
        console.log(tl.loc('FileExists', toolPath));
    }

    console.log(tl.loc('SettingVariable', driverName, toolPath));
    tl.setVariable(driverName, toolPath);
}

function getDriverExeName(driver: enums.Driver) {
    switch (driver) {
        case enums.Driver.ChromeWebDriver: return ChromeDriverExeName;
        case enums.Driver.GeckoWebDriver: return GeckoDriverExeName;
        case enums.Driver.IEWebDriver: return IEDriverExeName;
        case enums.Driver.EdgeWebDriver: return EdgeDriverExeName;
        default: return null;
    }
}

function getDriverName(driver: enums.Driver) {
    switch (driver) {
        case enums.Driver.ChromeWebDriver: return ChromeDriverName;
        case enums.Driver.GeckoWebDriver: return GeckoDriverName;
        case enums.Driver.IEWebDriver: return IEDriverName;
        case enums.Driver.EdgeWebDriver: return EdgeDriverName;
        default: return null;
    }
}

function getDriverArch(driver: enums.Driver) {
    switch (driver) {
        case enums.Driver.ChromeWebDriver:
        case enums.Driver.EdgeWebDriver: return 'x86';
        case enums.Driver.IEWebDriver:
        case enums.Driver.GeckoWebDriver: return 'x64';
        default: return null;
    }
}

function getDownloadUrl(driver: enums.Driver, version: string) {
    switch (driver) {
        case enums.Driver.ChromeWebDriver: return `https://seleniumwebdrivers.azureedge.net/chromedrivers/${version}/chromedriver.exe`;
        case enums.Driver.GeckoWebDriver: return `https://seleniumwebdrivers.azureedge.net/firefoxdrivers/${version}/geckodriver.exe`;
        case enums.Driver.IEWebDriver: return `https://seleniumwebdrivers.azureedge.net/iedrivers/${version}/IEDriverServer.exe`;
        case enums.Driver.EdgeWebDriver: return `https://seleniumwebdrivers.azureedge.net/edgedrivers/${version}/MicrosoftWebDriver.exe`;
        default: return null;
    }
}

// Execution start
startInstaller();

