export var nock = require('nock');
import ma = require('azure-pipelines-task-lib/mock-answer');
import querystring = require("querystring");

export const MOCK_SUBSCRIPTION_ID = 'mocksub';
export const MOCK_RESOURCE_GROUP_NAME = 'mockrg';
export const ASC_RESOURCE_TYPE = 'Microsoft.AppPlatform/Spring';
export const API_VERSION = '2022-03-01-preview'


export function setEndpointData() {
    process.env["ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"MOCK_TENANT_ID\"},\"scheme\":\"ServicePrincipal\"}";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID"] = "MOCK_SPN_ID";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY"] = "MOCK_SPN_KEY";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID"] = "MOCK_TENANT_ID";
    process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = MOCK_SUBSCRIPTION_ID;
    process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";
    process.env["ENDPOINT_URL_AzureRM"] = "https://management.azure.com/";
    process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
    process.env["ENDPOINT_DATA_AzureRM_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://management.azure.com";
}

export function setAgentsData() {
    process.env['TASK_TEST_TRACE'] = '1';
    process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
    process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] = "DefaultWorkingDirectory";
    process.env["AGENT_NAME"] = "author";
    process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    process.env["BUILD_BUILDID"] = 'Build.BuildId';
}

export function printTaskInputs() {
    console.log('Task inputs:');
    getTaskInputs().forEach(input => console.log(input + ': ' + process.env[input]));
}

function getTaskInputs() {
    var inputNames = [];
    for (var variableName in process.env) {
        if (variableName.startsWith("INPUT_")) {
            inputNames.push(variableName);
        }
    }
    return inputNames;
}

/**
 * Deletes all inputs from prior tests that may have corrupted the environment
 */
export function cleanTaskInputs() {
    let inputNames = getTaskInputs();
    inputNames.forEach(variableName => delete process.env[variableName]);
    console.log('Deleted input variables: ' + inputNames);
}

export function mockCommonAzureAPIs() {
    console.log('Nock configuration running...');

    //Authentication
    //mock responses for Azure Resource Manager connection type
    nock("https://login.windows.net", {
        reqheaders: {
            "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        }
    })
        .post('/MOCK_TENANT_ID/oauth2/token/', querystring.stringify({
            resource: "https://management.azure.com/",
            client_id: "MOCK_SPN_ID",
            grant_type: "client_credentials",
            client_secret: "MOCK_SPN_KEY"
        }))
        .reply(200, {
            access_token: "DUMMY_ACCESS_TOKEN"
        }).persist();
}


export function mockAzureSpringCloudExists(springCloudName: string) {

    nock('https://management.azure.com', {
        reqheaders: {
            "authorization": "Bearer DUMMY_ACCESS_TOKEN",
            "content-type": "application/json; charset=utf-8",
            "user-agent": "TFS_useragent"
        }
    }).get(`/subscriptions/${MOCK_SUBSCRIPTION_ID}/resources?$filter=resourceType%20EQ%20%27Microsoft.AppPlatform%2FSpring%27%20AND%20name%20EQ%20%27${springCloudName}%27&api-version=2016-07-01`)
        .reply(200, {
            value: [{
                id: `/subscriptions/${MOCK_SUBSCRIPTION_ID}/resourceGroups/${encodeURIComponent(MOCK_RESOURCE_GROUP_NAME)}/providers/Microsoft.AppPlatform/Spring/${encodeURIComponent(springCloudName)}`,
                name: springCloudName,
                type: ASC_RESOURCE_TYPE,
                tags: {},
                properties: {}
            }]
        }).persist();
}

export function mockTaskArgument(): ma.TaskLibAnswers {
    // provide answers for task mock
    let mockFileSystem: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
        "which": {
            "cmd": "cmd"
        },
        "stats": {
            "dummy.jar": {
                "isFile": true
            }
        },
        "osType": {
            "osType": "Linux"
        },
        "checkPath": {
            "cmd": true,
            "dummy.jar": true
        },
        "exist": {
            "dummy.jar": true
        }
    }

    return mockFileSystem;
}
