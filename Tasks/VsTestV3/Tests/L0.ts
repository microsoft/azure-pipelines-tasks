import * as path from 'path';
import * as assert from 'assert';
import * as tl from 'azure-pipelines-task-lib';
import * as fs from 'fs';
import * as libMocker from 'azure-pipelines-task-lib/lib-mocker';

describe('VsTest Suite', function() {
    this.timeout(90000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before((done) => {
        done();
    });

    it('InputDataContract parity between task and dtaExecutionhost', (done: Mocha.Done) => {
        console.log('TestCaseName: InputDataContract parity between task and dtaExecutionhost');

        console.log('\n');

        // Read the output of the parity tool and get the json representation of the C# data contract class
        const inputDataContractParityTool = tl.tool(path.join(__dirname, './InputDataContractParityTool.exe'));
        inputDataContractParityTool.arg('../_build/Tasks/VsTestV3/Modules/MS.VS.TestService.Common.dll');
        const inputDataContractParityToolOutput = JSON.parse(inputDataContractParityTool.execSync().stdout);

        // Read the typescript representation of the data contract interface
        const inputDataContractInterfaceFileContents = fs.readFileSync('../Tasks/VsTestV3/inputdatacontract.ts', 'utf8').toString();
        const listOfInterfaces = inputDataContractInterfaceFileContents.replace(/export interface (.*) \{([\s][^{}]*)+\}(\s)*/g, '$1 ').trim().split(' ');

        const interfacesDictionary: { [key: string]: any } = <{ [key: string]: any }>{};

        listOfInterfaces.forEach(interfaceName => {
            const regex = new RegExp(interfaceName + ' \\{\\s([\\s][^\\{\\}]*)+\\}');
            const interfaceContents = inputDataContractInterfaceFileContents.match(regex)[1];

            const interfaceProperties = interfaceContents.replace(/(\w+) \: (\w+([\[\]])*)\;/g, '$1 $2').split('\n');
            const interfacePropertiesDictionary: { [key: string]: string } = <{ [key: string]: string }>{};
            interfaceProperties.forEach(property => {
                property = property.trim();
                interfacePropertiesDictionary[property.split(' ')[0]] = property.split(' ')[1];
            });

            interfacesDictionary[interfaceName] = interfacePropertiesDictionary;
        });

        console.log('#######################################################################################################################');
        console.log('Ensure that the interfaces file is well formatted without extra newlines or whitespaces as the parser this test uses depends on the correct formatting of the inputdatacontract.ts file');
        console.log('#######################################################################################################################');

        checkParity(inputDataContractParityToolOutput, interfacesDictionary, interfacesDictionary.InputDataContract);

        function checkParity(dataContractObject: any, interfacesDictionary: any, subInterface: any) {

            if (dataContractObject === null || dataContractObject === undefined) {
                return;
            }

            const keys = Object.keys(dataContractObject);

            for (const index in Object.keys(dataContractObject)) {

                if (typeof dataContractObject[keys[index]] !== 'object') {

                    //console.log(`${keys[index]}:${dataContractObject[keys[index]]} ===> ${subInterface.hasOwnProperty(keys[index])}, ${subInterface[keys[index]] === dataContractObject[keys[index]]}`);
                    assert(subInterface.hasOwnProperty(keys[index]), `${keys[index]} not present in the typescript version of the data contract.`);
                    assert(subInterface[keys[index]] === dataContractObject[keys[index]], `Data type of ${keys[index]} in typescript is ${subInterface[keys[index]]} and in C# is ${dataContractObject[keys[index]]}`);
                    delete subInterface[keys[index]];

                } else {
                    //console.log(`${keys[index]}:${JSON.stringify(dataContractObject[keys[index]])} ===> ${subInterface.hasOwnProperty(keys[index])}`);
                    assert(subInterface.hasOwnProperty(keys[index]), `${keys[index]} not present in the typescript version of the data contract.`);
                    checkParity(dataContractObject[keys[index]], interfacesDictionary, interfacesDictionary[keys[index]]);
                    delete subInterface[keys[index]];
                }
            }

            //console.log(JSON.stringify(subInterface));
            assert(Object.keys(subInterface).length === 1, `${JSON.stringify(subInterface)} properties are not present in the C# data contract.`);
        }

        done();
    });
});

// ---------------------------------------------------------------------------
// versionfinder.ts unit tests (PowerShell Get-ItemProperty change)
// ---------------------------------------------------------------------------

function createMockToolRunner(stdout: string) {
    return {
        arg: function() { return this; },
        line: function() { return this; },
        execSync: function() {
            return { stdout, stderr: '', code: 0 };
        }
    };
}

function createSequentialMockToolRunners(outputs: string[]) {
    let callIndex = 0;
    return function() {
        const stdout = callIndex < outputs.length ? outputs[callIndex] : '';
        callIndex++;
        return createMockToolRunner(stdout);
    };
}

const mockCi = { publishEvent: function(_data: object) {} };
const mockRegedit = {};

function makeTlMock(powershellStdout: string) {
    return {
        tool: function(_toolName: string) {
            return createMockToolRunner(powershellStdout);
        },
        error: function(_msg: string) {},
        warning: function(_msg: string) {},
        debug: function(_msg: string) {},
        loc: function(key: string, ...args: any[]) {
            return args.length ? `${key}:${args.join(',')}` : key;
        },
        getVariable: function(_name: string) { return ''; },
        assertAgent: function(_version: string) {}
    };
}

function makeTlMockWithSequentialOutputs(outputs: string[]) {
    const toolFactory = createSequentialMockToolRunners(outputs);
    return {
        tool: toolFactory,
        error: function(_msg: string) {},
        warning: function(_msg: string) {},
        debug: function(_msg: string) {},
        loc: function(key: string, ...args: any[]) {
            return args.length ? `${key}:${args.join(',')}` : key;
        },
        getVariable: function(_name: string) { return ''; },
        assertAgent: function(_version: string) {}
    };
}

function makeHelpersMock(fileExists: boolean = true) {
    return {
        Helper: {
            pathExistsAsFile: function(_p: string) { return fileExists; },
            pathExistsAsDirectory: function(_p: string) { return false; },
            isNullOrWhitespace: function(s: string) {
                return s === null || s === undefined || s.replace(/\s/g, '').length < 1;
            },
            trimString: function(s: string) { return s ? s.trim() : s; },
            getVSVersion: function(v: number) { return v.toString(); },
            isToolsInstallerFlow: function(_config: any) { return false; },
            getVsTestConsoleExeName: function() { return 'vstest.console.exe'; },
            locVsTestConsole: function(key: string, ...args: any[]) {
                return args.length ? `${key}:${args.join(',')}` : key;
            }
        },
        Constants: {
            vsTestLocationString: 'location',
            vsTestVersionString: 'version'
        }
    };
}

const fakeVsTestLocation = 'C:\\VS\\IDE\\Extensions\\TestPlatform\\vstest.console.exe';

function makeTestConfig(vsTestVersion: string = '17.0'): any {
    return {
        vsTestVersion,
        vsTestLocationMethod: 'location',
        vsTestLocation: fakeVsTestLocation,
        vsTestVersionDetails: null
    };
}

function loadVersionfinder() {
    return require('../versionfinder') as typeof import('../versionfinder');
}

describe('VsTestV3 – versionfinder.ts (PowerShell Get-ItemProperty change)', function() {
    this.timeout(10000);

    before(function() {
        libMocker.enable({ useCleanCache: true, warnOnUnregistered: false });
    });

    after(function() {
        libMocker.disable();
    });

    afterEach(function() {
        libMocker.deregisterAll();
        libMocker.resetCache();
    });

    function setupMocks(powershellOutput: string, fileExists: boolean = true) {
        libMocker.registerMock('azure-pipelines-task-lib/task', makeTlMock(powershellOutput));
        libMocker.registerMock('azure-pipelines-task-lib/toolrunner', {});
        libMocker.registerMock('./helpers', makeHelpersMock(fileExists));
        libMocker.registerMock('./cieventlogger', mockCi);
        libMocker.registerMock('regedit', mockRegedit);
    }

    function setupMocksWithSequentialOutputs(outputs: string[], fileExists: boolean = true) {
        libMocker.registerMock('azure-pipelines-task-lib/task', makeTlMockWithSequentialOutputs(outputs));
        libMocker.registerMock('azure-pipelines-task-lib/toolrunner', {});
        libMocker.registerMock('./helpers', makeHelpersMock(fileExists));
        libMocker.registerMock('./cieventlogger', mockCi);
        libMocker.registerMock('regedit', mockRegedit);
    }

    it('parses VS2022 (v17) version string returned directly by PowerShell', function() {
        setupMocks('17.0.33.0\n');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails, 'vsTestVersionDetails should be set');
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 17);
        assert.strictEqual(config.vsTestVersionDetails.minorversion, 0);
        assert.strictEqual(config.vsTestVersionDetails.patchNumber, 33);
    });

    it('parses v15 version string and sets Dev15VSTestVersion', function() {
        setupMocks('15.9.28307.1500\n');
        const vf = loadVersionfinder();
        const config = makeTestConfig('15.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails, 'vsTestVersionDetails should be set');
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 15);
        assert.strictEqual(config.vsTestVersionDetails.minorversion, 9);
        assert.strictEqual(config.vsTestVersionDetails.patchNumber, 28307);
    });

    it('parses v14 version string and sets Dev14VSTestVersion', function() {
        setupMocks('14.0.25420.0\n');
        const vf = loadVersionfinder();
        const config = makeTestConfig('14.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails, 'vsTestVersionDetails should be set');
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 14);
        assert.strictEqual(config.vsTestVersionDetails.minorversion, 0);
        assert.strictEqual(config.vsTestVersionDetails.patchNumber, 25420);
    });

    it('correctly trims trailing whitespace/newline from PowerShell output', function() {
        setupMocks('17.0.33.0\r\n');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails);
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 17);
    });

    it('uses three-part version (no fourth segment) when output has exactly 3 parts', function() {
        setupMocks('17.0.33');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails);
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 17);
        assert.strictEqual(config.vsTestVersionDetails.patchNumber, 33);
    });

    it('skips PowerShell and hard-codes version 16.0.0 for the v16.0 temporary hack', function() {
        setupMocks('SHOULD_NOT_PARSE');
        const vf = loadVersionfinder();
        const config = makeTestConfig('16.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails, 'vsTestVersionDetails should still be set via the 16.0 hack');
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 16);
        assert.strictEqual(config.vsTestVersionDetails.minorversion, 0);
        assert.strictEqual(config.vsTestVersionDetails.patchNumber, 0);
    });

    it('throws when PowerShell returns empty output', function() {
        setupMocks('');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        assert.throws(
            () => vf.getVsTestRunnerDetails(config),
            (err: Error) => err.message === 'ErrorReadingVstestVersion',
            'should throw ErrorReadingVstestVersion for empty output'
        );
    });

    it('throws when PowerShell returns only whitespace', function() {
        setupMocks('   \n   ');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        assert.throws(
            () => vf.getVsTestRunnerDetails(config),
            (err: Error) => err.message === 'ErrorReadingVstestVersion'
        );
    });

    it('throws UnexpectedVersionString when output has fewer than 3 dot-separated parts', function() {
        setupMocks('17.0');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        assert.throws(
            () => vf.getVsTestRunnerDetails(config),
            (err: Error) => err.message.startsWith('UnexpectedVersionString'),
            'should throw UnexpectedVersionString for a two-part version'
        );
    });

    it('throws UnexpectedVersionString when version parts are non-numeric', function() {
        setupMocks('abc.def.ghi.jkl');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        assert.throws(
            () => vf.getVsTestRunnerDetails(config),
            (err: Error) => err.message.startsWith('UnexpectedVersionString'),
            'should throw UnexpectedVersionString for non-numeric version parts'
        );
    });

    it('extracts version from text with surrounding non-numeric content (regression #21998)', function() {
        setupMocks('VSTest version 18.3.0 (x64)\n');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails, 'vsTestVersionDetails should be set');
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 18);
        assert.strictEqual(config.vsTestVersionDetails.minorversion, 3);
        assert.strictEqual(config.vsTestVersionDetails.patchNumber, 0);
    });

    it('throws UnexpectedVersionString when output has no digits at all', function() {
        setupMocks('hdhdh.djjd.djjd.jdjd');
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        assert.throws(
            () => vf.getVsTestRunnerDetails(config),
            (err: Error) => err.message.startsWith('UnexpectedVersionString'),
            'should throw UnexpectedVersionString for output with no digits'
        );
    });

    it('falls back to wmic when primary Get-ItemProperty returns empty', function() {
        setupMocksWithSequentialOutputs(['', 'Version=17.0.33.0\n']);
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        vf.getVsTestRunnerDetails(config);

        assert.ok(config.vsTestVersionDetails, 'vsTestVersionDetails should be set via wmic fallback');
        assert.strictEqual(config.vsTestVersionDetails.majorVersion, 17);
        assert.strictEqual(config.vsTestVersionDetails.minorversion, 0);
        assert.strictEqual(config.vsTestVersionDetails.patchNumber, 33);
    });

    it('throws ErrorReadingVstestVersion when both primary and wmic fallback return empty', function() {
        setupMocksWithSequentialOutputs(['', '']);
        const vf = loadVersionfinder();
        const config = makeTestConfig('17.0');

        assert.throws(
            () => vf.getVsTestRunnerDetails(config),
            (err: Error) => err.message === 'ErrorReadingVstestVersion',
            'should throw ErrorReadingVstestVersion when both methods fail'
        );
    });
});

