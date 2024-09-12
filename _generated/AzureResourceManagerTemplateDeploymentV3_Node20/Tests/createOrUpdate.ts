import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
const fs = require('fs');
var cpExec = require('child_process').execSync;

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", "Create Or Update Resource Group");
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("resourceGroupName", "dummy");
tr.setInput("location", "West US");
tr.setInput("templateLocation", "Linked artifact")
tr.setInput("csmFile", process.env["csmFile"]);
tr.setInput("overrideParameters", "");
tr.setInput("deploymentMode", "Complete");
tr.setInput("enableDeploymentPrerequisites", "None");
tr.setInput("csmParametersFile", process.env["csmParametersFile"]);
tr.setInput("deploymentOutputs", !!process.env["deploymentOutputs"] ? process.env["deploymentOutputs"] : "");

process.env["ENDPOINT_AUTH_AzureRM"] = "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALID"] = "id";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_SERVICEPRINCIPALKEY"] = "key";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_TENANTID"] = "tenant";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID"] = "sId";
process.env["ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME"] = "sName";
process.env["ENDPOINT_URL_AzureRM"] = "https://management.azure.com/";
process.env["ENDPOINT_DATA_AzureRM_ENVIRONMENTAUTHORITYURL"] = "https://login.windows.net/";
process.env["ENDPOINT_DATA_AzureRM_ACTIVEDIRECTORYSERVICEENDPOINTRESOURCEID"] = "https://management.azure.com";
process.env["ENDPOINT_AUTH_SCHEME_AzureRM"] = "serviceprincipal";
process.env["ENDPOINT_AUTH_PARAMETER_AzureRM_AUTHENTICATIONTYPE"] = "key";

var CSMJson = path.join(__dirname, "CSM.json");
var CSMBicep = path.join(__dirname, "CSMwithBicep.bicep");
var CSMBicepWithSpaceInPath = path.join(__dirname, "CSMwithBicep WithSpaceInPath.bicep");
var CSMBicepParam = path.join(__dirname, "CSMwithBicep.bicepparam");
var CSMBicepParamWithEnv = path.join(__dirname, "CSMwithBicep.prod.bicepparam");
var CSMBicepWithWarning = path.join(__dirname, "CSMwithBicepWithWarning.bicep");
var CSMBicepWithError = path.join(__dirname, "CSMwithBicepWithError.bicep");
var CSMwithComments = path.join(__dirname, "CSMwithComments.json");
var defaults = path.join(__dirname, "defaults.json");
var faultyCSM = path.join(__dirname, "faultyCSM.json");
var bicepbuildCmd = `az bicep build --file ${path.join(__dirname, "CSMwithBicep.bicep")}`;
var bicepbuildwithspaceinpathCmd = `az bicep build --file "${path.join(__dirname, "CSMwithBicep WithSpaceInPath.bicep")}"`;
var bicepparambuildCmd = `az bicep build-params --file ${path.join(__dirname, "CSMwithBicep.bicepparam")} --outfile ${path.join(__dirname, "CSMwithBicep.parameters.json")}`;
var bicepparambuildwithenvironmentCmd = `az bicep build-params --file ${path.join(__dirname, "CSMwithBicep.prod.bicepparam")} --outfile ${path.join(__dirname, "CSMwithBicep.parameters.json")}`;
var bicepbuildwithWarning = `az bicep build --file ${path.join(__dirname, "CSMwithBicepWithWarning.bicep")}`;
var azloginCommand = `az login --service-principal -u "id" --password="key" --tenant "tenant" --allow-no-subscriptions`;
var azaccountSet = `az account set --subscription "sId"`;
var azlogoutCommand = `az account clear`

var exec = {}
const successExec = {
    "code": 0,
    "stdout": "Executed Successfully"
}
exec[bicepbuildCmd] = successExec;
exec[bicepbuildwithspaceinpathCmd] = successExec;
exec[bicepparambuildCmd] = successExec;
exec[bicepparambuildwithenvironmentCmd] = successExec;
exec[bicepbuildwithWarning] = successExec;
exec[azloginCommand] = successExec;
exec[azaccountSet] = successExec;
exec[azlogoutCommand] = successExec;

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "az": "az"
    },
    "checkPath": {
        "az": true
    },
    exec,
    "findMatch": {
        "CSM.json": [CSMJson],
        "CSMwithBicep.bicep": [CSMBicep],
        "CSMwithBicep WithSpaceInPath.bicep": [CSMBicepWithSpaceInPath],
        "CSMwithBicep.bicepparam": [CSMBicepParam],
        "CSMwithBicep.prod.bicepparam": [CSMBicepParamWithEnv],
        "CSMwithBicepWithWarning.bicep": [CSMBicepWithWarning],
        "CSMwithBicepWithError.bicep": [CSMBicepWithError],
        "CSMwithComments.json": [CSMwithComments],
        "defaults.json": [defaults],
        "faultyCSM.json": [faultyCSM],
        "CSMNotThere.json": [],
        "CSMmultiple.json": [CSMJson, CSMJson],
        "": [""]
    }
};

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tr.setAnswers(a);

tr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));
tr.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-resource', require('./mock_node_modules/azure-arm-resource'));

const fsClone = Object.assign({}, fs);
fsClone.readFileSync = function(fileName: string): Buffer {
    if (fileName.indexOf("CSMwithBicep.json") >= 0 || fileName.indexOf("CSMwithBicepWithWarning.json") >= 0) {
        const filePath = fileName.replace('.json', '.bicep');
        cpExec(`az bicep build --file ${filePath}`);
    }
    else if (fileName.indexOf("CSMwithBicep.parameters.json") >= 0) {
        const filePath = fileName.replace('.parameters.json', '.bicepparam');
        cpExec(`az bicep build-params --file ${filePath} --outfile ${fileName}`);
    }
    var buffer = fs.readFileSync(fileName);
    return buffer;
}
tr.registerMock('fs', fsClone);
tr.run();