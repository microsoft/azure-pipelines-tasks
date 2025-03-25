import * as tl from 'azure-pipelines-task-lib/task';
import axios from 'axios';
import pRetry from 'p-retry';
import { CallbackResult } from './types';

export class CallbackHandler {
  private planUrl: string;
  private projectId: string;
  private hubName: string;
  private planId: string;
  private timelineId: string;
  private authToken: string;

  constructor(private taskInstanceId: string) {
    this.planUrl = tl.getVariable('system.CollectionUri') || '';
    this.projectId = tl.getVariable('system.TeamProjectId') || '';
    this.hubName = tl.getVariable('system.HostType') || '';
    this.planId = tl.getVariable('system.PlanId') || '';
    this.timelineId = tl.getVariable('system.TimelineId') || '';
    this.authToken = tl.getVariable('system.AccessToken') || '';
  }

  public async waitForCallback(): Promise<CallbackResult> {
    console.log(`Waiting for callback via API for task ID: ${this.taskInstanceId}`);
    
    // Use p-retry to handle retries with exponential backoff
    const result = await pRetry(
      async () => {
        // Check the timeline record
        const record = await this.getTimelineRecord();
        
        // Check for the specific callback variable in the record
        if (record && record.variables && 
            record.variables[`AZURE_FUNCTION_CALLBACK_${this.taskInstanceId}`]) {
          
          const callbackValue = record.variables[`AZURE_FUNCTION_CALLBACK_${this.taskInstanceId}`].value;
          console.log(`Found callback value: ${callbackValue}`);
          
          try {
            const callbackData = JSON.parse(callbackValue);
            const isSuccess = callbackData.result === 'succeeded';
            
            let resultData = {};
            if (callbackData.resultCode) {
              try {
                resultData = JSON.parse(callbackData.resultCode);
              } catch {
                resultData = { message: callbackData.resultCode };
              }
            }
            
            return {
              statusCode: isSuccess ? 200 : 500,
              body: resultData
            };
          } catch (e) {
            return {
              statusCode: 200,
              body: { raw: callbackValue }
            };
          }
        }
        
        // If no callback found, throw error to trigger retry
        throw new Error('Callback not found yet, retrying...');
      },
      {
        retries: 1440, // 2 hours with 5-second intervals
        minTimeout: 5000, // 5 seconds
        maxTimeout: 5000, // 5 seconds (fixed interval)
        onFailedAttempt: error => {
          if (error.retriesLeft % 12 === 0) { // Log every minute
            console.log(`Callback not received yet. Retries left: ${error.retriesLeft}`);
          }
        }
      }
    );
    
    return result;
  }
  
  private async getTimelineRecord(): Promise<any> {
    try {
      // First, try getting the job record (which contains the variables)
      const baseUrl = this.planUrl.replace(/\/+$/, '');
      const url = `${baseUrl}/${this.projectId}/_apis/distributedtask/hubs/${this.hubName}/plans/${this.planId}/timelines/${this.timelineId}/records?api-version=7.1`;
      
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.authToken}`
        }
      });
      
      if (response.status === 200 && response.data && response.data.value) {
        // Find the job record (parent of our task)
        for (const record of response.data.value) {
          // Check if this record has variables containing our callback
          if (record.variables && 
              record.variables[`AZURE_FUNCTION_CALLBACK_${this.taskInstanceId}`]) {
            return record;
          }
          
          // Check if this is our task's parent (the job record)
          if (record.type === 'Job') {
            return record;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.log(`API error: ${error}`);
      return null;
    }
  }
}