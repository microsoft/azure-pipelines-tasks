import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { shellQuote } from 'azure-pipelines-tasks-utility-common/shellEscaping';

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
        const safeTarget: string = shellQuote(targetFolder);
        const hiddenFilesClean: string = `${ cleanHiddenFiles ? "{,.[!.],..?}" : "" }`;
        const cleanFilesInTarget: string = `rm -rf ${safeTarget}/${hiddenFilesClean}*`;
        return cleanFilesInTarget;
    }
}

/**
 * Returns true when {candidate} (an already posix-normalized path produced by joining it
 * under {normalizedRoot}) still resolves inside {normalizedRoot}.
 */
function isUnderRoot(normalizedRoot: string, candidate: string): boolean {
    if (candidate === normalizedRoot) {
        return true;
    }

    if (normalizedRoot === "." || normalizedRoot === "./") {
        return candidate !== ".." && !candidate.startsWith("../");
    }

    const prefix: string = normalizedRoot.endsWith("/") ? normalizedRoot : `${normalizedRoot}/`;
    return candidate.startsWith(prefix);
}

/**
 * Joins {relativePath} under {targetFolder} and returns the remote path to upload to.
 * Throws if the result would resolve outside {targetFolder}.
 *
 * A relative path containing a literal backslash is only ever a real path separator when the
 * agent itself uses backslash separators (Windows, handled by unixyPath below). On any other
 * agent OS, a backslash inside the computed relative path can only be part of an actual file
 * name - which is how a ".." traversal disguised as a single, Windows-illegal filename is
 * smuggled in by a source contributor. Reject it outright instead of translating it into a
 * real separator, since translating it would still let the join below escape targetFolder.
 */
export function resolveTargetPath(targetFolder: string, relativePath: string): string {
    if (process.platform !== "win32" && relativePath.includes("\\")) {
        throw new Error(tl.loc("TargetPathContainsBackslash", relativePath));
    }

    const normalizedTarget: string = path.posix.normalize(targetFolder);
    const targetPath: string = path.posix.join(targetFolder, relativePath);

    if (!isUnderRoot(normalizedTarget, targetPath)) {
        throw new Error(tl.loc("TargetPathEscapesTargetFolder", relativePath, targetFolder));
    }

    return targetPath;
}

export function prepareFiles(filesToCopy: string[], sourceFolder: string, targetFolder: string, flattenFolders: boolean) {
    return filesToCopy.map(x => {
        const relativePath = flattenFolders
            ? path.basename(x)
            : x.substring(sourceFolder.length).replace(/^\\/g, "").replace(/^\//g, "");

        let targetPath = resolveTargetPath(targetFolder, relativePath);

        if (!path.isAbsolute(targetPath) && !pathIsUNC(targetPath)) {
            targetPath = `./${targetPath}`;
        }

        return [x, unixyPath(targetPath)];
    });
}