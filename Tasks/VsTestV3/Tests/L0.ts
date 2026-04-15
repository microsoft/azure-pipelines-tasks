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
});