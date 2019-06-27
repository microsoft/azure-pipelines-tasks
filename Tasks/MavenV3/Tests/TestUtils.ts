import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";

export interface MavenTaskInputs {
    mavenVersionSelection?: string;
    mavenPOMFile?: string;
    options?: string;
    goals?: string;
    javaHomeSelection?: string;
    jdkVersion?: string;
    publishJUnitResults?: boolean;
    testResultsFiles?: string;
    mavenOpts?: string;
    checkstyleAnalysisEnabled?: boolean;
    pmdAnalysisEnabled?: boolean;
    findbugsAnalysisEnabled?: boolean;
    mavenFeedAuthenticate?: boolean;
}

export const setInputs = (
    taskRunner: TaskMockRunner,
    inputs: MavenTaskInputs
) => {
    for (const key in inputs) {
        const value = inputs[key];
        if (value) {
            taskRunner.setInput(key, String(value));
        }
    }
};
