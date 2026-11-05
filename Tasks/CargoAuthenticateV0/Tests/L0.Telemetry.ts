import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { commandFromString } from 'azure-pipelines-task-lib/taskcommand';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

const injectedCommand = '##vso[task.setvariable variable=CARGO_PATH_INJECTION]unexpected';

function assertNoInjectedCommand(stdout: string): void {
    for (const line of stdout.split(/\r?\n/)) {
        const markerIndex = line.indexOf('##vso[');
        if (markerIndex >= 0) {
            const command = commandFromString(line.substring(markerIndex));
            assert(!(command.command === 'task.setvariable' &&
                command.properties['variable'] === 'CARGO_PATH_INJECTION'),
                'The config path must not emit an agent command');
        }
    }
}

describe('CargoAuthenticate L0 Suite - Telemetry and Logging', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Telemetry', function() {
        it('emits telemetry on successful authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Telemetry emitted:') > 0,
                'Should emit telemetry on successful authentication');
            assert(tr.stdout.indexOf(testConstants.TestData.telemetryArea) > 0,
                `Should emit telemetry for area ${testConstants.TestData.telemetryArea}`);
            assert(tr.stdout.indexOf(testConstants.TestData.telemetryFeature) > 0,
                `Should emit telemetry for feature ${testConstants.TestData.telemetryFeature}`);
        });

        it('tracks internal feed auth count correctly', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"InternalFeedAuthCount": 1') > 0,
                'Should track internal feed auth count as 1');
        });

        it('handles telemetry errors without failing task', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__throwTelemetryError__'] = 'true';
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when telemetry throws error in finally block');
        });
    });

    describe('Logging and Debugging', function() {
        it('preserves ordinary config path diagnostics and their trailing newline', async () => {
            const configFilePath = 'directory with spaces/config.toml';
            const tr = await TestHelpers.runTest(testConstants.TestDataBuilder.withDefaults({
                [testConstants.TestEnvVars.configFilePath]: configFilePath
            }));

            TestHelpers.assertSuccess(tr);
            assert(tr.stdout.includes(`loc_mock_AuthenticatingThisConfigToml ${configFilePath}\n`),
                'The localized path diagnostic should remain unchanged');
            assert(tr.stdout.includes('Mock fs.readFileSync received original config path: true'),
                'The filesystem should receive the original path');
        });

        for (const newline of ['\n', '\r\n']) {
            it(`blocks logging commands in config paths containing ${JSON.stringify(newline)}`, async () => {
                const configFilePath = `directory${newline}${injectedCommand}${newline}config.toml`;
                const tr = await TestHelpers.runTest(testConstants.TestDataBuilder.withDefaults({
                    [testConstants.TestEnvVars.configFilePath]: configFilePath
                }));

                TestHelpers.assertSuccess(tr);
                assert(tr.stdout.includes(`loc_mock_AuthenticatingThisConfigToml ${configFilePath.replace('##vso[', '##_vso[')}\n`),
                    'The real task-lib filter should render the command marker inert');
                assert(tr.stdout.includes('Mock fs.readFileSync received original config path: true'),
                    'Filtering the log must not change the path used to read the config');
                assertNoInjectedCommand(tr.stdout);
            });
        }

        it('keeps logging commands in missing config paths inside the escaped error issue', async () => {
            const configFilePath = `missing\n${injectedCommand}\nconfig.toml`;
            const tr = await TestHelpers.runTest(testConstants.TestDataBuilder.withDefaults({
                [testConstants.TestEnvVars.configFilePath]: configFilePath,
                '__configFileExists__': 'false'
            }));

            TestHelpers.assertFailure(tr, { expectedError: 'ConfigTomlDoesNotExist' });
            assert(tr.stdout.includes(configFilePath.replace(/\n/g, '%0A')),
                'The path-bearing error should escape newlines in its issue command');
            assertNoInjectedCommand(tr.stdout);
        });

        it('keeps logging commands in config read failures inside the escaped error issue', async () => {
            const configFilePath = `unreadable\n${injectedCommand}\nconfig.toml`;
            const tr = await TestHelpers.runTest(testConstants.TestDataBuilder.withDefaults({
                [testConstants.TestEnvVars.configFilePath]: configFilePath,
                '__configFileReadError__': 'true'
            }));

            TestHelpers.assertFailure(tr, { expectedError: 'Unable to read config file:' });
            assert(tr.stdout.includes(configFilePath.replace(/\n/g, '%0A')),
                'The filesystem error should escape newlines in its issue command');
            assertNoInjectedCommand(tr.stdout);
        });

#if WIF
        it('blocks config path logging commands during WIF authentication', async () => {
            const configFilePath = `directory\n${injectedCommand}\nconfig.toml`;
            const tr = await TestHelpers.runTest(testConstants.TestDataBuilder.forWifAuth('test-registry', {
                [testConstants.TestEnvVars.configFilePath]: configFilePath,
                [testConstants.TestEnvVars.registryNames]: 'test-registry'
            }));

            TestHelpers.assertSuccess(tr);
            assert(tr.stdout.includes(`loc_mock_AuthenticatingThisConfigToml ${configFilePath.replace('##vso[', '##_vso[')}\n`),
                'WIF authentication should use the same real output filter');
            assert(tr.stdout.includes('Mock fs.readFileSync received original config path: true'),
                'WIF authentication should read the unchanged config path');
            TestHelpers.assertTelemetryEmitted(tr, { FederatedConnectionAuthCount: 1 });
            assertNoInjectedCommand(tr.stdout);
        });
#endif

        it('logs debug messages when SYSTEM_DEBUG is enabled', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemDebug] = 'true';
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with debug enabled');
            assert(tr.stdout.indexOf('##vso[task.debug]') >= 0,
                'Should log debug messages when SYSTEM_DEBUG is enabled');
        });

        it('logs correct environment variable names in output', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('CARGO_REGISTRIES_') > 0,
                'Should reference CARGO_REGISTRIES_ environment variables in output');
        });
    });
});
