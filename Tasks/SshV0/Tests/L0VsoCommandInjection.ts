import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import { EventEmitter } from 'events';

let taskPath = path.join(__dirname, '..', 'ssh.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('sshEndpoint', 'IDValidPwd');
tmr.setInput('commands', 'cat motd.txt');
tmr.setInput('runOptions', 'commands');
tmr.setInput('readyTimeout', '20000');
tmr.setInput('enableRemoteVsoCommands', process.env['enableRemoteVsoCommands'] || 'false');

// Mock the task-lib endpoint lookups so the task uses password authentication.
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getEndpointAuthorizationParameter = function (id: string, key: string, optional: boolean) {
    key = key.toUpperCase();
    if (key == 'USERNAME') {
        return 'user';
    }
    if (key == 'PASSWORD') {
        return 'password';
    }
    if (optional) {
        return '';
    }
    throw new Error(`Endpoint auth data not present: ${id}`);
};
tlClone.getEndpointDataParameter = function (id: string, key: string, optional: boolean) {
    key = key.toUpperCase();
    if (key == 'HOST') {
        return 'localhost';
    }
    if (key == 'PORT') {
        return '22';
    }
    if (optional) {
        return '';
    }
    throw new Error(`Endpoint auth data not present: ${id}`);
};
tlClone.getPipelineFeature = function (featureName: string): boolean {
    return featureName === 'redirectTaskOutputToProcessStdout';
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

// Mock ssh2 so the "remote machine" emits a malicious ##vso logging command as its output.
class MockStream extends EventEmitter {
    public stderr: EventEmitter;

    constructor() {
        super();
        this.stderr = new EventEmitter();
    }

    public write(): boolean {
        return true;
    }

    public end(): void {
        // no-op
    }
}

class MockClient extends EventEmitter {
    public connect(): MockClient {
        process.nextTick(() => this.emit('ready'));
        return this;
    }

    public exec(command: string, cb: (err: Error, stream: MockStream) => void): MockClient {
        const stream = new MockStream();
        cb(null, stream);
        process.nextTick(() => {
            if (process.env['splitVsoCommand'] === 'true') {
                stream.emit('data', Buffer.from('##v'));
                stream.emit('data', Buffer.from('so[task.setvariable variable=INJECTED]hacked\n'));
            } else {
                stream.emit('data', Buffer.from('##vso[task.setvariable variable=INJECTED]hacked\n'));
            }
            stream.emit('close', 0, null);
        });
        return this;
    }

    public end(): void {
        // no-op
    }
}

tmr.registerMock('ssh2', { Client: MockClient });

tmr.run();
