
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import tl = require('azure-pipelines-task-lib/task');

// handle user input scenerios
export function sanitizeVersionString(inputVersion: string) : string{
    var version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return "v"+version;
}