import { TaskResult } from 'azure-pipelines-task-lib';

export interface ICodeCoveragePreset {
    summaryFileName: string;
    reportingTaskName: string;
}

export interface ICodeCoverageSettings {
    wrapperScript: string;
    isCodeCoverageOpted: boolean;
    classFilter: string;
    classFilesDirectories: string;
    codeCoverageTool: string;
    workingDirectory: string;
    reportDirectoryName: string;
    summaryFileName: string;
    isMultiModule: boolean;
    gradle5xOrHigher: boolean;
}

export interface IPublishCodeCoverageSettings {
    isCodeCoverageOpted: boolean;
    failIfCoverageEmpty: boolean;
    codeCoverageTool: string;
    summaryFile: string;
    reportDirectory: string;
}

export interface ICodeAnalysisResult {
    gradleResult?: number;
    statusFailed?: boolean;
    analysisError?: any;
}

export interface ITaskResult {
    status: TaskResult;
    message: string;
}
