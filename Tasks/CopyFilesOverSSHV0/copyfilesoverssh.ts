import * as os from 'os';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as minimatch from 'minimatch';
import * as utils from './utils';
import { SshHelper } from './sshhelper';

// This method will find the list of matching files for the specified contents
// This logic is the same as the one used by CopyFiles task except for allowing dot folders to be copied
// This will be useful to put in the task-lib
function getFilesToCopy(sourceFolder: string, contents: string[]): string[] {
    // include filter
    const includeContents: string[] = [];
    // exclude filter
    const excludeContents: string[] = [];

    // evaluate leading negations `!` on the pattern
    for (const pattern of contents.map(x => x.trim())) {
        let negate: boolean = false;
        let numberOfNegations: number = 0;
        for (const c of pattern) {
            if (c === '!') {
                negate = !negate;
                numberOfNegations++;
            } else {
                break;
            }
        }

        if (negate) {
            tl.debug('exclude content pattern: ' + pattern);
            const realPattern = pattern.substring(0, numberOfNegations) + path.join(sourceFolder, pattern.substring(numberOfNegations));
            excludeContents.push(realPattern);
        } else {
            tl.debug('include content pattern: ' + pattern);
            const realPattern = path.join(sourceFolder, pattern);
            includeContents.push(realPattern);
        }
    }

    // enumerate all files
    let files: string[] = [];
    const allPaths: string[] = tl.find(sourceFolder);
    const allFiles: string[] = [];

    // remove folder path
    for (const p of allPaths) {
        if (!tl.stats(p).isDirectory()) {
            allFiles.push(p);
        }
    }

    // if we only have exclude filters, we need add a include all filter, so we can have something to exclude.
    if (includeContents.length === 0 && excludeContents.length > 0) {
        includeContents.push('**');
    }

    tl.debug("counted " + allFiles.length + " files in the source tree");

    // a map to eliminate duplicates
    const pathsSeen = {};

    // minimatch options
    const matchOptions: tl.MatchOptions = { matchBase: true, dot: true };
    if (os.platform() === 'win32') {
        matchOptions.nocase = true;
    }

    // apply include filter
    for (const pattern of includeContents) {
        tl.debug('Include matching ' + pattern);

        // let minimatch do the actual filtering
        const matches: string[] = minimatch.match(allFiles, pattern, matchOptions);

        tl.debug('Include matched ' + matches.length + ' files');
        for (const matchPath of matches) {
            if (!pathsSeen.hasOwnProperty(matchPath)) {
                pathsSeen[matchPath] = true;
                files.push(matchPath);
            }
        }
    }

    // apply exclude filter
    for (const pattern of excludeContents) {
        tl.debug('Exclude matching ' + pattern);

        // let minimatch do the actual filtering
        const matches: string[] = minimatch.match(files, pattern, matchOptions);

        tl.debug('Exclude matched ' + matches.length + ' files');
        files = [];
        for (const matchPath of matches) {
            files.push(matchPath);
        }
    }

    return files;
}

