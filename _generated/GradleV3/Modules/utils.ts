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
    } else if (codeAnalysisResult.gradleResult === -1) {
        status = TaskResult.Failed;

        if (codeAnalysisResult.statusFailed) {
            message = `Code analysis failed. Gradle exit code: ${codeAnalysisResult.gradleResult}. Error: ${codeAnalysisResult.analysisError}`;
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