// ---------------------------------------------------------------------------
// helpers.ts unit tests (arm64 vstest.console name resolution)
// ---------------------------------------------------------------------------

const localizedStrings: { [key: string]: string } = {
    // Mirrors the shipped strings, which embed the exe name rather than taking it as a parameter.
    nonDistributedTestWorkflow: 'Running tests using vstest.console.exe runner.',
    VstestDiagNotSupported: 'vstest.console.exe version does not support the /diag flag.',
    VstestLocationDoesNotExist: "The location of 'vstest.console.exe' specified '%s' does not exist.",
    NoExeNameInHere: 'Nothing to substitute here.'
};

function makeTlMockForHelpers(variables: { [key: string]: string }) {
    return {
        getVariable: function(name: string) { return variables[name]; },
        debug: function(_msg: string) {},
        warning: function(_msg: string) {},
        error: function(_msg: string) {},
        loc: function(key: string, ...args: any[]) {
            const template = localizedStrings[key] || key;
            return args.length ? template.replace('%s', args[0]) : template;
        },
        tool: function() { return createMockToolRunner(''); }
    };
}

function loadHelpers(variables: { [key: string]: string }, arch: string) {
    libMocker.registerMock('azure-pipelines-task-lib/task', makeTlMockForHelpers(variables));
    libMocker.registerMock('azure-pipelines-task-lib/toolrunner', {});
    libMocker.registerMock('./cieventlogger', mockCi);
    libMocker.registerMock('os', { arch: function() { return arch; }, tmpdir: function() { return 'C:\\temp'; } });
    return require('../helpers') as typeof import('../helpers');
}

