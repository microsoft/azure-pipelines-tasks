import ma = require('azure-pipelines-task-lib/mock-answer');

export function setEndpointData() {
    process.env["ENDPOINT_AUTH_AzureRMSpn"] = "{\"parameters\":{\"serviceprincipalid\":\"MOCK_SPN_ID\",\"serviceprincipalkey\":\"MOCK_SPN_KEY\",\"tenantid\":\"MOCK_TENANT_ID\"},\"scheme\":\"ServicePrincipal\"}";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "MOCK_SPN_ID";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "MOCK_SPN_KEY";
    process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "MOCK_TENANT_ID";
    process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "MOCK_SUBSCRIPTION_NAME";
    process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "MOCK_SUBSCRIPTION_ID";
    process.env["ENDPOINT_URL_AzureRMSpn"] = "https://management.azure.com/";
    process.env["ENDPOINT_DATA_AzureRMSpn_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
    process.env["ENDPOINT_DATA_AzureRMSpn_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://management.azure.com/";
    process.env["ENDPOINT_AUTH_SCHEME_AzureRMSpn"] = "publishprofile";
    process.env["ENDPOINT_DATA_AzureRMSpn_RESOURCEID"] = "MOCK_RESOURCE_ID/test/path/to/some/publishprofile/credentials/sample/url/with/at/least/nine/paths";
    process.env["ENDPOINT_DATA_AzureRMSpn_PUBLISHPROFILE"] = "MOCK_PUBLISHPROFILE";
}

export function setAgentsData() {
    process.env['TASK_TEST_TRACE'] = "1";
    process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
    process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
    process.env["AGENT_NAME"] = "author";
    process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    process.env["BUILD_BUILDID"] = 'Build.BuildId';
    process.env["USE_MSAL"] = "false";
}

export function mockTaskArgument():  ma.TaskLibAnswers{
        // provide answers for task mock
        let a: ma.TaskLibAnswers = <ma.TaskLibAnswers> {
            "which": {
                "cmd": "cmd"
            },
            "stats": {
                "webAppPkg.zip": {
                    "isFile": true
                },
                "publishxml.pubxml": {
                    "isFile": true
                },
                "webAppPkg": {
                    "isDirectory": true
                }
            },
            "osType": {
                "osType": "Linux"
            },
            "checkPath": {
                "cmd": true,
                "webAppPkg.zip": true,
                "publishxml.pubxml": true,
                "publishxml": true,
                "webAppPkg": true
            },
            "exist": {
                "webAppPkg.zip": true,
                "webAppPkg": true,
                "publishxml.pubxml": true,
                "publishxml": true
            }
        }

        return a;
}