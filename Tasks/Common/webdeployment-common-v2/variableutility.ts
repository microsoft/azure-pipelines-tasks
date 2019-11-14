import tl = require('azure-pipelines-task-lib');

export function isPredefinedVariable(variable: string): boolean {
    var predefinedVarPrefix = ['agent.', 'azure_http_user_agent', 'build.', 'common.', 'release.', 'system.', 'tf_'];
    for(let varPrefix of predefinedVarPrefix) {
        if(variable.toLowerCase().startsWith(varPrefix)) {
            return true;
        }
    }
    return false;
}

export function isEmpty(object){
    if(object == null || object == "" || (object.toString()).trim() == null || (object.toString()).trim() == "")
        return true;
    return false;
}

export function isObject(object){
    if(object == null || object == "" || typeof(object) != 'object'){
        return false;
    }
    return true;
}

export function getVariableMap() {
    var variableMap = {};
    var taskVariables = tl.getVariables();
    for(var taskVariable of taskVariables) {
        if(!isPredefinedVariable(taskVariable.name)) {
            variableMap[taskVariable.name] = taskVariable.value;
        }
    }
    return variableMap;
}