describe('VsTestV3 – helpers.ts (arm64 vstest.console name)', function() {
    this.timeout(10000);

    const ARM64_EXE = 'vstest.console.arm64.exe';
    const DEFAULT_EXE = 'vstest.console.exe';

    before(function() {
        libMocker.enable({ useCleanCache: true, warnOnUnregistered: false });
    });

    after(function() {
        libMocker.disable();
    });

    afterEach(function() {
        libMocker.deregisterAll();
        libMocker.resetCache();
    });

    it('defaults to vstest.console.exe before the feature flag is resolved', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'arm64');

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), DEFAULT_EXE);
    });

    it('uses the arm64 name when the flag is on and the agent is arm64', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'arm64');

        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), ARM64_EXE);
    });

    it('keeps the default name when the flag is on but the agent is x64', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'X64' }, 'x64');

        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), DEFAULT_EXE);
    });

    it('keeps the default name when the agent is arm64 but the flag is off', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'arm64');

        helpers.Helper.setArm64VsTestConsoleEnabled(false);

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), DEFAULT_EXE);
    });

    it('matches Agent.OSArchitecture case-insensitively', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'arm64' }, 'x64');

        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), ARM64_EXE);
    });

    it('prefers Agent.OSArchitecture over os.arch() for an emulated x64 agent on arm64 hardware', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'x64');

        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), ARM64_EXE);
    });

    it('falls back to os.arch() when Agent.OSArchitecture is not set', function() {
        const helpers = loadHelpers({}, 'arm64');

        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), ARM64_EXE);
    });

    it('falls back to os.arch() and stays default when the agent is not arm64', function() {
        const helpers = loadHelpers({}, 'x64');

        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(helpers.Helper.getVsTestConsoleExeName(), DEFAULT_EXE);
    });

    it('substitutes the exe name inside a localized string when enabled', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'arm64');
        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(
            helpers.Helper.locVsTestConsole('nonDistributedTestWorkflow'),
            'Running tests using vstest.console.arm64.exe runner.');
    });

    it('leaves the localized string untouched when disabled', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'arm64');
        helpers.Helper.setArm64VsTestConsoleEnabled(false);

        assert.strictEqual(
            helpers.Helper.locVsTestConsole('nonDistributedTestWorkflow'),
            'Running tests using vstest.console.exe runner.');
    });

    it('substitutes the exe name while preserving loc format arguments', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'arm64');
        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(
            helpers.Helper.locVsTestConsole('VstestLocationDoesNotExist', 'C:\\some\\path'),
            "The location of 'vstest.console.arm64.exe' specified 'C:\\some\\path' does not exist.");
    });

    it('leaves a localized string with no exe name unchanged', function() {
        const helpers = loadHelpers({ 'Agent.OSArchitecture': 'ARM64' }, 'arm64');
        helpers.Helper.setArm64VsTestConsoleEnabled(true);

        assert.strictEqual(helpers.Helper.locVsTestConsole('NoExeNameInHere'), 'Nothing to substitute here.');
    });
});

