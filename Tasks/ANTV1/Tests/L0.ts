import assert = require('assert');
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import path = require('path');
import os = require('os');

var isWindows = os.type().match(/^Win/);

describe('ANT Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('run ANT with all inputs', async () => {
        const testPath = path.join(__dirname, 'L0AllInputs.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert(runner.invokedToolCount == 2, 'should have only run ANT 2 times');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.succeeded, 'task should have succeeded');
    })

    it('fails if missing antBuildFile input', async () => {
        const testPath = path.join(__dirname, 'L0MissingAntBuildFile.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Input required: antBuildFile'), 'wrong error message');
    })

    it('fails if missing javaHomeSelection input', async () => {
        const testPath = path.join(__dirname, 'L0MissingJavaHomeSelection.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Input required: javaHomeSelection'), 'wrong error message"');
    })

    it('fails if missing testResultsFiles input', async () => {
        const testPath = path.join(__dirname, 'L0MissingTestResultsFiles.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Input required: testResultsFiles'), 'wrong error message:"');
    })

    it('run ANT with antHomeUserInputPath', async () => {
        const testPath = path.join(__dirname, 'L0RunWithAntHomeUserInputPath.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert(runner.invokedToolCount == 2, 'should have only run ANT 2 times');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.succeeded, 'task should have succeeded');
        assert(runner.stdOutContained('Set ANT_HOME to /usr/local/bin/ANT2'), 'ANT_HOME not set correctly');
    })

    it('run ANT with antHomeUserInputPath set to invalid path', async () => {
        const testPath = path.join(__dirname, 'L0InvalidUserHomePath.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.invokedToolCount == 0, 'should not have run ANT');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('Not found /usr/local/bin/ANT_invalid'), 'Invalid path not detected');
    })

    it('run ANT with ANT_HOME not set', async () => {
        const testPath = path.join(__dirname, 'L0AntHomeNotSet.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        // The response file will cause ANT to fail, but we are looking for the warning about ANT_HOME
        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.invokedToolCount == 1, 'should have only run ANT once');
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('The ANT_HOME environment variable is not set'), 'Missing JAVA_HOME not detected');
    })

    it('run ANT with jdkVersion set to 1.8', async () => {
        const testPath = path.join(__dirname, 'L0JDKSetTo8.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();
        
        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert.strictEqual(runner.invokedToolCount, 2, 'should have run ANT 2 times');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.succeeded, 'task should have succeeded');
        assert(runner.stdOutContained('Set JAVA_HOME to /user/local/bin/ANT8'), 'JAVA_HOME not set correctly');
    })

    it('run ANT with jdkVersion set to 1.5', async () => {
        const testPath = path.join(__dirname, 'L0JDKSetTo5.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        if (isWindows) {
            assert.strictEqual(runner.invokedToolCount, 1, 'should have run the reg query toolrunner');
        } else {
            assert.strictEqual(runner.invokedToolCount, 0, 'should not have run tools');
        }
        assert(runner.failed, 'task should have failed');
        assert(runner.stdOutContained('FailedToLocateSpecifiedJVM'), 'Should write FailedToLocateSpecifiedJVM error');
    })

    it('run ANT valid inputs but it fails', async () => {
        const testPath = path.join(__dirname, 'L0FailWithValidInputs.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        // The response file will cause ANT to fail, but we are looking for the warning about ANT_HOME
        assert(runner.ran('/usr/local/bin/ANT -version'), 'it should have run ANT -version');
        assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml'), 'it should have run ANT -buildfile ...');
        assert(runner.invokedToolCount == 2, 'should have only run ANT 2 times');
        assert(runner.failed, 'task should have failed');
    })

    it('Ant build with Publish Test Results.', async () => {
        const testPath = path.join(__dirname, 'L0PublishTestResults.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.succeeded, 'The task should not have failed');
        assert(runner.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0);
    })

    it('Ant build with Publish Test Results with no matching test result files.', async () => {
        const testPath = path.join(__dirname, 'L0NoMatchingTestResults.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.stdout.search(/##vso\[results.publish\]/) < 0, 'publish test results should have not got called.');
        assert(runner.stderr.length == 0, 'should not have written to stderr');
        assert(runner.stdOutContained('NoTestResults'), 'should have warned about lack of test results');
        assert(runner.stdOutContained('**/InvalidTestFilter-*.xml'), 'should preserve the unmatched test pattern');
        assert(!runner.stdOutContained('feature=ExternalOutputVsoCommand;'),
            'An ordinary unmatched pattern should not produce command telemetry');
        assert(runner.succeeded, 'task should have succeeded');
    })

    it('Ant build with Publish Test Results for failed builds.', async () => {
        const testPath = path.join(__dirname, 'L0FailedBuilds.js')
        const runner: MockTestRunner = new MockTestRunner(testPath);
        await runner.runAsync();

        assert(runner.stdout.search(/##vso\[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=\/user\/build\/fun\/test-123.xml;\]/) >= 0);
    })

    const processScenarios = ['version', 'build', 'coverage', 'failedBuild', 'failedBuildError'];
    processScenarios.forEach(scenario => {
        it(`blocks and reports Ant process logging commands for ${scenario}`, async () => {
            const previousScenario = process.env['ANT_PROCESS_SCENARIO'];
            process.env['ANT_PROCESS_SCENARIO'] = scenario;

            try {
                const runner = new MockTestRunner(path.join(__dirname, 'L0ExternalProcessOutput.js'));
                await runner.runAsync();

                const expectFailure = scenario === 'failedBuild' || scenario === 'failedBuildError';
                assert.strictEqual(runner.failed, expectFailure, 'Build failures should still fail the task');
                assert.strictEqual(runner.succeeded, !expectFailure, 'Successful builds should still succeed');
                assert(runner.stdOutContained('ordinary stdout'), 'Ordinary stdout should remain visible');
                assert(runner.stdOutContained('ordinary stderr'), 'Ordinary stderr should remain visible');
                ['Stdout', 'Stderr'].forEach(stream => {
                    const command = '[task.setvariable variable=AntProcess' + stream + 'Marker;]unexpected-' + stream.toLowerCase();
                    assert(runner.stdOutContained('##_vso' + command), 'The process command marker should be neutralized');
                    assert(!runner.stdOutContained('##vso' + command), 'The process command marker should not reach the log unchanged');
                });
                const telemetry = runner.stdout.split(/\r?\n/).filter(line =>
                    line.startsWith('##vso[telemetry.publish area=TaskLib;feature=ExternalOutputVsoCommand;]'));
                assert.strictEqual(telemetry.length, scenario === 'failedBuildError' ? 5 : 2,
                    'Each stdout, stderr, displayed-command or execution-error marker should produce telemetry');
                telemetry.forEach(line => {
                    const event = JSON.parse(line.substring(line.indexOf(']') + 1));
                    assert.strictEqual(event.source, 'childProcess');
                    assert.strictEqual(event.commandName, 'task.setvariable');
                    assert.strictEqual(event.blocked, true);
                    assert(!line.includes('AntProcess') && !line.includes('unexpected-'),
                        'Telemetry should not contain command properties or data');
                });
                if (scenario === 'coverage') {
                    assert(runner.ran('/usr/local/bin/ANT -buildfile /build/build.xml CodeCoverage_9064e1d0'),
                        'The coverage-report command should run');
                    assert(runner.stdOutContained('codecoverage.publish'), 'Coverage publishing should continue');
                }
                if (scenario === 'failedBuildError') {
                    assert(runner.stderr.includes('##_vso[task.setvariable variable=AntProcessErrorMarker;]unexpected-error'),
                        'The execution error should stay on stderr with its marker neutralized');
                    assert(!runner.stderr.includes('##vso['), 'Stderr should not contain an executable logging command');
                }
            } finally {
                if (previousScenario === undefined) {
                    delete process.env['ANT_PROCESS_SCENARIO'];
                } else {
                    process.env['ANT_PROCESS_SCENARIO'] = previousScenario;
                }
            }
        });
    });

    const debugScenarios = ['homes', 'coverage', 'error'];
    debugScenarios.forEach(scenario => {
        ['\n', '\r\n'].forEach(separator => {
            it(`filters external debug output for ${scenario} with ${JSON.stringify(separator)}`, async () => {
                const value = 'debug-input' + separator +
                    '##vso[task.setvariable variable=AntDebugMarker;]unexpected';
                const previousScenario = process.env['ANT_DEBUG_SCENARIO'];
                const previousValue = process.env['ANT_DEBUG_VALUE'];
                process.env['ANT_DEBUG_SCENARIO'] = scenario;
                process.env['ANT_DEBUG_VALUE'] = value;

                try {
                    const runner = new MockTestRunner(path.join(__dirname, 'L0ExternalDebugOutput.js'));
                    await runner.runAsync();

                    assert.strictEqual(runner.failed, scenario === 'error', 'Task outcome should be preserved');
                    assert.strictEqual(runner.succeeded, scenario !== 'error', 'Successful scenarios should complete');
                    assert.strictEqual(runner.stderr.length, 0, 'The fixture should not encounter an unhandled error');
                    const home = '/home/' + value;
                    const messages = scenario === 'error' ? [value] : [
                        'Set ANT_HOME to ' + home,
                        'Set JAVA_HOME to ' + home
                    ];
                    if (scenario === 'coverage') {
                        const buildRoot = path.join('/build', value);
                        messages.push(
                            'Error removing previous cc files: Error: ' + value,
                            'Summary file = ' + path.join(buildRoot, 'CCReport43F6D5EF', 'summary.xml'),
                            'Report directory = ' + path.join(buildRoot, 'CCReport43F6D5EF')
                        );
                    }
                    messages.forEach(message => {
                        const encoded = message.replace(/##vso\[/g, '##_vso[')
                            .replace(/%/g, '%AZP25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
                        assert(runner.stdOutContained('##vso[task.debug]' + encoded),
                            'External text should be filtered and remain in a single structured debug message');
                    });
                    const telemetry = runner.stdout.split(/\r?\n/).filter(line =>
                        line.startsWith('##vso[telemetry.publish area=TaskLib;feature=ExternalOutputVsoCommand;]') &&
                        JSON.parse(line.substring(line.indexOf(']') + 1)).source === 'repository');
                    assert.strictEqual(telemetry.length, messages.length, 'Each filtered debug message should report the marker');
                    telemetry.forEach(line => {
                        const event = JSON.parse(line.substring(line.indexOf(']') + 1));
                        assert.strictEqual(event.source, 'repository');
                        assert.strictEqual(event.commandName, 'task.setvariable');
                        assert.strictEqual(event.blocked, true);
                        assert(!line.includes('AntDebugMarker') && !line.includes('unexpected'),
                            'Telemetry should not contain command properties or data');
                    });
                } finally {
                    if (previousScenario === undefined) {
                        delete process.env['ANT_DEBUG_SCENARIO'];
                    } else {
                        process.env['ANT_DEBUG_SCENARIO'] = previousScenario;
                    }
                    if (previousValue === undefined) {
                        delete process.env['ANT_DEBUG_VALUE'];
                    } else {
                        process.env['ANT_DEBUG_VALUE'] = previousValue;
                    }
                }
            });
        });
    });

    const patternSeparators = [' ', '\n', '\r\n'];
    patternSeparators.forEach(separator => {
        it(`neutralizes and reports logging commands in unmatched test patterns with ${JSON.stringify(separator)}`, async () => {
            const pattern = '**/InvalidTestFilter-*.xml' + separator +
                '##vso[task.setvariable variable=AntDiagnosticMarker;]unexpected' + separator +
                '##vso[task.setvariable variable=AntOtherDiagnosticMarker;]unexpected';
            const previousPattern = process.env['ANT_TEST_RESULTS_PATTERN'];
            process.env['ANT_TEST_RESULTS_PATTERN'] = pattern;

            try {
                const testPath = path.join(__dirname, 'L0NoMatchingTestResults.js');
                const runner = new MockTestRunner(testPath);
                await runner.runAsync();

                assert(runner.succeeded, 'No matching test results should not fail the task');
                assert(runner.stdOutContained(pattern.replace(/##vso\[/g, '##_vso[')),
                    'The diagnostic should display all command markers as neutralized text');
                assert(!runner.stdout.split(/\r?\n/).some(line => {
                    const command = /##vso\[([^\s\]]+)/.exec(line);
                    return command && command[1] === 'task.setvariable';
                }), 'The diagnostic should not emit a variable-setting logging command');
                const telemetry = runner.stdout.split(/\r?\n/).filter(line =>
                    line.startsWith('##vso[telemetry.publish area=TaskLib;feature=ExternalOutputVsoCommand;]'));
                assert.strictEqual(telemetry.length, 2, 'Each blocked command should produce one telemetry event');
                telemetry.forEach(line => {
                    const event = JSON.parse(line.substring(line.indexOf(']') + 1));
                    assert.strictEqual(event.source, 'repository');
                    assert.strictEqual(event.commandName, 'task.setvariable');
                    assert.strictEqual(event.blocked, true);
                    assert(!line.includes('AntDiagnosticMarker') && !line.includes('AntOtherDiagnosticMarker'),
                        'Telemetry should not contain command properties');
                    assert(!line.includes('unexpected'), 'Telemetry should not contain command data');
                });
            } finally {
                if (previousPattern === undefined) {
                    delete process.env['ANT_TEST_RESULTS_PATTERN'];
                } else {
                    process.env['ANT_TEST_RESULTS_PATTERN'] = previousPattern;
                }
            }
        });
    });
});
