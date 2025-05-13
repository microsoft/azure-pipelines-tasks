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
            if (codeAnalysisResult.isTestFailure && !codeAnalysisResult.isCodeAnalysisFailure) {
                message = `Tests failed. Gradle exit code: ${codeAnalysisResult.gradleResult}. Error: ${codeAnalysisResult.analysisError}`;
            } else if (codeAnalysisResult.isCodeAnalysisFailure) {
                message = `Code analysis failed. Gradle exit code: ${codeAnalysisResult.gradleResult}. Error: ${codeAnalysisResult.analysisError}`;
            } else {
                message = `Build failed. Gradle exit code: ${codeAnalysisResult.gradleResult}. Error: ${codeAnalysisResult.analysisError}`;
            }
        }
    }

    const taskResult: ITaskResult = {
        status: status,
        message: message
    };

    return taskResult;
}