// ---------------------------------------------------------------------------
// runvstest.ts unit tests (TCM resource area + feature flag lookup)
// ---------------------------------------------------------------------------

interface FakeResponse {
    err?: Error;
    statusCode?: number;
    body?: any;
}

function makeRequestMock(responses: { [urlFragment: string]: FakeResponse }, capturedUrls: string[]) {
    return function(options: any, callback: (err: any, res: any, body: any) => void) {
        capturedUrls.push(options.url);
        const match = Object.keys(responses).find(fragment => options.url.indexOf(fragment) !== -1);
        const response = match ? responses[match] : { statusCode: 404, body: undefined };
        callback(response.err, { statusCode: response.statusCode }, response.body);
    };
}

function loadRunVsTest(responses: { [urlFragment: string]: FakeResponse }, capturedUrls: string[]) {
    // os.platform() is forced off win32 so importing the module takes the "unsupported OS" branch
    // and reports a failure instead of running the whole task.
    libMocker.registerMock('os', { platform: function() { return 'linux'; }, arch: function() { return 'x64'; } });
    libMocker.registerMock('request', makeRequestMock(responses, capturedUrls));
    libMocker.registerMock('azure-pipelines-task-lib/task', {
        setResourcePath: function() {},
        setResult: function() {},
        getVariable: function() { return ''; },
        getInput: function() { return ''; },
        debug: function() {},
        warning: function() {},
        error: function() {},
        loc: function(key: string) { return key; },
        TaskResult: { Failed: 1 }
    });
    libMocker.registerMock('./nondistributedtest', {});
    libMocker.registerMock('./distributedtest', {});
    libMocker.registerMock('./cieventlogger', mockCi);
    libMocker.registerMock('./helpers', makeHelpersMock());
    libMocker.registerMock('./inputparser', {});
    libMocker.registerMock('./vstest', {});
    return require('../runvstest') as typeof import('../runvstest');
}

