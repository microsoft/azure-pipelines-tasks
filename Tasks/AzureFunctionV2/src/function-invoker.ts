import * as tl from 'azure-pipelines-task-lib/task';
import axios, { AxiosRequestConfig } from 'axios';
import { AuthType, CompletionEvent } from './constants';
import { TaskInputs } from './types';
import { RequestBuilder } from './request-builder';
import { CallbackHandler } from './callback-handler';

export class AzureFunctionInvoker {
  private requestBuilder: RequestBuilder;

  constructor(private inputs: TaskInputs) {
    this.requestBuilder = new RequestBuilder(inputs);
  }

  public async invoke<T = any>(): Promise<T> {
    try {
      tl.debug(`Invoking Azure Function with ${this.inputs.authType} authentication`);
      const request: AxiosRequestConfig = await this.requestBuilder.buildRequest();

      // Make the initial request to the function
      const response = await this.makeRequest<T>(request);
      
      if (this.inputs.waitForCompletion === CompletionEvent.Callback) {
        console.log('Function invoked. Waiting for callback...');
        
        const taskInstanceId = tl.getVariable('system.TaskInstanceId') || '';
        console.log(`Task instance ID: ${taskInstanceId}`);
        
        const callbackHandler = new CallbackHandler(taskInstanceId);
        const callbackResult = await callbackHandler.waitForCallback();
        
        console.log(`Callback received: ${JSON.stringify(callbackResult.body)}`);
        return callbackResult.body as T;
      }

      return response;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private async makeRequest<T>(request: AxiosRequestConfig): Promise<T> {
    tl.debug(`Making request to ${request.url} with method ${request.method}`);

    try {
      const response = await axios(request);

      tl.debug(`Response status: ${response.status}`);

      // Check if status code indicates an error
      if (response.status >= 400) {
        throw new Error(`Function returned status code ${response.status}: ${JSON.stringify(response.data)}`);
      }

      // Evaluate success criteria if specified
      if (this.inputs.successCriteria) {
        this.evaluateSuccessCriteria(response.data);
      }

      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        // Handle Axios-specific errors
        if (error.response) {
          throw new Error(`Function request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          throw new Error(`No response received from function. The request was made but no response was received: ${error.message}`);
        } else {
          throw new Error(`Error setting up function request: ${error.message}`);
        }
      }
      throw error;
    }
  }

  private evaluateSuccessCriteria(responseBody: any): void {
    if (!this.inputs.successCriteria) return;

    try {
      tl.debug(`Evaluating success criteria: ${this.inputs.successCriteria}`);

      const context = {
        statusCode: responseBody.statusCode,
        body: responseBody,
        root: responseBody
      };

      // Evaluate the expression in the context
      const expression = this.inputs.successCriteria;
      const result = this.evaluateExpression(expression, context);

      if (!result) {
        throw new Error(`Response did not meet success criteria: ${expression}`);
      }

      tl.debug('Success criteria met');
    } catch (error: any) {
      throw new Error(`Failed to evaluate success criteria: ${error.message}`);
    }
  }

  private evaluateExpression(expression: string, context: any): boolean {
    // Safe evaluation with a restricted context
    try {
      // Use with statement to provide the context to the expression
      const result = eval(`with (context) { ${expression} }`);
      return !!result;
    } catch (error: any) {
      throw new Error(`Invalid expression "${expression}": ${error.message}`);
    }
  }

  private handleError(error: any): void {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status;
      const message = error.response?.data?.message || error.message;

      if (statusCode === 401 || statusCode === 403) {
        tl.error(`Authentication failed. Please check your credentials. Status: ${statusCode}`);
      } else if (statusCode === 404) {
        tl.error(`Function not found. Please check the URL: ${this.inputs.function}`);
      } else if (statusCode >= 500) {
        tl.error(`Server error from function. Status: ${statusCode}`);
      }

      tl.error(`Function error details: ${message}`);
    } else {
      tl.error(`Error: ${error.message}`);
    }
  }
}