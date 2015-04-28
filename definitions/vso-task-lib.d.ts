declare module VsoTaskLib {
    function setStdStream(stdStream: NodeJS.WritableStream): void;
    function setErrStream(errStream: NodeJS.WritableStream): void;
    function exit(code: number): void;
    
    function getVariable(name: string): string;
    function getInput(name: string, required?: boolean): string;
    function getDelimitedInput(name: string, delim: string, required?: boolean): string[];
    function getPathInput(name: string, required?: boolean, check?: boolean): string;
    
    function warning(message: string): void;
    function error(message: string): void;
    function debug(message: string): void;
    function command(command: string, properties?: any, message?: any): void;
    
    function cd(path: string): void;
    function pushd(path: string): void;
    function popd(): void;
    
    function checkPath(path: string, name: string): void;
    function mkdirP(path: string): void;
    function which(tool: string, check?: boolean): string;
    function cp(options: any, source: string, dest: string): void;
    
    var TaskCommand: any;
    var commandFromString: any;
    var ToolRunner: any;

    function match(list: string[], pattern: string, options?: any): string[];
    function matchFile(file: string, pattern: string, options?: any): boolean;
    function filter(pattern: string, options?: any): (file: string) => boolean;
    
    function readDirectory(directory: string, includeFiles: boolean, includeFolders: boolean): Q.Promise<string[]>;
}