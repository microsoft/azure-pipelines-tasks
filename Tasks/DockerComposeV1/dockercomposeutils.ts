"use strict";

import * as tl from "azure-pipelines-task-lib/task";

export function findDockerFile(dockerfilepath: string, currentWorkingDirectory: string = ""): string {
    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug(tl.loc('ContainerPatternFound'));
        var rootPath = currentWorkingDirectory.length > 0 ? currentWorkingDirectory : tl.getVariable('System.DefaultWorkingDirectory');     
        var allFiles = tl.find(rootPath);
        var matchingResultsFiles = tl.match(allFiles, dockerfilepath, rootPath, { matchBase: true });

        if (!matchingResultsFiles || matchingResultsFiles.length == 0) {
            throw new Error(tl.loc('ContainerDockerFileNotFound', dockerfilepath));
        }

        return matchingResultsFiles[0];
    }
    else {
        tl.debug(tl.loc('ContainerPatternNotFound'));
        return dockerfilepath;
    }
}

export interface ParsedComposeArgs {
    globalArgs: string[];
    commandArgs: string[];
}

export function parseComposeArguments(argsString: string): ParsedComposeArgs {
    if (!argsString || argsString.trim() === "") {
        return { globalArgs: [], commandArgs: [] };
    }

    // List of global Docker Compose flags that should be placed before the action/command
    const globalFlags = [
        '--profile',
        '--ansi',
        '--compatibility',
        '--dry-run',
        '--env-file',
        '--parallel',
        '--progress',
        '--project-directory'
        // Note: -f/--file and -p/--project-name are already handled separately in createComposeCommand()
    ];

    const globalArgs: string[] = [];
    const commandArgs: string[] = [];
    
    // Simple argument parsing - split by spaces but handle quoted strings
    const args = parseArgumentString(argsString);
    
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        
        // Check if this is a global flag
        const isGlobalFlag = globalFlags.some(flag => arg === flag || arg.startsWith(flag + '='));
        
        if (isGlobalFlag) {
            globalArgs.push(arg);
            
            // If it's a flag that takes a separate value (not using = syntax), include the next argument too
            if (!arg.includes('=') && i + 1 < args.length && !args[i + 1].startsWith('-')) {
                globalArgs.push(args[i + 1]);
                i++; // Skip the next argument as we've already processed it
            }
        } else {
            commandArgs.push(arg);
        }
        
        i++;
    }
    
    return { globalArgs, commandArgs };
}

function parseArgumentString(argsString: string): string[] {
    const args: string[] = [];
    let currentArg = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];
        
        if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true;
            quoteChar = char;
        } else if (inQuotes && char === quoteChar) {
            inQuotes = false;
            quoteChar = '';
        } else if (!inQuotes && char === ' ') {
            if (currentArg.trim()) {
                args.push(currentArg.trim());
                currentArg = '';
            }
        } else {
            currentArg += char;
        }
    }
    
    if (currentArg.trim()) {
        args.push(currentArg.trim());
    }
    
    return args;
}
