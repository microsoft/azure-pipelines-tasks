export interface IOperationResult {
    returnCode : number;
    errorMessage?: string;
}

export interface ITestExecutor {
    execFilePath: string;
    setup(): IOperationResult;
    executeTests(): IOperationResult;
}