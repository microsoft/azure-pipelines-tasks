import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';

/**
 * Interface for FindOptions
 * Contains properties to control whether to follow symlinks
 */
 export interface RetryOptions {

    /**
     * Number of retries
     */
    numberOfReties: number,

    /**
     * Timeout between retries in milliseconds
     */
    timeoutBetweenRetries: number
}

export class RetryHelper {
    private retryOptions: RetryOptions;

    constructor (retryOptions: RetryOptions) {
        this.retryOptions = retryOptions;
    }


    public async RunWithRetry<T>(action: () => T, actionName: string): Promise<T>  {
        let attempts = this.retryOptions.numberOfReties;
        while (true) {
            try {
                const result: T = await action();
                return result;
            } catch (err) {
                --attempts;
                if (attempts <= 0) {
                    throw err;
                }
                tl.writeExternalOutput(`Error while ${actionName}: ${err}. Remaining attempts: ${attempts}` + os.EOL, { source: 'repository' });
                await this.sleep();
            }
        }
    }

    private async sleep() {
        return new Promise(resolve => setTimeout(resolve,
            this.retryOptions.timeoutBetweenRetries));
    }
}