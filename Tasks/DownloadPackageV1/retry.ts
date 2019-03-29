import * as tl from "azure-pipelines-task-lib/task";

export let Retry = (retryCount: number) => <T>(operation: () => Promise<T>) => {
    return new Promise<T>((resolve, reject) => {
        executeWithRetriesImplementation<T>(operation, retryCount, 100, resolve, reject);
    });
};

function executeWithRetriesImplementation<T>(operation: () => Promise<T>, currentRetryCount, retryDelay, resolve, reject) {
    operation()
        .then(result => {
            resolve(result);
        })
        .catch(async error => {
            if (currentRetryCount <= 0) {
                reject(error);
            } else {
                tl.debug(tl.loc("RetryingOperation", retryDelay, currentRetryCount));
                await delay(retryDelay);
                setTimeout(
                    () => executeWithRetriesImplementation(operation, currentRetryCount - 1, retryDelay * 2, resolve, reject),
                    4 * 1000
                );
            }
        });
}

function delay(delayMs:number) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, delayMs);
    });
 }