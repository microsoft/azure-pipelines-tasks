import shell = require('shelljs');
import path = require('path');
import fs = require('fs');

import * as tl from 'azure-pipelines-task-lib/task';

export class FileSystemInteractions {

    /**
     * Copies a file from the source path to the destination path.
     * If the destination path already exists, it is replaced. Otherwise a new file is created.
     *
     * Adapted from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/task.ts
     * @param sourcePath      Path to copy from
     * @param destinationPath Path to copy to
     */
    public static copyFile(sourcePath: string, destinationPath: string): void {
        shell.cp('-f', sourcePath, destinationPath);
        this.checkShell('cp', false);
    }

    /**
     * Create a directory at the specified path, including any folders in between.
     *
     * Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/task.ts
     * @param directoryPath Path to create
     */
    public static createDirectory(directoryPath: string): void {
        // build a stack of directories to create
        let stack: string[] = [ ];
        let testDir: string = directoryPath;
        while (true) {
            // validate the loop is not out of control
            if (stack.length >= 1000) {
                // let the framework throw
                fs.mkdirSync(directoryPath);
                return;
            }

            tl.debug(`testing directory '${testDir}'`);
            let stats: fs.Stats;
            try {
                stats = fs.statSync(testDir);
            } catch (err) {
                if (err.code === 'ENOENT') {
                    // validate the directory is not the drive root
                    let parentDir: string = path.dirname(testDir);
                    if (testDir === parentDir) {
                        throw new Error(tl.loc('LIB_MkdirFailedInvalidDriveRoot', directoryPath, testDir)); // Unable to create directory '{p}'. Root directory does not exist: '{testDir}'
                    }

                    // push the dir and test the parent
                    stack.push(testDir);
                    testDir = parentDir;
                    continue;
                } else if (err.code === 'UNKNOWN') {
                    throw new Error(tl.loc('LIB_MkdirFailedInvalidShare', directoryPath, testDir)); // Unable to create directory '{p}'. Unable to verify the directory exists: '{testDir}'. If directory is a file share, please verify the share name is correct, the share is online, and the current process has permission to access the share.
                } else {
                    throw err;
                }
            }

            if (!stats.isDirectory()) {
                throw new Error(tl.loc('LIB_MkdirFailedFileExists', directoryPath, testDir)); // Unable to create directory '{p}'. Conflicting file exists: '{testDir}'
            }

            // testDir exists
            break;
        }

        // create each directory
        while (stack.length) {
            let dir: string = stack.pop();
            tl.debug(`mkdir '${dir}'`);
            try {
                fs.mkdirSync(dir);
            } catch (err) {
                throw new Error(tl.loc('LIB_MkdirFailed', directoryPath, err.message)); // Unable to create directory '{p}'. {err.message}
            }
        }
    }

    /**
     * Checks that no errors were produced by the previous command.
     *
     * Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/task.ts
     * @param cmd             Command issued
     * @param continueOnError Do not throw an exception if an error was produced
     */
    private static checkShell(cmd: string, continueOnError?: boolean): void {
        let se: string = shell.error();

        if (se) {
            tl.debug(cmd + ' failed');

            if (!continueOnError) {
                throw new Error(se);
            }
        }
    }
}
