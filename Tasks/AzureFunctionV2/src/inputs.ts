import * as tl from 'azure-pipelines-task-lib/task';
import { TaskInputs } from './types';
import { AuthType, HttpMethod, CompletionEvent, InputNames } from './constants';

export class TaskInputsHelper {
  public static getInputs(): TaskInputs {
    const authType = tl.getInput(InputNames.AuthType, true) as AuthType;
    const serviceConnection = authType === AuthType.ARM ? tl.getInput(InputNames.ServiceConnection, true) : undefined;

    // Parse headers JSON
    let headers: Record<string, string>;
    try {
      headers = JSON.parse(tl.getInput(InputNames.Headers, false) || '{}');
    } catch (e: any) {
      throw new Error(`Invalid headers JSON: ${e.message}`);
    }

    const result: TaskInputs = {
      authType,
      serviceConnection,
      function: tl.getInput(InputNames.FunctionUrl, true),
      key: tl.getInput(InputNames.FunctionKey, true),
      method: tl.getInput(InputNames.Method, true) as HttpMethod,
      headers,
      queryParameters: tl.getInput(InputNames.QueryParams, false),
      body: tl.getInput(InputNames.Body, false),
      waitForCompletion: tl.getInput(InputNames.WaitForCompletion, true) as CompletionEvent,
      successCriteria: tl.getInput(InputNames.SuccessCriteria, false)
    };

    tl.debug('Task inputs: ' + JSON.stringify(result));

    TaskInputsHelper.validateInputs(result);

    return result;
  }

  private static validateInputs(inputs: TaskInputs): void {
    // Check function URL
    if (!inputs.function.startsWith('http')) {
      throw new Error(`Function URL must be a valid HTTP/HTTPS URL. Got: ${inputs.function}`);
    }

    // Check auth-specific requirements
    if (inputs.authType === AuthType.ARM && !inputs.serviceConnection) {
      throw new Error('Service connection is required for ARM authentication');
    }

    if (!inputs.key) {
      throw new Error('Function key is required for authentication');
    }

    // Check if success criteria is provided when needed
    if (inputs.waitForCompletion === CompletionEvent.ApiResponse && inputs.successCriteria && inputs.successCriteria.trim().length === 0) {
      tl.warning('Success criteria is empty. Task will succeed regardless of the response');
    }
  }
}