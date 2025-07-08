import path = require('path');
import secureFilesCommon = require('azure-pipelines-tasks-securefiles-common/securefiles-common');
import tl = require('azure-pipelines-task-lib/task');

async function run() {
    let secureFileId: string;
    let secureFileHelpers: secureFilesCommon.SecureFileHelpers;

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        let retryCount = parseInt(tl.getInput('retryCount'));
        let socketTimeout = parseInt(tl.getInput('socketTimeout'));
        if (isNaN(retryCount) || retryCount < 0) {
            retryCount = 8;
        }

        if (isNaN(socketTimeout) || socketTimeout < 0) {
            socketTimeout = undefined;
        }

        // download decrypted contents
        secureFileId = tl.getInput('secureFile', true);
        secureFileHelpers = new secureFilesCommon.SecureFileHelpers(retryCount, socketTimeout);
        let secureFilePath: string = await secureFileHelpers.downloadSecureFile(secureFileId);

        if (tl.exist(secureFilePath)) {
            // set the secure file output variable.
            tl.setVariable('secureFilePath', secureFilePath);
        }
    } catch (err: any) {
        try {
            // Convert error object to a serializable format
            const errorObject = {
                name: err.name,
                message: err.message,
                stack: err.stack,
                // Include any additional properties
                ...Object.getOwnPropertyNames(err).reduce((obj, key) => {
                    obj[key] = err[key];
                    return obj;
                }, {})
            };

            // Log the full error details
            tl.error('Error details:');
            tl.error(JSON.stringify(errorObject, null, 2));

            // If it's an AggregateError, also log inner errors
            if (err.name === "AggregateError" && Array.isArray(err.errors)) {
                tl.error('AggregateError inner errors:');
                const innerErrors = err.errors.map((innerError: any, index: number) => ({
                    errorIndex: index + 1,
                    name: innerError.name,
                    message: innerError.message,
                    stack: innerError.stack,
                    ...Object.getOwnPropertyNames(innerError).reduce((obj, key) => {
                        obj[key] = innerError[key];
                        return obj;
                    }, {})
                }));
                tl.error(JSON.stringify(innerErrors, null, 2));
            }

            tl.setResult(tl.TaskResult.Failed, `Task failed: ${err.message}`);
        } catch (jsonError) {
            // Fallback if JSON stringification fails
            tl.error(`Error converting error to JSON: ${jsonError.message}`);
            tl.setResult(tl.TaskResult.Failed, err.message || 'Unknown error occurred');
        }
    }
}

run();