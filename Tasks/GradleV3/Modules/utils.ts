import { ITaskResult, ICodeAnalysisResult } from '../interfaces';
import { TaskResult } from 'azure-pipelines-task-lib';

/**
 * Resolve task status based on code analysis run results
 * @param {ICodeAnalysisResult} codeAnalysisResult - Code analysis run data
 * @param {string[]} gradleOutput - Captured Gradle output
 * @returns {ITaskResult} task status and message
 */
export function resolveTaskResult(codeAnalysisResult: ICodeAnalysisResult, gradleOutput: string[]): ITaskResult {
    let status: TaskResult;
    let message: string = '';
    let error: string = '';
    if (codeAnalysisResult.gradleResult === 0) {
        status = TaskResult.Succeeded;
        message = 'Build succeeded.';
    }
    else {
        status = TaskResult.Failed;
        message = `Build failed. Gradle exit code: ${codeAnalysisResult.gradleResult}`;
        error = gradleOutput.join('');
    }
    const taskResult: ITaskResult = {
        status: status,
        message: message,
        error: error
    };

    return taskResult;
}