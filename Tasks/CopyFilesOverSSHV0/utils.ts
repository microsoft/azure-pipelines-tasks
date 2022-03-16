import * as tl from 'azure-pipelines-task-lib/task';

const UNCPathPattern: RegExp = /^[\\]{2,}[^\\\/]+[\\\/]+[^\\\/]+/;

/**
 * Change path separator for Windows-based platforms
 * See https://github.com/spmjs/node-scp2/blob/master/lib/client.js#L319
 * 
 * @param filePath 
 */
export function unixyPath(filePath: string): string {
    if (process.platform === 'win32') {
        return filePath.replace(/\\/g, '/');
    }
    return filePath;
}

/**
 * Determines whether {path} is an UNC path.
 * @param path 
 */
export function pathIsUNC(path: string): boolean {
    return UNCPathPattern.test(path);
}

/**
 * Gets OS specific command to clean folder in specified path.
 * @returns {string} OS specific command to clean target folder on the remote machine
 * @param {string} targetFolder path to target folder
 * @param {boolean} forWindows return command for Windows CMD
 * @param {boolean} cleanHiddenFiles clean hedden files in target folder
 */
export function getCleanTargetFolderCmd(targetFolder: string, forWindows: boolean, cleanHiddenFiles: boolean = false ): string {
    if (forWindows) {
        const cleanFilesInTarget = cleanHiddenFiles ? `del /q /A:H "${targetFolder}\\*"` : `del /q "${targetFolder}\\*"`
        // delete all files in specified folder and then delete all nested folders
        return `${cleanFilesInTarget} && FOR /D %p IN ("${targetFolder}\\*.*") DO rmdir "%p" /s /q`;
    } else {
        const cleanFilesInTarget = cleanHiddenFiles ? `sh -c "rm -rf '${targetFolder}'/{,.[!.],..?}*"` : `sh -c "rm -rf '${targetFolder}'/*"`;
        return cleanFilesInTarget;
    }
}
