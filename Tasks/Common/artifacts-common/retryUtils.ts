import * as tl from 'azure-pipelines-task-lib/task';

export async function retryOnException<T>(action: () => Promise<T>, maxTries: number, retryIntervalInMilliseconds: number): Promise<T> {
    while (true) {
        try {
            return await action();
        } catch (error) {
            maxTries--;
            if (maxTries < 1) {
                tl.debug(`Exhausted retry attempts`);
                throw error;
            }
            tl.debug(`Attempt failed. Number of tries left: ${maxTries}`);
            tl.debug(JSON.stringify(error));
            await delay(retryIntervalInMilliseconds);
        }
    }
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}