import * as tl from 'azure-pipelines-task-lib/task';

export function Retry(retryCount: number): <T>(operation: () => Promise<T>) => Promise<T> {
    return async function<T>(operation: () => Promise<T>): Promise<T> {
        let retriesRemaining = retryCount;
        let retryDelay = 100;

        while (true) {
            try {
                return await operation();
            } catch (error) {
                if (retriesRemaining < 1) {
                    throw error;
                }

                tl.debug(tl.loc('RetryingOperation', retryDelay, retriesRemaining));
                await delay(retryDelay);

                --retriesRemaining;
                retryDelay *= 2;
            }
        }
    };
}

function delay(delayMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delayMs));
 }