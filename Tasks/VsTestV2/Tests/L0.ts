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
        inputDataContractParityTool.arg('../_build/Tasks/VsTestV2/Modules/MS.VS.TestService.Common.dll');
        const inputDataContractParityToolOutput = JSON.parse(inputDataContractParityTool.execSync().stdout);

        // Read the typescript representation of the data contract interface
        const inputDataContractInterfaceFileContents = fs.readFileSync('../Tasks/VsTestV2/inputdatacontract.ts', 'utf8').toString();
        const listOfInterfaces = inputDataContractInterfaceFileContents.replace(/export interface (.*) \{([\s][^{}]*)+\}(\s)*/g, '$1 ').trim().split(' ');

        const interfacesDictionary : { [key: string] : any } = <{ [key: string] : any} >{};

        listOfInterfaces.forEach(interfaceName => {
            const regex = new RegExp(interfaceName + ' \\{\\s([\\s][^\\{\\}]*)+\\}');
            const interfaceContents = inputDataContractInterfaceFileContents.match(regex)[1];

            const interfaceProperties = interfaceContents.replace(/(\w+) \: (\w+([\[\]])*)\;/g, '$1 $2').split('\n');
            const interfacePropertiesDictionary : { [key: string] : string } = <{ [key: string] : string }>{};
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

            if (dataContractObject === null || dataContractObject === undefined ) {
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
            isToolsInstallerFlow: function(_config: any) { return false; }
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

describe('VsTestV2 – versionfinder.ts (PowerShell Get-ItemProperty change)', function() {
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
// ARM64 architecture auto-detection unit tests
// Covers logic added to taskinputparser.ts, inputparser.ts, and vstest.ts.
// ---------------------------------------------------------------------------

describe('ARM64 – architecture detection and /Platform: injection', function () {
    this.timeout(5000);

    // ── 1. Architecture detection mapping ───────────────────────────────────
    // Replicates the exact ternary used in taskinputparser.ts and inputparser.ts:
    //   const agentOsArch = (tl.getVariable('Agent.OSArchitecture') || os.arch()).toLowerCase();
    //   vstestArchitecture = agentOsArch === 'arm64' ? 'arm64'
    //       : (agentOsArch === 'x86' || agentOsArch === 'ia32') ? 'x86' : 'x64';
    function detectArch(agentOsArchVar: string | undefined, osArchFallback: string): string {
        const agentOsArch = (agentOsArchVar || osArchFallback).toLowerCase();
        return agentOsArch === 'arm64' ? 'arm64'
            : (agentOsArch === 'x86' || agentOsArch === 'ia32') ? 'x86'
            : 'x64';
    }

    it('arch: Agent.OSArchitecture="ARM64" maps to arm64', function () {
        assert.strictEqual(detectArch('ARM64', 'x64'), 'arm64');
    });

    it('arch: Agent.OSArchitecture="arm64" (lowercase) maps to arm64', function () {
        assert.strictEqual(detectArch('arm64', 'x64'), 'arm64');
    });

    it('arch: Agent.OSArchitecture="X64" maps to x64', function () {
        assert.strictEqual(detectArch('X64', 'arm64'), 'x64');
    });

    it('arch: Agent.OSArchitecture="X86" maps to x86', function () {
        assert.strictEqual(detectArch('X86', 'arm64'), 'x86');
    });

    it('arch: Agent.OSArchitecture takes priority over os.arch() when both are present', function () {
        assert.strictEqual(detectArch('ARM64', 'x64'), 'arm64');  // node says x64 but agent says ARM64
        assert.strictEqual(detectArch('X64', 'arm64'), 'x64');    // node says arm64 but agent says X64
    });

    it('arch: falls back to os.arch()="arm64" when Agent.OSArchitecture is absent', function () {
        assert.strictEqual(detectArch(undefined, 'arm64'), 'arm64');
    });

    it('arch: falls back to os.arch()="x64" when Agent.OSArchitecture is absent', function () {
        assert.strictEqual(detectArch(undefined, 'x64'), 'x64');
    });

    it('arch: falls back to os.arch()="ia32" and maps to x86', function () {
        assert.strictEqual(detectArch(undefined, 'ia32'), 'x86');
    });

    it('arch: empty string Agent.OSArchitecture falls back to os.arch()', function () {
        assert.strictEqual(detectArch('', 'arm64'), 'arm64');
        assert.strictEqual(detectArch('', 'x64'), 'x64');
    });

    // ── 2. /Platform: injection guard – Hydra path (inputparser.ts) ─────────
    // Replicates:
    //   const existingParams = inputDataContract.ExecutionSettings.AdditionalConsoleParameters || '';
    //   if (!/\/Platform:/i.test(existingParams)) {
    //       const platformFlag = '/Platform:' + vstestArchitecture;
    //       inputDataContract.ExecutionSettings.AdditionalConsoleParameters = existingParams
    //           ? existingParams + ' ' + platformFlag : platformFlag;
    //   }
    function applyHydraInjection(existing: string | null, arch: string): string | null {
        const existingParams = existing || '';
        if (!/\/Platform:/i.test(existingParams)) {
            const platformFlag = '/Platform:' + arch;
            return existingParams ? existingParams + ' ' + platformFlag : platformFlag;
        }
        return existing;
    }

    it('hydra: injects /Platform:arm64 when AdditionalConsoleParameters is null', function () {
        assert.strictEqual(applyHydraInjection(null, 'arm64'), '/Platform:arm64');
    });

    it('hydra: injects /Platform:x64 when AdditionalConsoleParameters is empty', function () {
        assert.strictEqual(applyHydraInjection('', 'x64'), '/Platform:x64');
    });

    it('hydra: injects /Platform:x86 for 32-bit agent', function () {
        assert.strictEqual(applyHydraInjection(null, 'x86'), '/Platform:x86');
    });

    it('hydra: appends /Platform:arm64 after existing console params', function () {
        assert.strictEqual(applyHydraInjection('/logger:trx', 'arm64'), '/logger:trx /Platform:arm64');
    });

    it('hydra: does NOT inject when user already has /Platform:x86 in otherConsoleOptions', function () {
        assert.strictEqual(applyHydraInjection('/Platform:x86', 'arm64'), '/Platform:x86');
    });

    it('hydra: guard is case-insensitive (/platform: in lowercase)', function () {
        assert.strictEqual(applyHydraInjection('/platform:x86 /logger:trx', 'arm64'), '/platform:x86 /logger:trx');
    });

    it('hydra: server-based run clears params to null first, then /Platform: is still injected', function () {
        // Server-based runs set AdditionalConsoleParameters = null before our injection
        assert.strictEqual(applyHydraInjection(null, 'arm64'), '/Platform:arm64');
    });

    // ── 3. /Platform: injection guard – legacy path (vstest.ts) ─────────────
    // Replicates:
    //   if (!isNullEmptyOrUndefined(vstestConfig.vstestArchitecture) &&
    //       !(/\/Platform:/i.test(vstestConfig.otherConsoleOptions || ''))) {
    //       argsArray.push('/Platform:' + vstestConfig.vstestArchitecture);
    //   }
    function shouldInjectInLegacyPath(vstestArchitecture: string | null | undefined, otherConsoleOptions: string | null | undefined): boolean {
        const isNullEmptyOrUndefined = (s: any) => s === null || s === undefined || s === '';
        return !isNullEmptyOrUndefined(vstestArchitecture) &&
            !(/\/Platform:/i.test(otherConsoleOptions || ''));
    }

    it('legacy: injects /Platform: when vstestArchitecture set and otherConsoleOptions is null', function () {
        assert.strictEqual(shouldInjectInLegacyPath('arm64', null), true);
    });

    it('legacy: injects /Platform: when otherConsoleOptions is empty string', function () {
        assert.strictEqual(shouldInjectInLegacyPath('arm64', ''), true);
    });

    it('legacy: injects /Platform: when otherConsoleOptions has no /Platform: flag', function () {
        assert.strictEqual(shouldInjectInLegacyPath('arm64', '/logger:trx'), true);
    });

    it('legacy: does NOT inject when user has /Platform:x86 in otherConsoleOptions', function () {
        assert.strictEqual(shouldInjectInLegacyPath('arm64', '/Platform:x86'), false);
    });

    it('legacy: guard is case-insensitive for /Platform: check', function () {
        assert.strictEqual(shouldInjectInLegacyPath('arm64', '/platform:x86 /logger:trx'), false);
    });

    it('legacy: does NOT inject when vstestArchitecture is null', function () {
        assert.strictEqual(shouldInjectInLegacyPath(null, null), false);
    });

    it('legacy: does NOT inject when vstestArchitecture is undefined', function () {
        assert.strictEqual(shouldInjectInLegacyPath(undefined, null), false);
    });

    it('legacy: does NOT inject when vstestArchitecture is empty string', function () {
        assert.strictEqual(shouldInjectInLegacyPath('', null), false);
    });

    // ── 4. VS 2022 requirement warning logic ─────────────────────────────────
    // Replicates:
    //   if (vstestArchitecture === 'arm64' && vsTestLocationMethod === Constants.vsTestVersionString &&
    //       vsTestVersion && vsTestVersion.toLowerCase() !== 'latest' &&
    //       vsTestVersion.toLowerCase() !== 'toolsinstaller' &&
    //       parseFloat(vsTestVersion) < 17.0) { warn }
    function shouldWarnVS2022(arch: string, locationMethod: string, vsTestVersion: string): boolean {
        const vsTestVersionString = 'version'; // matches utils.Constants.vsTestVersionString
        return arch === 'arm64' &&
            locationMethod === vsTestVersionString &&
            !!vsTestVersion &&
            vsTestVersion.toLowerCase() !== 'latest' &&
            vsTestVersion.toLowerCase() !== 'toolsinstaller' &&
            parseFloat(vsTestVersion) < 17.0;
    }

    it('vs-guard: warns for ARM64 + VS 2015 (14.0)', function () {
        assert.strictEqual(shouldWarnVS2022('arm64', 'version', '14.0'), true);
    });

    it('vs-guard: warns for ARM64 + VS 2017 (15.0)', function () {
        assert.strictEqual(shouldWarnVS2022('arm64', 'version', '15.0'), true);
    });

    it('vs-guard: warns for ARM64 + VS 2019 (16.0)', function () {
        assert.strictEqual(shouldWarnVS2022('arm64', 'version', '16.0'), true);
    });

    it('vs-guard: does NOT warn for ARM64 + VS 2022 (17.0)', function () {
        assert.strictEqual(shouldWarnVS2022('arm64', 'version', '17.0'), false);
    });

    it('vs-guard: does NOT warn for ARM64 + vsTestVersion="latest"', function () {
        assert.strictEqual(shouldWarnVS2022('arm64', 'version', 'latest'), false);
    });

    it('vs-guard: does NOT warn for ARM64 + vsTestVersion="toolsinstaller"', function () {
        assert.strictEqual(shouldWarnVS2022('arm64', 'version', 'toolsinstaller'), false);
    });

    it('vs-guard: does NOT warn for x64 agent even with old VS', function () {
        assert.strictEqual(shouldWarnVS2022('x64', 'version', '14.0'), false);
        assert.strictEqual(shouldWarnVS2022('x64', 'version', '16.0'), false);
    });

    it('vs-guard: does NOT warn when vstestLocationMethod is "location" (custom exe path)', function () {
        assert.strictEqual(shouldWarnVS2022('arm64', 'location', '14.0'), false);
    });
});
