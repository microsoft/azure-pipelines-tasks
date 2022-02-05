var jsonSubUtil = require('azure-pipelines-tasks-webdeployment-common-v4/jsonvariablesubstitutionutility.js');
import fs = require('fs');
import path = require('path');

var envVarObject = jsonSubUtil.createEnvTree([
    { name: 'dataSourceBindings.0.target', value: 'AppServiceName', secret: false},
    { name: 'name', value: 'App Service Deploy', secret: false},
    { name: 'Hello.World', value: 'Hello World', secret: false},
    { name: 'dataSourceBindings.1.parameters.WebAppName', value: 'App Service Name params', secret: false},
    { name: 'messages.Invalidwebapppackageorfolderpathprovided', value: 'Invalidwebapppackageorfolderpathprovided', secret: true}
]);

function validateJSONWithComments() {
    var fileContent: string = fs.readFileSync(path.join(__dirname, 'L1JSONVarSub', 'JSONWithComments.json'), 'utf-8');
    var jsonContent: string = jsonSubUtil.stripJsonComments(fileContent);
    var jsonObject = JSON.parse(jsonContent);
    jsonSubUtil.substituteJsonVariable(jsonObject, envVarObject);

    if(jsonObject['dataSourceBindings']['0']['target'] != 'AppServiceName') {
        throw new Error('JSON VAR SUB FAIL #1');
    }
    if(jsonObject['name'] != 'App Service Deploy') {
        throw new Error('JSON VAR SUB FAIL #2');
    }
    if(jsonObject['Hello']['World'] != 'Hello World') {
        throw new Error('JSON VAR SUB FAIL #3');
    }
    if(jsonObject['dataSourceBindings']['1']['parameters']['WebAppName'] != 'App Service Name params') {
        throw new Error('JSON VAR SUB FAIL #4');
    }
    if(jsonObject['messages']['Invalidwebapppackageorfolderpathprovided'] != 'Invalidwebapppackageorfolderpathprovided') {
        throw new Error('JSON VAR SUB FAIL #5');
    }
    console.log("VALID JSON COMMENTS TESTS PASSED");
}

function validateInvalidJSONWithComments() {
    var fileContent: string = fs.readFileSync(path.join(__dirname, 'L1JSONVarSub', 'InvalidJSONWithComments.json'), 'utf-8');
    var jsonContent: string = jsonSubUtil.stripJsonComments(fileContent);
    try {
        var jsonObject = JSON.parse(jsonContent);
        throw new Error('JSON VAR SUB FAIL #6');
    }
    catch(error) {
        console.log("INVALID JSON COMMENTS TESTS PASSED");
    }
}

export function validate() {
    validateJSONWithComments();
    validateInvalidJSONWithComments();
}
