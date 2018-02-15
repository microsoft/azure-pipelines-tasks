import path = require('path');
import fs = require('fs');

// Adds mock exist, checkPath, rmRF and mkdirP responses for given file paths.
// Takes an object to add to and an array of file paths for which responses should be added.
// Modifies and returns the argument object.
export function setupMockResponsesForPaths(responseObject: any, paths: string[]) { // Can't use rest arguments here (gulp-mocha complains)

    // Create empty objects for responses only if they did not already exist (avoid overwriting existing responses)
    responseObject.exist = responseObject.exist || {};
    responseObject.checkPath = responseObject.checkPath || {};
    responseObject.rmRF = responseObject.rmRF || {};
    responseObject.mkdirP = responseObject.mkdirP || {};
    responseObject.stats = responseObject.stats || {};

    var rmRFSuccessObj = {
        success: true,
        message: "foo bar"
    };

    paths.forEach((path) => {
        responseObject.exist[path] = true;
        responseObject.checkPath[path] = true;
        responseObject.rmRF[path] = rmRFSuccessObj;
        responseObject.mkdirP[path] = true;
        responseObject.stats[path] = {isFile: true};
    });

    return responseObject;
}

// Creates a new response json file based on an initial one and some env variables 
export function setResponseAndBuildVars(responseJsonFilePath: string, newResponseFilePath: string, envVars: Array<[string, string]>) {

    var responseJsonContent = JSON.parse(fs.readFileSync(responseJsonFilePath, 'utf-8'));
    responseJsonContent.getVariable = responseJsonContent.getVariable || {};
    for (var envVar of envVars) {
        responseJsonContent.getVariable[envVar[0]] = envVar[1];
    }

    fs.writeFileSync(newResponseFilePath, JSON.stringify(responseJsonContent));
}