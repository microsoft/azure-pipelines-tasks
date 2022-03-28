import { ITaskResult, ICodeAnalysisResult } from '../interfaces';
import { TaskResult } from 'azure-pipelines-task-lib';

/**
 * Resolve task status based on code analysis run results
 * @param {ICodeAnalysisResult} codeAnalysisResult - Code analysis run data
 * @returns {ITaskResult} task status and message
 */
export function resolveTaskResult(codeAnalysisResult: ICodeAnalysisResult): ITaskResult {
    let status: TaskResult;
    let message: string = '';

    if (codeAnalysisResult.gradleResult === 0) {
        status = TaskResult.Succeeded;
        message = 'Build succeeded.';
    } else if (codeAnalysisResult.gradleResult === -1 && codeAnalysisResult.statusFailed === true) {
        status = TaskResult.Failed;
        message = codeAnalysisResult.analysisError;
    } else {
        status = TaskResult.Failed;
        message = 'Build failed.';
    }

    const taskResult: ITaskResult = {
        status: status,
        message: message
    };

    return taskResult;
}
