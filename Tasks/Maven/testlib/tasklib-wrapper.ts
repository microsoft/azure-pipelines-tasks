// Redirects calls to vsts-task-lib to testlib if in a test environment.
import tasklib = require('vsts-task-lib/task');
import testlib = require('./testlib-main');

// TODO: should go away when task lib
export interface EndpointAuthorization {
    parameters:{
        [key: string]: string;
    };
    scheme:string;
}

export var tl:any = tasklib;

/* Switch to test from production */
export function enableTesting():void {
    tl = testlib;
}

export function isInTest() {
    return tl == testlib;
}

/*  Available wrapped functions */

/* Implementation:
 (current method name)   (call with the current arguments and context)
 return tl..apply(this, arguments);
 */

export function debug(input:string) {
    return tl.debug.apply(this, arguments);
}

export function warning(input:string) {
    return tl.warning.apply(this, arguments);
}

export function error(input:string) {
    return tl.error.apply(this, arguments);
}

/**
 * Remove a path recursively with force
 * Returns whether it succeeds
 *
 * @param     path     path to remove
 * @param     continueOnError optional. whether to continue on error
 * @returns   string[]
 */
export function rmRF(path:string, continueOnError?:boolean):void {
    return tl.rmRF.apply(this, arguments);
}

/**
 * Make a directory.  Creates the full path with folders in between
 * Returns whether it was successful or not
 *
 * @param     p       path to create
 * @returns   boolean
 */
export function mkdirP(p):void {
    return tl.mkdirP.apply(this, arguments);
}

export function cp(source:string, dest:string, options?:string, continueOnError?:boolean):void {
    return tl.cp.apply(this, arguments);
}

/**
 * Returns whether a path exists.
 *
 * @param     path      path to check
 * @returns   boolean
 */
export function exist(path:string):boolean {
    return tl.exist.apply(this, arguments);
}

/**
 * Sets the location of the resources json.  This is typically the task.json file.
 * Call once at the beginning of the script before any calls to loc.
 *
 * @param     path      Full path to the json.
 * @returns   void
 */
export function setResourcePath(path:string):void {
    return tl.setResourcePath.apply(this, arguments);
}

/**
 * Gets the localized string from the json resource file.  Optionally formats with additional params.
 *
 * @param     key      key of the resources string in the resource file
 * @param     param    additional params for formatting the string
 * @returns   string
 */
export function loc(key:string, a?:any, b?:any, c?:any):string {
    return tl.loc.apply(this, arguments);
}

/**
 * Gets the value of an input.  The value is also trimmed.
 * If required is true and the value is not set, the task will fail with an error.  Execution halts.
 *
 * @param     name     name of the input to get
 * @param     required whether input is required.  optional, defaults to false
 * @returns   string
 */
export function getInput(key:string, required?:boolean):string {
    return tl.getInput.apply(this, arguments);
}

export function getBoolInput(name:string, required?:boolean):boolean {
    return tl.getBoolInput.apply(this, arguments);
}

export function getDelimitedInput(name:string, delim:string, required?:boolean):string[] {
    return tl.getDelimitedInput.apply(this, arguments);
}

export function getPathInput(name:string, required?:boolean, check?:boolean):string {
    return tl.getPathInput.apply(this, arguments);
}

export function getEndpointUrl(id:string, optional:boolean):string {
    return tl.getEndpointUrl.apply(this, arguments);
}

export function getEndpointAuthorization(id:string, optional:boolean):EndpointAuthorization {
    return tl.getEndpointAuthorization.apply(this, arguments);
}


/**
 * Gets a variables value which is defined on the build definition or set at runtime.
 *
 * @param     name     name of the variable to get
 * @returns   string
 */
export function getVariable(key:string):string {
    return tl.getVariable.apply(this, arguments);
}

/**
 * Sets a variables which will be available to subsequent tasks as well.
 *
 * @param     name     name of the variable to set
 * @param     val     value to set
 * @returns   void
 */
export function setVariable(name:string, val:string):void {
    return tl.setVariable.apply(this, arguments);
}

export function command(command:string, properties, message:string) {
    return tl.command.apply(this, arguments);
}