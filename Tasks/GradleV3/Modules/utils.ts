import { ITaskResult, ICodeAnalysisResult } from '../interfaces';
import { TaskResult } from 'azure-pipelines-task-lib';

/**
 * Resolve task status based on code analysis run results
 * @param {ICodeAnalysisResult} codeAnalysisResult - Code analysis run data
 * @param {string[]} inputTasks - List of tasks that were run
 * @param {string} inputOptions - Options passed to the Gradle command
 * @returns {ITaskResult} task status and message
 */
export function resolveTaskResult(codeAnalysisResult: ICodeAnalysisResult, inputTasks: string[], inputOptions:string): ITaskResult {
    let status: TaskResult;
    let message: string = '';

    if (codeAnalysisResult.gradleResult === 0) {
        status = TaskResult.Succeeded;
        message = 'Build succeeded.';
    } else if (codeAnalysisResult.gradleResult === -1) {
        status = TaskResult.Failed;

        if (codeAnalysisResult.statusFailed) {
            message = `Gradle execution for task(s) ${inputTasks.join(', ')} failed with exit code ${codeAnalysisResult.gradleResult}.`;
            if(inputOptions != null && inputOptions !== ''){
                message = `Gradle execution for task(s) ${inputTasks.join(', ')} with options: ${inputOptions} failed with exit code ${codeAnalysisResult.gradleResult}.`;
            }
        } else {
            message = `Build failed. Gradle exit code: ${codeAnalysisResult.gradleResult}`;
        }
    }

    const taskResult: ITaskResult = {
        status: status,
        message: message
    };

    return taskResult;
}
