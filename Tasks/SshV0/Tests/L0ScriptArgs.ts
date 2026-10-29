import assert = require('assert');
import os = require('os');
import path = require('path');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { PassThrough } from 'stream';

const tmr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'ssh.js'));
tmr.setInput('sshEndpoint', 'ScriptArgsEndpoint');
tmr.setInput('runOptions', 'script');
tmr.setInput('scriptPath', __filename);
tmr.setInput('args', process.env['SSH_TEST_ARGS']);
tmr.setInput('readyTimeout', '20000');

tmr.registerMockExport('getEndpointAuthorizationParameter', () => 'test');
tmr.registerMockExport('getEndpointDataParameter', (_id: string, key: string) => key === 'port' ? '22' : 'localhost');
tmr.registerMockExport('getPathInput', () => __filename);
tmr.registerMockExport('getBoolFeatureFlag', (name: string) => name === 'AZP_75787_ENABLE_NEW_LOGIC');
tmr.registerMockExport('getPipelineFeature', (name: string) => name === 'EnablePowerShellArgQuoting');
tmr.registerMock('os', { ...os, platform: () => 'linux' });
tmr.registerMock('./ssh2helpers', {
    RemoteCommandOptions: class {},
    setupSshClientConnection: async () => ({
        exec: (command: string, callback: (error: Error, stream: PassThrough & { stderr: PassThrough }) => void) => {
            assert.strictEqual(command, 'Get-Host | Out-Null');
            const stream = Object.assign(new PassThrough(), { stderr: new PassThrough() });
            const exitCode = process.env['SSH_TEST_POWERSHELL'] === 'true' ? 0 : 127;
            callback(null, stream);
            process.nextTick(() => {
                console.log(`SHELL_PROBE:${exitCode}`);
                stream.emit('close', exitCode);
            });
        },
        end: () => {}
    }),
    copyScriptToRemoteMachine: async () => {},
    runCommandOnRemoteMachine: async (command: string) => {
        console.log(`SCRIPT_EXECUTED:${command}`);
        return '0';
    }
});

tmr.run();
