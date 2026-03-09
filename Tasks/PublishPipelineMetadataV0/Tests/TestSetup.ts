import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

// Get the task path
const taskPath = path.join(__dirname, '..', 'publishmetadata.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Mock the task library
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

// Override getVariable to return test environment variables
tlClone.getVariable = function (variable: string): string {
    return process.env[variable];
};

// Override getVariables to return all test variables
tlClone.getVariables = function (): any[] {
    const vars: any[] = [];
    for (const key in process.env) {
        if (key.startsWith('metadata') || key.startsWith('METADATA')) {
            vars.push({ name: key, value: process.env[key] });
        }
    }
    return vars;
};

// Override getEndpointAuthorizationParameter
tlClone.getEndpointAuthorizationParameter = function (id: string, key: string, optional: boolean): string {
    if (id === 'SYSTEMVSSCONNECTION' && key === 'ACCESSTOKEN') {
        return process.env['SYSTEM_ACCESSTOKEN'] || 'test-access-token';
    }
    return '';
};

tr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);
tr.registerMock('azure-pipelines-task-lib/task', tlClone);

// Mock the restutilities module
const mockResponse = {
    statusCode: process.env['MOCK_RESPONSE_STATUS_CODE'] ? parseInt(process.env['MOCK_RESPONSE_STATUS_CODE']) : 200,
    statusMessage: process.env['MOCK_RESPONSE_STATUS_MESSAGE'] || 'OK',
    body: process.env['MOCK_RESPONSE_BODY'] || '{"id": "test-id"}'
};

const restUtilities = {
    WebRequest: class {
        uri: string;
        method: string;
        body: string;
        headers: any;
    },
    sendRequest: function (request: any): Promise<any> {
        // Store the request for verification in tests
        console.log('Request sent to: ' + request.uri);
        console.log('Request body: ' + request.body);
        // Return synchronously resolved promise for testing
        return Promise.resolve(mockResponse);
    }
};

tr.registerMock('azure-pipelines-tasks-utility-common/restutilities', restUtilities);

// Start the run
tr.run();
