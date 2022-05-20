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
 * @param {boolean} cleanHiddenFiles clean hidden files in target folder
 */
export function getCleanTargetFolderCmd(targetFolder: string, forWindows: boolean, cleanHiddenFiles: boolean = false ): string {
    if (forWindows) {
        const hiddenFilesClean: string = `${ cleanHiddenFiles ? "/A:H": "" }`;
        const cleanFilesInTarget: string = `del /q ${hiddenFilesClean} "${targetFolder}\\*"`;
        // delete all files in specified folder and then delete all nested folders
        return `${cleanFilesInTarget} && FOR /D %p IN ("${targetFolder}\\*.*") DO rmdir "%p" /s /q`;
    } else {
        // This pattern will ignore files whose name is . and .. during deletion. These are system files that exist in every Linux directory.
        // An attempt to delete these files will produce warnings that could confuse users.
        // Here is more information about this problem https://unix.stackexchange.com/questions/77127/rm-rf-all-files-and-all-hidden-files-without-error/77313#77313
        const hiddenFilesClean: string = `${ cleanHiddenFiles ? "{,.[!.],..?}" : "" }`;
        const cleanFilesInTarget: string = `sh -c "rm -rf '${targetFolder}'/${hiddenFilesClean}*"`;
        return cleanFilesInTarget;
    }
}
