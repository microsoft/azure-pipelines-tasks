import { ciDictionary } from "../Common/ciEventLogger";
import { IOperationResult } from "./IOperationResult";
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";

export interface ITestExecutor {
    testRunnerCLI: string;
    toolRunner: ToolRunner;
    setup(): Promise<IOperationResult>;
    discoverTests(listOfTestsToBeExecuted: string[], ciData: ciDictionary, listOfTestsToBeRan: string[]): Promise<IOperationResult>;
    executeTests(listOfTestsToBeExecuted: string[], ciData: ciDictionary): Promise<IOperationResult>;
}