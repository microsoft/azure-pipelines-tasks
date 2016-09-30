import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

function createEnvTree() {
    var envVarTree = {
        value: null,
        isEnd: false,
        child: {}
    };
    var envVariables = tl.getVariables();
    if(envVariables.length == 0) {
        throw new Error(tl.loc('UpgradeAgent'));
    }
    for(let envVariable of envVariables) {
        var envVarTreeIterator = envVarTree;
        var envVariableNameArray = (envVariable.name).split('.');
        
        for(let variableName of envVariableNameArray) {
            if(envVarTreeIterator.child[variableName] === undefined) {
                envVarTreeIterator.child[variableName] = {
                    value: null,
                    isEnd: false,
                    child: {}
                };
            }
            envVarTreeIterator = envVarTreeIterator.child[variableName];
        }
        envVarTreeIterator.isEnd = true;
        envVarTreeIterator.value = envVariable.value;
    }
    return envVarTree;
}

function checkEnvTreePath(jsonObjectKey, index, jsonObjectKeyLength, envVarTree) {
    if(index == jsonObjectKeyLength) {
        return envVarTree;
    }
    if(envVarTree.child[ jsonObjectKey[index] ] === undefined) {
        return undefined;
   }
    return checkEnvTreePath(jsonObjectKey, index + 1, jsonObjectKeyLength, envVarTree.child[ jsonObjectKey[index] ]);
}

function substituteJSONVariable(jsonObject, envObject) {
    for(var jsonChild in jsonObject) {
        var jsonChildArray = jsonChild.split('.');
        var resultNode = checkEnvTreePath(jsonChildArray, 0, jsonChildArray.length, envObject);
        if(resultNode != undefined) {
            if(resultNode.isEnd && typeof jsonObject[jsonChild] !== "object") {
                jsonObject[jsonChild] = resultNode.value;
            }
            else {
                substituteJSONVariable(jsonObject[jsonChild], resultNode);
            }
        }
    }
}

export function jsonVariableSubstitution(absolutePath, jsonSubFiles) {
    var files = [];
    for(let jsonSubFile of jsonSubFiles) {
        var matchFiles = tl.glob(path.join(absolutePath, jsonSubFile));
        if(matchFiles.length === 0) {
            throw new Error(tl.loc('NOJSONfilematchedwithspecificpattern'));
        }
        for(let matchFile of matchFiles) {
            if(path.extname(matchFile) !== '.json') {
                throw new Error(tl.loc('JSONvariablesubstitutioncanonlybeappliedforJSONfiles'));
            }
            files.push(matchFile);
        }
    }
    var envVarObject = createEnvTree();
    for(let file of files) {
        var fileContent:string = fs.readFileSync(file, 'utf8').toString();
        if(fileContent.indexOf('\uFEFF') === 0) {
            fileContent = fileContent.slice(1);
        }
        var jsonObject = JSON.parse(fileContent);
        substituteJSONVariable(jsonObject, envVarObject);
        tl.writeFile(file, JSON.stringify(jsonObject));
    }
}