describe('VsTestV3 – runvstest.ts (TCM resource area and feature flags)', function() {
    this.timeout(10000);

    const collectionUri = 'https://dev.azure.com/fakeorg/';
    const tcmUrl = 'https://fakeorg.vstmr.visualstudio.com/';
    const tcmAreaId = '00000054-0000-8888-8000-000000000000';
    const flagName = 'TestExecution.EnableArm64VstestConsole';

    before(function() {
        libMocker.enable({ useCleanCache: true, warnOnUnregistered: false });
    });

    after(function() {
        libMocker.disable();
    });

    afterEach(function() {
        libMocker.deregisterAll();
        libMocker.resetCache();
    });

    it('resolves the TCM service url from the resource area response', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/resourceAreas': { statusCode: 200, body: { locationUrl: tcmUrl } } }, urls);

        const resolved = await rv.getServiceUrlFromResourceArea(collectionUri, tcmAreaId, 'token');

        assert.strictEqual(resolved, tcmUrl);
        assert.strictEqual(urls[0], `https://dev.azure.com/fakeorg/_apis/resourceAreas/${tcmAreaId}?api-version=5.0-preview.1`);
    });

    it('falls back to the collection uri when the resource area returns no locationUrl', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/resourceAreas': { statusCode: 404, body: undefined } }, urls);

        const resolved = await rv.getServiceUrlFromResourceArea(collectionUri, tcmAreaId, 'token');

        assert.strictEqual(resolved, collectionUri);
    });

    it('falls back to the collection uri when the resource area request errors', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/resourceAreas': { err: new Error('socket hang up') } }, urls);

        const resolved = await rv.getServiceUrlFromResourceArea(collectionUri, tcmAreaId, 'token');

        assert.strictEqual(resolved, collectionUri);
    });

    it('returns true when the feature flag effectiveState is On', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/FeatureFlags': { statusCode: 200, body: { effectiveState: 'On' } } }, urls);

        assert.strictEqual(await rv.isFeatureFlagEnabled(tcmUrl, flagName, 'token'), true);
    });

    it('is case-insensitive about the effectiveState value', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/FeatureFlags': { statusCode: 200, body: { effectiveState: 'ON' } } }, urls);

        assert.strictEqual(await rv.isFeatureFlagEnabled(tcmUrl, flagName, 'token'), true);
    });

    it('returns false when the feature flag effectiveState is Off', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/FeatureFlags': { statusCode: 200, body: { effectiveState: 'Off' } } }, urls);

        assert.strictEqual(await rv.isFeatureFlagEnabled(tcmUrl, flagName, 'token'), false);
    });

    it('returns false without throwing when the flag is unknown to the service', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/FeatureFlags': { statusCode: 404, body: { message: 'not found' } } }, urls);

        assert.strictEqual(await rv.isFeatureFlagEnabled(tcmUrl, flagName, 'token'), false);
    });

    it('returns false when the feature flag request errors', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/FeatureFlags': { err: new Error('ETIMEDOUT') } }, urls);

        assert.strictEqual(await rv.isFeatureFlagEnabled(tcmUrl, flagName, 'token'), false);
    });

    it('does not produce a double slash when the service url has a trailing slash', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/FeatureFlags': { statusCode: 200, body: { effectiveState: 'On' } } }, urls);

        await rv.isFeatureFlagEnabled(collectionUri, flagName, 'token');

        assert.strictEqual(urls[0], `https://dev.azure.com/fakeorg/_apis/FeatureFlags/${flagName}`);
        assert.strictEqual(urls[0].indexOf('//_apis'), -1, 'url should not contain a double slash');
    });

    it('builds the same url when the service url has no trailing slash', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({ '_apis/FeatureFlags': { statusCode: 200, body: { effectiveState: 'On' } } }, urls);

        await rv.isFeatureFlagEnabled('https://dev.azure.com/fakeorg', flagName, 'token');

        assert.strictEqual(urls[0], `https://dev.azure.com/fakeorg/_apis/FeatureFlags/${flagName}`);
    });

    it('queries the feature flag against the resolved TCM url, not the collection uri', async function() {
        const urls: string[] = [];
        const rv = loadRunVsTest({
            '_apis/resourceAreas': { statusCode: 200, body: { locationUrl: tcmUrl } },
            '_apis/FeatureFlags': { statusCode: 200, body: { effectiveState: 'On' } }
        }, urls);

        const resolved = await rv.getServiceUrlFromResourceArea(collectionUri, tcmAreaId, 'token');
        await rv.isFeatureFlagEnabled(resolved, flagName, 'token');

        assert.strictEqual(urls[1], `https://fakeorg.vstmr.visualstudio.com/_apis/FeatureFlags/${flagName}`);
    });
});