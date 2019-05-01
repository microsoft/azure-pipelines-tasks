import ma = require('vsts-task-lib/mock-answer');

export function extendObject(output, target) {
    output = output || {};
    
    if (target) {
        for (var key in target) {
            if (target.hasOwnProperty(key)) {
                output[key] = target[key];
            }
        }
    }

    return output;
}

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
}

export function setAgentsData() {
    process.env['TASK_TEST_TRACE'] = 1;
    process.env["AZURE_HTTP_USER_AGENT"] = "TFS_useragent";
    process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "DefaultWorkingDirectory";
    process.env["AGENT_NAME"] = "author";
    process.env["AGENT_TEMPDIRECTORY"] = 'Agent.TempDirectory';
    process.env["BUILD_BUILDID"] = 'Build.BuildId';
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
                },
                "/home/site/wwwroot": {
                    "isDirectory": true,
                    "isFile": false
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
                "publishxml": true,
                "/home/site/wwwroot": true
            }
        }

        return a;
}

export function mockTaskInputParameters(tr) {
    tr.setInput('azureSubscription', 'AzureRMSpn');
    tr.setInput('appName', 'mytestapp');
    tr.setInput('imageName', 'dockernamespace/dockerrepository:DockerImageTag');
    tr.setInput('AppSettings', '-port 1173');
    tr.setInput('multicontainerConfigFile', '/home/site/wwwroot');
}