import {TaskResult, TaskCommand} from './testlib-main';

export interface ITestLib {

    debugLog:string;
    warningLog:string;
    errorLog:string;
    resourceFilePath:any;

    setResult(result:TaskResult, message:string):void;

    debug(input:string):void;

    warning(input:string):void;

    error(input:string):void;

    rmRF(path:string, continueOnError?:boolean):void;

    checkPath(p:string, name:string):void;

    mkdirP(p:any):void;

    cp(source:string, dest:string, options?:string, continueOnError?:boolean):void;

    exist(path:string):boolean;

    setResourcePath(path:string):void;

    loc(key:string):string;

    getInput(key:string, required?:boolean):string;

    getBoolInput(name:string, required?:boolean):boolean;

    getDelimitedInput(name:string, delim:string, required?:boolean):string[];

    getPathInput(name:string, required?:boolean, check?:boolean):string;

    getVariable(key:string):string;

    command(command:string, properties:any, message:string):void;

    commandFromString(commandLine:string):TaskCommand;

    setLoc(key:string, value:string):void;

    setInput(key:string, value:string):void;

    setVariable(key:string, value:string):void;
}