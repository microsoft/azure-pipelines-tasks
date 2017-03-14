import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');

var varUtility = require ('./variableutility.js');
var fileEncoding = require('./fileencoding.js');
var utility = require('./utility.js');
export function createEnvTree(envVariables) {
    // __proto__ is marked as null, so that custom object can be assgined.
    // This replacement do not affect the JSON object, as no inbuilt JSON function is referenced.
    var envVarTree = {
        value: null,
        isEnd: false,
        child: {
            '__proto__': null
        }
    };
    for(let envVariable of envVariables) {
        var envVarTreeIterator = envVarTree;
        if(varUtility.isPredefinedVariable(envVariable.name)) {
            continue;
        } 
        var envVariableNameArray = (envVariable.name).split('.');
        
        for(let variableName of envVariableNameArray) {
            if(envVarTreeIterator.child[variableName] === undefined || typeof envVarTreeIterator.child[variableName] === 'function') {
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
    if(envVarTree.child[ jsonObjectKey[index] ] === undefined || typeof envVarTree.child[ jsonObjectKey[index] ] === 'function') {
        return undefined;
   }
    return checkEnvTreePath(jsonObjectKey, index + 1, jsonObjectKeyLength, envVarTree.child[ jsonObjectKey[index] ]);
}

export function substituteJsonVariable(jsonObject, envObject) {
    for(var jsonChild in jsonObject) {
        var jsonChildArray = jsonChild.split('.');
        var resultNode = checkEnvTreePath(jsonChildArray, 0, jsonChildArray.length, envObject);
        if(resultNode != undefined) {
            if(resultNode.isEnd && typeof jsonObject[jsonChild] !== "object") {
                tl.debug('substituting value on key: ' + jsonChild);
                jsonObject[jsonChild] = resultNode.value;
            }
            else {
                substituteJsonVariable(jsonObject[jsonChild], resultNode);
            }
        }
    }
}

export function jsonVariableSubstitution(absolutePath, jsonSubFiles) {
    var envVarObject = createEnvTree(tl.getVariables());
    for(let jsonSubFile of jsonSubFiles) {
        tl.debug('JSON variable substitution for ' + jsonSubFile);
        var matchFiles = utility.findfiles(path.join(absolutePath, jsonSubFile));
        if(matchFiles.length === 0) {
            throw new Error(tl.loc('NOJSONfilematchedwithspecificpattern', jsonSubFile));
        }
        for(let file of matchFiles) {
            if(path.extname(file) !== '.json') {
                throw new Error(tl.loc('JSONvariablesubstitutioncanonlybeappliedforJSONfiles'));
            }
            var fileBuffer: Buffer = fs.readFileSync(file);
            var fileEncodeType = fileEncoding.detectFileEncoding(file, fileBuffer);
            var fileContent: string = fileBuffer.toString(fileEncodeType[0]);
            if(fileEncodeType[1]) {
                fileContent = fileContent.slice(1);
            }
            try {
                var jsonObject = JSON.parse(fileContent);
            }
            catch(exception) {
                throw Error(tl.loc('JSONParseError', file, exception));
            }
            tl.debug('Applying JSON variable substitution for ' + file);
            substituteJsonVariable(jsonObject, envVarObject);
            tl.writeFile(file, (fileEncodeType[1] ? '\uFEFF' : '') + JSON.stringify(jsonObject, null, 4), fileEncodeType[0]);
        }
    }
}