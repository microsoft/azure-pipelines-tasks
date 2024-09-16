import * as mocker from "azure-pipelines-task-lib/lib-mocker";
import * as assert from "assert";

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.setStdStream({
    write: (msg) => null
});

tlClone.getVariable = variable => {
    if (variable.toLowerCase() === 'agent.version') return '2.120.0';
    return null;
}

export function publishJavaTelemetryTest() {
    before(() => {
        mocker.disable();
        mocker.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(() => {
        mocker.deregisterAll();
        mocker.disable();
    });

    beforeEach(() => {
        mocker.resetCache();
    });

    afterEach(() => {
        mocker.deregisterMock('azure-pipelines-task-lib/task');
    });

    it('Should print to console if taskName and javaTelemetryData are provided and Agent.Version >= 2.120', () => {
        let taskOutput = '';
        tlClone.setStdStream({
            write: (msg) => taskOutput += msg
        });

        mocker.registerMock('azure-pipelines-task-lib/task', tlClone);

        const originalConsole = console.log
        console.log = function (msg) {
            taskOutput += msg;
        }

        const javaCommon = require("../java-common");
        javaCommon.publishJavaTelemetry('testTask', 'testData');

        console.log = originalConsole;

        assert.ok(taskOutput.indexOf('testTask') > -1);
        assert.ok(taskOutput.indexOf('testData') > -1);
    });

    it('Should set debug message if taskName not provided', () => {
        let taskOutput = '';
        tlClone.setStdStream({
            write: (msg) => taskOutput += msg
        });

        mocker.registerMock('azure-pipelines-task-lib/task', tlClone);

        const javaCommon = require("../java-common");
        javaCommon.publishJavaTelemetry(null, 'test');

        assert.ok(taskOutput.indexOf('Failed to publish java telemetry. Agent version 2.120.0 or higher is required.') > -1);
    });

    it('Should set debug message if javaTelemetryData not provided', () => {
        let taskOutput = '';
        tlClone.setStdStream({
            write: (msg) => taskOutput += msg
        });

        mocker.registerMock('azure-pipelines-task-lib/task', tlClone);

        const javaCommon = require("../java-common");
        javaCommon.publishJavaTelemetry('testTask', null);

        assert.ok(taskOutput.indexOf('Failed to publish java telemetry. Agent version 2.120.0 or higher is required.') > -1);
    });

    it('Should set debug message if Agent.Version below allowed', () => {
        let taskOutput = '';
        tlClone.setStdStream({
            write: (msg) => taskOutput += msg
        });

        mocker.registerMock('azure-pipelines-task-lib/task',
            Object.assign(tlClone, {
                // Modify method at the end of tests, because properties are mutable
                getVariable: variable => {
                    if (variable.toLowerCase() === 'agent.version') return '2.100.1';
                    return null;
                }
            })
        );

        const javaCommon = require("../java-common");
        javaCommon.publishJavaTelemetry('test', 'test');

        assert.ok(taskOutput.indexOf('Failed to publish java telemetry. Agent version 2.120.0 or higher is required.') > -1);
    });

    it('Should correctly handle task lib error', () => {
        let taskOutput = '';
        tlClone.setStdStream({
            write: (msg) => taskOutput += msg
        });

        mocker.registerMock('azure-pipelines-task-lib/task',
            Object.assign(tlClone, {
                getVariable: variable => {
                    if (variable.toLowerCase() === 'agent.version') throw new Error('some test error');
                    return null;
                }
            })
        );

        const javaCommon = require("../java-common");
        javaCommon.publishJavaTelemetry('testTask', 'testData');

        assert.ok(taskOutput.indexOf('Failed to publish java telemetry:') > -1);
        assert.ok(taskOutput.indexOf('some test error') > -1);
    });
}
