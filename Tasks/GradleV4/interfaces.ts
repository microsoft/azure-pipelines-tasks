import { TaskResult } from 'azure-pipelines-task-lib';

export interface ICodeAnalysisResult {
    gradleResult?: number;
    statusFailed?: boolean;
    analysisError?: any;
}

export interface ITaskResult {
    status: TaskResult;
    message: string;
}