async function run() {
    let sshHelper: SshHelper;
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // read SSH endpoint input
        const sshEndpoint = tl.getInput('sshEndpoint', true);
        const username: string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'username', false);
        const password: string = tl.getEndpointAuthorizationParameter(sshEndpoint, 'password', true); //passphrase is optional
        const privateKey: string = process.env['ENDPOINT_DATA_' + sshEndpoint + '_PRIVATEKEY']; //private key is optional, password can be used for connecting
        const hostname: string = tl.getEndpointDataParameter(sshEndpoint, 'host', false);
        let port: string = tl.getEndpointDataParameter(sshEndpoint, 'port', true); //port is optional, will use 22 as default port if not specified
        if (!port) {
            console.log(tl.loc('UseDefaultPort'));
            port = '22';
        }

        const readyTimeout = getReadyTimeoutVariable();
        const useFastPut: boolean = !(process.env['USE_FAST_PUT'] === 'false');

        // set up the SSH connection configuration based on endpoint details
        let sshConfig;
        if (privateKey) {
            tl.debug('Using private key for ssh connection.');
            sshConfig = {
                host: hostname,
                port: port,
                username: username,
                privateKey: privateKey,
                passphrase: password,
                readyTimeout: readyTimeout,
                useFastPut: useFastPut
            }
        } else {
            // use password
            tl.debug('Using username and password for ssh connection.');
            sshConfig = {
                host: hostname,
                port: port,
                username: username,
                password: password,
                readyTimeout: readyTimeout,
                useFastPut: useFastPut
            }
        }

        // contents is a multiline input containing glob patterns
        const contents: string[] = tl.getDelimitedInput('contents', '\n', true);
        const sourceFolder: string = tl.getPathInput('sourceFolder', true, true);
        let targetFolder: string = tl.getInput('targetFolder');

        if (!targetFolder) {
            targetFolder = "./";
        } else {
            // '~/' is unsupported
            targetFolder = targetFolder.replace(/^~\//, "./");
        }

        // read the copy options
        const cleanTargetFolder: boolean = tl.getBoolInput('cleanTargetFolder', false);
        const overwrite: boolean = tl.getBoolInput('overwrite', false);
        const failOnEmptySource: boolean = tl.getBoolInput('failOnEmptySource', false);
        const flattenFolders: boolean = tl.getBoolInput('flattenFolders', false);

        if (!tl.stats(sourceFolder).isDirectory()) {
            throw tl.loc('SourceNotFolder');
        }

        // initialize the SSH helpers, set up the connection
        sshHelper = new SshHelper(sshConfig);
        await sshHelper.setupConnection();

        if (cleanTargetFolder && await sshHelper.checkRemotePathExists(targetFolder)) {
            console.log(tl.loc('CleanTargetFolder', targetFolder));
            const isWindowsOnTarget: boolean = tl.getBoolInput('isWindowsOnTarget', false);
            const cleanHiddenFilesInTarget: boolean = tl.getBoolInput('cleanHiddenFilesInTarget', false);
            const cleanTargetFolderCmd: string = utils.getCleanTargetFolderCmd(targetFolder, isWindowsOnTarget, cleanHiddenFilesInTarget);
            try {
                await sshHelper.runCommandOnRemoteMachine(cleanTargetFolderCmd, null);
            } catch (err) {
                throw tl.loc('CleanTargetFolderFailed', err);
            }
        }

        // identify the files to copy
        const filesToCopy: string[] = getFilesToCopy(sourceFolder, contents);

        // copy files to remote machine
        if (filesToCopy) {
            tl.debug('Number of files to copy = ' + filesToCopy.length);
            tl.debug('filesToCopy = ' + filesToCopy);

            let failureCount = 0;
            console.log(tl.loc('CopyingFiles', filesToCopy.length));
            for (const fileToCopy of filesToCopy) {
                try {
                    tl.debug('fileToCopy = ' + fileToCopy);

                    let relativePath;
                    if (flattenFolders) {
                        relativePath = path.basename(fileToCopy);
                    } else {
                        relativePath = fileToCopy.substring(sourceFolder.length)
                            .replace(/^\\/g, "")
                            .replace(/^\//g, "");
                    }
                    tl.debug('relativePath = ' + relativePath);
                    let targetPath = path.posix.join(targetFolder, relativePath);

                    if (!path.isAbsolute(targetPath) && !utils.pathIsUNC(targetPath)) {
                        targetPath = `./${targetPath}`;
                    }

                    console.log(tl.loc('StartedFileCopy', fileToCopy, targetPath));
                    if (!overwrite) {
                        const fileExists: boolean = await sshHelper.checkRemotePathExists(targetPath);
                        if (fileExists) {
                            throw tl.loc('FileExists', targetPath);
                        }
                    }

                    targetPath = utils.unixyPath(targetPath);
                    // looks like scp can only handle one file at a time reliably
                    await sshHelper.uploadFile(fileToCopy, targetPath);
                } catch (err) {
                    tl.error(tl.loc('FailedOnFile', fileToCopy, err));
                    failureCount++;
                }
            }
            console.log(tl.loc('CopyCompleted', filesToCopy.length));
            if (failureCount) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('NumberFailed', failureCount));
            }
        } else if (failOnEmptySource) {
            throw tl.loc('NothingToCopy');
        } else {
            tl.warning(tl.loc('NothingToCopy'));
        }
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        // close the client connection to halt build execution
        if (sshHelper) {
            tl.debug('Closing the client connection');
            await sshHelper.closeConnection();
        }
    }
}

run().then(() => {
        tl.debug('Task successfully accomplished');
    })
    .catch(err => {
        tl.debug('Run was unexpectedly failed due to: ' + err);
    });

function getReadyTimeoutVariable(): number {
    let readyTimeoutString: string = tl.getInput('readyTimeout', true);
    const readyTimeout: number = parseInt(readyTimeoutString, 10);

    return readyTimeout;
}
