import * as tl from "azure-pipelines-task-lib/task";
import { CallbackResult } from './types';

/**
 * Handles the callback completion mode for Azure Functions
 */
export class CallbackHandler {
    // Constants
    private static readonly TIMEOUT = 7200000; // 2 hours in milliseconds
    private static readonly POLLING_INTERVAL = 5000; // 5 seconds
    private static readonly MAX_ATTEMPTS = 1440; // 2 hours at 5-second intervals

    constructor(private taskInstanceId: string) {}

    public async waitForCallback(): Promise<CallbackResult> {
        tl.debug(`Waiting for callback to update timeline record for task: ${this.taskInstanceId}`);
        
        const startTime = Date.now();
        let attempts = 0;
        
        // Poll until timeout or successful callback
        while (Date.now() - startTime < CallbackHandler.TIMEOUT) {
            attempts++;
            
            try {
                tl.debug(`Checking callback status (attempt ${attempts}/${CallbackHandler.MAX_ATTEMPTS})...`);
                const result = await this.checkCallbackStatus();
                
                if (result) {
                    tl.debug('Received callback response');
                    return result;
                }
                
                // Wait before next check
                await this.sleep(CallbackHandler.POLLING_INTERVAL);
            } catch (error: any) {
                tl.debug(`Error checking callback status: ${error.message}`);
                
                // If this is a permanent error, don't keep retrying
                if (this.isPermanentError(error)) {
                    throw error;
                }
                
                // Wait before retry
                await this.sleep(CallbackHandler.POLLING_INTERVAL);
            }
        }
        
        throw new Error('Timed out waiting for callback from Azure Function. The function might still be running, but did not send a callback response within the 2-hour timeout period.');
    }

    /**
     * Checks if the callback has been received
     * @returns The callback result, or null if not received yet
     */
    private async checkCallbackStatus(): Promise<CallbackResult | null> {
        // This implementation depends on how your callback system works
        // For Azure DevOps, we'd typically check the timeline record
        
        try {
            // Try to get callback data from timeline record
            const timelineRecord = this.getTimelineRecord();
            
            if (timelineRecord && timelineRecord.result) {
                tl.debug(`Received callback timeline record: ${JSON.stringify(timelineRecord)}`);
                
                // Extract status code and body from record
                return {
                    statusCode: timelineRecord.result === 'succeeded' ? 200 : 500,
                    body: timelineRecord.resultCode || timelineRecord.errorMessage || {}
                };
            }
        } catch (error: any) {
            tl.debug(`Error getting timeline record: ${error.message}`);
        }
        
        return null;
    }

    private isPermanentError(error: any): boolean {
        const message = error.message || '';
        const permanentErrorMarkers = [
            'Access denied',
            'Unauthorized',
            'not found',
            'Invalid'
        ];
        
        return permanentErrorMarkers.some(marker => message.includes(marker));
    }

    private getTimelineRecord(): any {
        // In a real implementation, this would query the Azure DevOps API
        // For this task, we'll check for a mock timeline record in variables
        // that might have been set by the function for testing purposes
        
        const record = tl.getVariable(`AZURE_FUNCTION_CALLBACK_${this.taskInstanceId}`);
        if (record) {
            try {
                return JSON.parse(record);
            } catch (e) {
                return null;
            }
        }
        
        return null;
    }

    /**
     * Sleeps for the specified duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}