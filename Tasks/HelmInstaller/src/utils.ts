
import * as toolLib from 'vsts-task-tool-lib/tool';
import tl = require('vsts-task-lib/task');

// handle user input scenerios
export function sanitizeVersionString(inputVersion: string) : string{
    var version = toolLib.cleanVersion(inputVersion);
    if(!version) {
        throw new Error(tl.loc("NotAValidSemverVersion"));
    }
    
    return "v"+version;
}