import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("action", "Create Or Update Resource Group");
tr.setInput("ConnectedServiceName", "AzureRM");
tr.setInput("resourceGroupName", "dummy");
tr.setInput("location", "West US");
tr.setInput("templateLocation", "Linked Artifact")
tr.setInput("csmFile", __dirname + "\\CSM.json");
tr.setInput("overrideParameters", "");
tr.setInput("deploymentMode","Complete");        
tr.setInput("csmParametersFile", __dirname + "\\CSM.json" );


let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
  "getVariable": {
    "ENDPOINT_AUTH_AzureRM": "{\"parameters\":{\"serviceprincipalid\":\"id\",\"serviceprincipalkey\":\"key\",\"tenantid\":\"tenant\"},\"scheme\":\"ServicePrincipal\"}",
    "ENDPOINT_DATA_AzureRM_SUBSCRIPTIONID": "sId",
    "ENDPOINT_DATA_AzureRM_SUBSCRIPTIONNAME": "sName"
  }
};
tr.setAnswers(a);
tr.registerMock('vsts-task-lib/toolrunner', require('vsts-task-lib/mock-toolrunner'));
tr.run();