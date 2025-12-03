/* import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'azureclitask.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Test invalid connectionType input - should throw error
tmr.setInput('connectionType', 'invalidConnectionType');
tmr.setInput('scriptType', 'bash');
tmr.setInput('scriptLocation', 'inlineScript');
tmr.setInput('inlineScript', 'echo "test"');
tmr.setInput('failOnStandardError', 'false');
tmr.setInput('visibleAzLogin', 'false');
tmr.setInput('useGlobalConfig', 'false');
tmr.setInput('cwd', 'C:\\test');

process.env['AGENT_TEMPDIRECTORY'] = 'C:\\ado\\temp';

process.env['AZP_AZURECLIV2_SETUP_PROXY_ENV'] = 'false';
process.env['ShowWarningOnOlderAzureModules'] = 'false';
process.env['UseAzVersion'] = 'false';

let mockAnswers: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "az": "az",
        "bash": "bash"
    },
    "checkPath": {
        "az": true,
        "bash": true
    },
    "exec": {
        "az --version": {
            "code": 0,
            "stdout": "azure-cli 2.50.0"
        }
    },
    "exists": {
        "bash": true,
        "C:\\ado\\temp": true,
        "C:\\ado": true
    }
};

tmr.setAnswers(mockAnswers);

tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', {
    getSystemAccessToken: () => 'system-token'
});

tmr.registerMock('./src/Utility', {
    Utility: {
        throwIfError: () => {},
        checkIfAzurePythonSdkIsInstalled: () => true
    }
});

tmr.registerMock('./src/ScriptType', {
    ScriptTypeFactory: {
        getScriptType: () => ({
            getTool: () => Promise.resolve({
                on: (event: string, callback: Function) => {
                    // Mock event handler
                },
                exec: (options: any) => {
                    return Promise.resolve(0);
                }
            }),
            cleanUp: () => Promise.resolve()
        })
    }
});

tmr.run(); */